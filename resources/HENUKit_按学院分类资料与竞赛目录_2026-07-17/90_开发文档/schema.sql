-- HENUKit PostgreSQL schema (simplified production baseline)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text UNIQUE NOT NULL,
  name text NOT NULL,
  base_url text NOT NULL,
  list_url text NOT NULL,
  adapter_type text NOT NULL,
  check_interval_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'active',
  etag text,
  last_modified text,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crawl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  http_status integer,
  discovered_count integer DEFAULT 0,
  changed_count integer DEFAULT 0,
  error_message text
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id),
  canonical_key text NOT NULL,
  policy_family_key text,
  issuer text,
  college_code text,
  category text NOT NULL,
  policy_type text,
  audience text[] NOT NULL DEFAULT '{}',
  lifecycle_status text NOT NULL DEFAULT 'active',
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, canonical_key)
);

CREATE TABLE document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id),
  version_number integer NOT NULL,
  title text NOT NULL,
  source_url text NOT NULL,
  published_at timestamptz,
  effective_from date,
  effective_until date,
  validity_status text NOT NULL DEFAULT 'candidate',
  extraction_status text NOT NULL,
  raw_hash text,
  content_hash text,
  metadata_hash text,
  attachment_set_hash text,
  raw_html_path text,
  normalized_content text,
  parser_version text,
  replacement_confidence numeric(5,4),
  requires_manual_review boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_number)
);

ALTER TABLE documents
  ADD CONSTRAINT fk_current_version
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id);

CREATE TABLE document_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_version_id uuid NOT NULL REFERENCES document_versions(id),
  to_version_id uuid NOT NULL REFERENCES document_versions(id),
  relation_type text NOT NULL CHECK (relation_type IN
    ('supersedes','supplements','amends','withdraws','annual_successor','mirrors')),
  confidence numeric(5,4),
  decided_by text NOT NULL CHECK (decided_by IN ('rule','human','model_assist')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_version_id,to_version_id,relation_type)
);

CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id uuid NOT NULL REFERENCES document_versions(id),
  logical_name text,
  original_name text,
  source_url text NOT NULL,
  mime_type text,
  file_size bigint,
  sha256 text,
  storage_path text,
  extraction_status text NOT NULL DEFAULT 'pending',
  extracted_text text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_version_id, source_url)
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_pending ON outbox_events(status, available_at);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES outbox_events(id),
  endpoint text NOT NULL,
  attempt integer NOT NULL,
  request_at timestamptz NOT NULL DEFAULT now(),
  response_status integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  UNIQUE(event_id, endpoint, attempt)
);

CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id),
  version_id uuid NOT NULL REFERENCES document_versions(id),
  chunk_index integer NOT NULL,
  heading_path text[],
  content text NOT NULL,
  content_hash text NOT NULL,
  embedding vector(1536),
  is_current boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, chunk_index)
);

CREATE INDEX idx_chunks_current ON knowledge_chunks(document_id, is_current);

CREATE TABLE manual_review_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  source_id uuid REFERENCES sources(id),
  document_id uuid REFERENCES documents(id),
  version_id uuid REFERENCES document_versions(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  assigned_to text,
  resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
