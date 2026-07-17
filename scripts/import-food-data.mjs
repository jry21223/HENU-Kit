import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(process.argv.find((arg) => arg.endsWith(".json")) || "data/food-spots.source.json");
const outputPath = resolve("data/food-spots.normalized.json");
const checkOnly = process.argv.includes("--check");
const campuses = new Set(["明伦", "金明", "龙子湖"]);
const tiers = new Set(["夯", "顶级", "人上人", "NPC", "拉完了"]);
const sourceTypes = new Set(["government", "university", "merchant", "community"]);

function text(value, field, id) {
  const normalized = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${id}: ${field} 不能为空`);
  return normalized;
}

function url(value, field, id) {
  const normalized = text(value, field, id);
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") throw new Error(`${id}: ${field} 必须使用 https`);
  return parsed.toString();
}

function date(value, id) {
  const normalized = text(value, "checkedAt", id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new Error(`${id}: checkedAt 必须是 YYYY-MM-DD`);
  }
  return normalized;
}

function textList(value, field, id) {
  if (!Array.isArray(value) || value.length < 1) throw new Error(`${id}: ${field} 至少需要一项`);
  return value.map((item, index) => text(item, `${field}[${index}]`, id));
}

function mediaList(value, field, id, includeNote = false) {
  if (!Array.isArray(value) || value.length < 1) throw new Error(`${id}: ${field} 至少需要一项`);
  return value.map((item, index) => ({
    ...(field === "recommendedDishes" ? { name: text(item.name, `${field}[${index}].name`, id) } : {}),
    ...(includeNote ? { note: text(item.note, `${field}[${index}].note`, id) } : { label: text(item.label, `${field}[${index}].label`, id) }),
    image: url(item.image, `${field}[${index}].image`, id),
  }));
}

const source = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(source.spots)) throw new Error("spots 必须是数组");

const ids = new Set();
const spots = source.spots.map((raw, index) => {
  const id = text(raw.id, "id", `第 ${index + 1} 条`).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`${id}: id 只能使用小写字母、数字和单连字符`);
  if (ids.has(id)) throw new Error(`${id}: id 重复`);
  ids.add(id);

  const campus = text(raw.campus, "campus", id);
  const tier = text(raw.tier, "tier", id);
  const sourceType = text(raw.sourceType, "sourceType", id);
  if (!campuses.has(campus)) throw new Error(`${id}: 未知校区 ${campus}`);
  if (!tiers.has(tier)) throw new Error(`${id}: 未知档位 ${tier}`);
  if (!sourceTypes.has(sourceType)) throw new Error(`${id}: 未知来源类型 ${sourceType}`);

  return {
    id,
    name: text(raw.name, "name", id),
    campus,
    tier,
    provenance: {
      type: sourceType,
      name: text(raw.sourceName, "sourceName", id),
      url: url(raw.sourceUrl, "sourceUrl", id),
      checkedAt: date(raw.checkedAt, id),
      notes: text(raw.notes, "notes", id),
    },
    recommendReasons: textList(raw.recommendReasons, "recommendReasons", id),
    recommendedDishes: mediaList(raw.recommendedDishes, "recommendedDishes", id, true),
    environmentPhotos: mediaList(raw.environmentPhotos, "environmentPhotos", id),
  };
}).sort((a, b) => a.id.localeCompare(b.id, "en"));

const normalized = `${JSON.stringify({ version: Number(source.version) || 1, spots }, null, 2)}\n`;
if (checkOnly) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== normalized) {
    console.error("规范化数据已过期，请运行 npm run food:import");
    process.exit(1);
  }
  console.log(`数据检查通过：${spots.length} 个地点，来源完整且无重复。`);
} else {
  await writeFile(outputPath, normalized, "utf8");
  console.log(`已导入并规范化 ${spots.length} 个地点 -> ${outputPath}`);
}
