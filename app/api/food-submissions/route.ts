import { getRuntimeEnv } from "../../../db/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

type SubmissionPayload = {
  name: string;
  campus: "明伦" | "金明" | "龙子湖" | "其他";
  address: string;
  mapUrl: string | null;
  price: string | null;
  hours: string | null;
  reasons: string;
  dishes: string;
  photoUrls: string[];
  visitedAt: string;
};

type LocalSubmission = {
  id: number;
  submitterEmail: string;
  payload: SubmissionPayload;
  status: "pending";
  createdAt: string;
};

const localSubmissions: LocalSubmission[] = [];
const CAMPUSES = ["明伦", "金明", "龙子湖", "其他"] as const;

function requiredText(value: unknown, field: string, maxLength: number) {
  const normalized = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${field}不能为空`);
  if (normalized.length > maxLength) throw new Error(`${field}不能超过 ${maxLength} 个字符`);
  return normalized;
}

function optionalText(value: unknown, maxLength: number) {
  const normalized = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) throw new Error(`补充信息不能超过 ${maxLength} 个字符`);
  return normalized || null;
}

function optionalHttpsUrl(value: unknown, field: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") throw new Error(`${field}必须是 https 链接`);
  return parsed.toString();
}

function normalizePayload(value: unknown): SubmissionPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("提交内容格式不正确");
  const raw = value as Record<string, unknown>;
  const campus = requiredText(raw.campus, "校区", 12) as SubmissionPayload["campus"];
  if (!CAMPUSES.includes(campus)) throw new Error("请选择有效校区");
  if (raw.confirmed !== true) throw new Error("请先确认内容来自真实体验且不含敏感信息");
  const rawPhotos = Array.isArray(raw.photoUrls) ? raw.photoUrls : [];
  if (rawPhotos.length > 6) throw new Error("照片链接最多填写 6 个");
  return {
    name: requiredText(raw.name, "商家名称", 80),
    campus,
    address: requiredText(raw.address, "具体位置", 200),
    mapUrl: optionalHttpsUrl(raw.mapUrl, "地图链接"),
    price: optionalText(raw.price, 80),
    hours: optionalText(raw.hours, 120),
    reasons: requiredText(raw.reasons, "推荐理由", 1200),
    dishes: requiredText(raw.dishes, "推荐菜品", 800),
    photoUrls: rawPhotos.map((url, index) => optionalHttpsUrl(url, `第 ${index + 1} 个照片链接`)).filter((url): url is string => Boolean(url)),
    visitedAt: requiredText(raw.visitedAt, "最近到店时间", 40),
  };
}

function publicSubmission(row: { id: number; payload: SubmissionPayload; status: string; createdAt: string }) {
  return { id: row.id, name: row.payload.name, campus: row.payload.campus, status: row.status, createdAt: row.createdAt };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ canSubmit: false, submissions: [] });
  const email = user.email.toLowerCase();
  const db = getRuntimeEnv().DB;
  if (!db) return Response.json({ canSubmit: true, submissions: localSubmissions.filter((row) => row.submitterEmail === email).map(publicSubmission) });
  const result = await db.prepare(`
    SELECT id, payload, status, created_at FROM food_submissions
    WHERE submitter_email = ? ORDER BY created_at DESC LIMIT 10
  `).bind(email).all<{ id: number; payload: string; status: string; created_at: string }>();
  return Response.json({
    canSubmit: true,
    submissions: result.results.flatMap((row) => {
      try { return [publicSubmission({ id: row.id, payload: JSON.parse(row.payload), status: row.status, createdAt: row.created_at })]; }
      catch { return []; }
    }),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "登录后才能投稿" }, { status: 401 });
  const email = user.email.toLowerCase();
  const db = getRuntimeEnv().DB;
  try {
    const payload = normalizePayload(await request.json());
    if (!db) {
      const recentCount = localSubmissions.filter((row) => row.submitterEmail === email && Date.now() - Date.parse(row.createdAt) < 86_400_000).length;
      if (recentCount >= 10) return Response.json({ error: "今天提交得有点多，请明天再试" }, { status: 429 });
      const submission: LocalSubmission = { id: Date.now(), submitterEmail: email, payload, status: "pending", createdAt: new Date().toISOString() };
      localSubmissions.unshift(submission);
      return Response.json({ ok: true, submission: publicSubmission(submission) });
    }
    const recent = await db.prepare(`
      SELECT COUNT(*) AS total FROM food_submissions
      WHERE submitter_email = ? AND created_at >= datetime('now', '-1 day')
    `).bind(email).first<{ total: number }>();
    if (Number(recent?.total ?? 0) >= 10) return Response.json({ error: "今天提交得有点多，请明天再试" }, { status: 429 });
    const result = await db.prepare(`
      INSERT INTO food_submissions (submitter_email, payload, status, created_at)
      VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
    `).bind(email, JSON.stringify(payload)).run();
    return Response.json({ ok: true, submission: publicSubmission({ id: Number(result.meta.last_row_id), payload, status: "pending", createdAt: new Date().toISOString() }) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "投稿失败" }, { status: 400 });
  }
}
