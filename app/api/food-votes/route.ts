import catalog from "../../../data/food-spots.normalized.json";
import { getRuntimeEnv } from "../../../db/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";
import { allFoodSpotIds, readImportedSpots } from "../../../lib/food-store";

const VERDICTS = ["underrated", "fair", "overrated"] as const;
type Verdict = (typeof VERDICTS)[number];
type Counts = Record<Verdict, number>;
const staticSpotIds = catalog.spots.map((spot) => spot.id);
const localVotes = new Map<string, Map<string, Verdict>>();

function emptyCounts(): Counts {
  return { underrated: 0, fair: 0, overrated: 0 };
}

async function voteState(email?: string) {
  const imported = await readImportedSpots();
  const state: Record<string, { counts: Counts; current: Verdict | null }> = Object.fromEntries(
    [...staticSpotIds, ...imported.map((spot) => spot.id)].map((spotId) => [spotId, { counts: emptyCounts(), current: null }]),
  );
  const db = getRuntimeEnv().DB;

  if (!db) {
    for (const [spotId, voters] of localVotes) {
      for (const [voter, verdict] of voters) {
        state[spotId].counts[verdict] += 1;
        if (email && voter === email.toLowerCase()) state[spotId].current = verdict;
      }
    }
    return state;
  }

  const aggregates = await db.prepare(
    "SELECT spot_id, verdict, COUNT(*) AS total FROM food_votes GROUP BY spot_id, verdict",
  ).all<{ spot_id: string; verdict: Verdict; total: number }>();
  for (const row of aggregates.results) {
    if (state[row.spot_id] && VERDICTS.includes(row.verdict)) state[row.spot_id].counts[row.verdict] = Number(row.total);
  }

  if (email) {
    const mine = await db.prepare("SELECT spot_id, verdict FROM food_votes WHERE voter_email = ?")
      .bind(email.toLowerCase())
      .all<{ spot_id: string; verdict: Verdict }>();
    for (const row of mine.results) if (state[row.spot_id]) state[row.spot_id].current = row.verdict;
  }
  return state;
}

export async function GET() {
  const user = await getChatGPTUser();
  try {
    return Response.json({ votes: await voteState(user?.email), canVote: Boolean(user), user: user ? { displayName: user.displayName } : null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取投票失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "登录后才能参与投票" }, { status: 401 });

  const payload = await request.json() as { spotId?: string; verdict?: Verdict };
  const spotIds = await allFoodSpotIds(staticSpotIds);
  if (!payload.spotId || !spotIds.has(payload.spotId) || !payload.verdict || !VERDICTS.includes(payload.verdict)) {
    return Response.json({ error: "无效的地点或投票选项" }, { status: 400 });
  }

  const email = user.email.toLowerCase();
  const db = getRuntimeEnv().DB;
  if (!db) {
    const voters = localVotes.get(payload.spotId) ?? new Map<string, Verdict>();
    voters.set(email, payload.verdict);
    localVotes.set(payload.spotId, voters);
  } else {
    await db.prepare(`
      INSERT INTO food_votes (spot_id, voter_email, verdict, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(spot_id, voter_email) DO UPDATE SET
        verdict = excluded.verdict,
        updated_at = CURRENT_TIMESTAMP
    `).bind(payload.spotId, email, payload.verdict).run();
  }

  return Response.json({ ok: true, votes: await voteState(user.email) });
}
