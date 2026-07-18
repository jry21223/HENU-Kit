import { getChatGPTUser } from "../../chatgpt-auth";
import { normalizeFoodImport } from "../../../lib/food-import";
import { authorizeImport, isAdminUser } from "../../../lib/import-auth";
import { saveImportedSpots } from "../../../lib/food-store";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json({
    endpoint: "/api/food-import",
    method: "POST",
    canImport: isAdminUser(user),
    authentication: ["管理员登录", "Authorization: Bearer <IMPORT_API_KEY>"],
    limits: { maxBytes: 1_000_000, maxSpots: 100 },
    behavior: "相同 id 更新，不同 id 新增",
  });
}

export async function POST(request: Request) {
  const actor = await authorizeImport(request, await getChatGPTUser());
  if (!actor) return Response.json({ error: "需要管理员权限或有效的导入密钥" }, { status: 403 });

  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > 1_000_000) return Response.json({ error: "请求体不能超过 1 MB" }, { status: 413 });

  try {
    const spots = normalizeFoodImport(await request.json());
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";
    if (!dryRun) await saveImportedSpots(spots, actor);
    return Response.json({
      ok: true,
      dryRun,
      count: spots.length,
      ids: spots.map((spot) => spot.id),
      spots,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "导入失败" }, { status: 400 });
  }
}
