type ExtractionStatus =
  | "full_structured_extract"
  | "full_structured_extract_with_downloaded_attachments"
  | "full_structured_extract_with_source_pdf"
  | "full_structured_extract_with_source_pdf_attachment_zip_unavailable"
  | "full_extracted_with_source_inconsistency"
  | "historical_full_structured_extract"
  | "historical_full_structured_extract_with_source_pdf"
  | "official_notice_metadata_only"
  | "list_extracted"
  | "blocked_405"
  | "blocked_or_unavailable"
  | "superseded_by_full_record";

function isStructuredExtraction(status: ExtractionStatus): boolean {
  return status.startsWith("full_structured_extract") ||
    status === "full_extracted_with_source_inconsistency" ||
    status.startsWith("historical_full_structured_extract");
}

function canBecomeCurrent(status: ExtractionStatus, requiresManualReview: boolean): boolean {
  return isStructuredExtraction(status) &&
    !status.startsWith("historical_") &&
    !status.includes("source_inconsistency") &&
    !status.includes("zip_unavailable") &&
    !requiresManualReview;
}

async function processDiscoveredItem(item: DiscoveredItem): Promise<void> {
  const snapshot = await fetchWithConditionalHeaders(item.url);

  if (snapshot.status === 304) return;

  if (snapshot.status === 405) {
    await createCandidateAndReviewTask(item, "blocked_405");
    await enqueueOutbox("document.candidate_update_detected", item);
    return;
  }

  const normalized = normalizeOfficialPage(snapshot.html);
  const hashes = calculateHashes(snapshot, normalized);
  const existing = await findByCanonicalKey(item.sourceKey, item.canonicalKey);

  if (existing?.currentVersion?.contentHash === hashes.contentHash &&
      existing?.currentVersion?.attachmentSetHash === hashes.attachmentSetHash) {
    await updateLastSeen(existing.id);
    return;
  }

  await db.transaction(async (tx) => {
    const document = await upsertDocument(tx, item, normalized);
    const version = await insertImmutableVersion(tx, document, normalized, hashes);
    const decision = await resolveVersionRelation(tx, document, version);

    const canSwitchCurrent =
      canBecomeCurrent(version.extractionStatus, version.requiresManualReview) &&
      decision.confidence >= 0.95 &&
      ["supersedes", "annual_successor"].includes(decision.type);

    if (canSwitchCurrent) {
      await setCurrentVersion(tx, document.id, version.id);
      await markPreviousVersionInactive(tx, document.currentVersionId);
    }

    await insertOutboxEvent(tx, {
      type: canSwitchCurrent ? "document.superseded" : "document.content_updated",
      aggregateId: document.id,
      idempotencyKey: `${item.sourceKey}:${item.canonicalKey}:${hashes.contentHash}`,
      data: { document, version, decision, canSwitchCurrent }
    });
  });
}

async function consumeKnowledgeUpdate(event: HENUKitEvent): Promise<void> {
  await verifyHmacAndReplayWindow(event);
  if (await alreadyProcessed(event.id)) return;

  await db.transaction(async (tx) => {
    const version = await loadVersion(event.data.current_version_id ?? event.data.candidate_version_id);
    if (!canBecomeCurrent(version.extractionStatus, version.requiresManualReview)) {
      await createManualReviewTask(tx, version, "incomplete_content_cannot_index_as_current");
      return;
    }

    const chunks = semanticChunk(version.normalizedContent);
    await insertChunks(tx, version, chunks);

    if (event.type.endsWith("superseded.v1")) {
      await deactivateOldChunks(tx, version.documentId);
      await activateVersionChunks(tx, version.id);
    }

    await markEventProcessed(tx, event.id);
  });
}
