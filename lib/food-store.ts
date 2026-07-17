import { getRuntimeEnv } from "../db/runtime";
import type { ImportedFoodSpot } from "./food-import";

const localImportedSpots = new Map<string, ImportedFoodSpot>();

export async function readImportedSpots(): Promise<ImportedFoodSpot[]> {
  const db = getRuntimeEnv().DB;
  if (!db) return [...localImportedSpots.values()];
  const result = await db.prepare("SELECT payload FROM food_spots ORDER BY updated_at DESC").all<{ payload: string }>();
  return result.results.flatMap((row) => {
    try { return [JSON.parse(row.payload) as ImportedFoodSpot]; } catch { return []; }
  });
}

export async function saveImportedSpots(spots: ImportedFoodSpot[], actor: string) {
  const db = getRuntimeEnv().DB;
  if (!db) {
    for (const spot of spots) localImportedSpots.set(spot.id, spot);
    return;
  }
  await db.batch(spots.map((spot) => db.prepare(`
    INSERT INTO food_spots (id, payload, updated_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = excluded.updated_by
  `).bind(spot.id, JSON.stringify(spot), actor)));
}

export async function allFoodSpotIds(staticIds: string[]) {
  return new Set([...staticIds, ...(await readImportedSpots()).map((spot) => spot.id)]);
}
