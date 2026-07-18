import { getChatGPTUser } from "../../chatgpt-auth";
import { getRuntimeEnv } from "../../../db/runtime";
import { allFoodSpotIds } from "../../../lib/food-store";

const TIERS = ["夯", "顶级", "人上人", "NPC", "拉完了"] as const;
type Tier = (typeof TIERS)[number];

const DEFAULT_RANKINGS: Record<string, Tier> = {
  gulou: "夯",
  xisi: "顶级",
  diyilou: "人上人",
  "minglun-canteen": "NPC",
  "jinming-canteen": "NPC",
  longzihu: "拉完了",
};

const localRankings = new Map(Object.entries(DEFAULT_RANKINGS));

function database() {
  return getRuntimeEnv().DB;
}

function adminEmails() {
  const value = getRuntimeEnv().ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function isAdmin(email: string | null | undefined, hasDatabase: boolean) {
  if (!email) return false;
  const normalized = email.toLowerCase();
  if (!hasDatabase && normalized === "local-admin@henu-kit.local") return true;
  return adminEmails().has(normalized);
}

async function readRankings(db: D1Database | undefined) {
  if (!db) return Object.fromEntries(localRankings);

  const result = await db.prepare("SELECT spot_id, tier FROM food_rankings ORDER BY position ASC").all<{ spot_id: string; tier: Tier }>();
  return { ...DEFAULT_RANKINGS, ...Object.fromEntries(result.results.map((row) => [row.spot_id, row.tier])) };
}

export async function GET() {
  const user = await getChatGPTUser();
  try {
    const db = database();
    return Response.json({
      rankings: await readRankings(db),
      canEdit: isAdmin(user?.email, Boolean(db)),
      user: user ? { displayName: user.displayName, email: user.email } : null,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取榜单失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录管理员账号" }, { status: 401 });
  const db = database();
  if (!isAdmin(user.email, Boolean(db))) return Response.json({ error: "当前账号没有管理员权限" }, { status: 403 });

  const payload = await request.json() as { spotId?: string; tier?: Tier; position?: number };
  const spotIds = await allFoodSpotIds(Object.keys(DEFAULT_RANKINGS));
  if (!payload.spotId || !spotIds.has(payload.spotId) || !payload.tier || !TIERS.includes(payload.tier)) {
    return Response.json({ error: "无效的商家或档位" }, { status: 400 });
  }

  const position = Number.isFinite(payload.position) ? Math.max(0, Math.floor(payload.position ?? 0)) : 0;
  if (!db) {
    localRankings.set(payload.spotId, payload.tier);
  } else {
    await db.prepare(`
      INSERT INTO food_rankings (spot_id, tier, position, updated_at, updated_by)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(spot_id) DO UPDATE SET
        tier = excluded.tier,
        position = excluded.position,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = excluded.updated_by
    `).bind(payload.spotId, payload.tier, position, user.email).run();
  }

  return Response.json({ ok: true, spotId: payload.spotId, tier: payload.tier, position });
}
