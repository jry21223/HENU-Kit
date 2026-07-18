import { readImportedSpots } from "../../../lib/food-store";

export async function GET() {
  try {
    return Response.json({ spots: await readImportedSpots() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取导入商家失败" }, { status: 500 });
  }
}
