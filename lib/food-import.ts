export const FOOD_CAMPUSES = ["明伦", "金明", "龙子湖"] as const;
export const FOOD_TIERS = ["夯", "顶级", "人上人", "NPC", "拉完了"] as const;
export const FOOD_SOURCE_TYPES = ["government", "university", "merchant", "community"] as const;

type Campus = (typeof FOOD_CAMPUSES)[number];
type Tier = (typeof FOOD_TIERS)[number];
type SourceType = (typeof FOOD_SOURCE_TYPES)[number];

export type ImportedFoodSpot = {
  id: string;
  name: string;
  campus: Campus;
  tier: Tier;
  type: string;
  price: string;
  distance: string;
  address: string;
  hours: string;
  review: string;
  tags: string[];
  image: string;
  imageAlt: string;
  mapKeyword: string;
  map: string;
  verified: boolean;
  provenance: {
    type: SourceType;
    name: string;
    url: string;
    checkedAt: string;
    notes: string;
  };
  recommendReasons: string[];
  recommendedDishes: Array<{ name: string; note: string; image: string }>;
  environmentPhotos: Array<{ label: string; image: string }>;
  importedFields: string[];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} 必须是对象`);
  return value as UnknownRecord;
}

function text(value: unknown, field: string, fallback?: string) {
  const normalized = String(value ?? fallback ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${field} 不能为空`);
  return normalized;
}

function optionalText(value: unknown, fallback: string) {
  return String(value ?? fallback).normalize("NFKC").replace(/\s+/g, " ").trim() || fallback;
}

function httpsUrl(value: unknown, field: string) {
  const normalized = text(value, field);
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") throw new Error(`${field} 必须使用 https`);
  return parsed.toString();
}

function textList(value: unknown, field: string, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new Error(`${field} 必须是非空数组`);
  return value.map((item, index) => text(item, `${field}[${index}]`));
}

function campusMap(campus: Campus) {
  const maps: Record<Campus, string> = {
    明伦: "https://www.openstreetmap.org/export/embed.html?bbox=114.34%2C34.80%2C114.38%2C34.84&layer=mapnik&marker=34.82%2C114.36",
    金明: "https://www.openstreetmap.org/export/embed.html?bbox=114.28%2C34.79%2C114.33%2C34.84&layer=mapnik&marker=34.815%2C114.307",
    龙子湖: "https://www.openstreetmap.org/export/embed.html?bbox=113.76%2C34.77%2C113.85%2C34.84&layer=mapnik&marker=34.805%2C113.807",
  };
  return maps[campus];
}

export function normalizeFoodSpot(value: unknown, index = 0): ImportedFoodSpot {
  const raw = record(value, `spots[${index}]`);
  const id = text(raw.id, `spots[${index}].id`).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`${id}: id 只能使用小写字母、数字和短横线`);

  const name = text(raw.name, `${id}.name`);
  const campus = text(raw.campus, `${id}.campus`) as Campus;
  const tier = text(raw.tier, `${id}.tier`) as Tier;
  const sourceType = text(raw.sourceType, `${id}.sourceType`) as SourceType;
  if (!FOOD_CAMPUSES.includes(campus)) throw new Error(`${id}: 未知校区 ${campus}`);
  if (!FOOD_TIERS.includes(tier)) throw new Error(`${id}: 未知档位 ${tier}`);
  if (!FOOD_SOURCE_TYPES.includes(sourceType)) throw new Error(`${id}: 未知来源类型 ${sourceType}`);

  const checkedAt = text(raw.checkedAt, `${id}.checkedAt`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) || Number.isNaN(Date.parse(`${checkedAt}T00:00:00Z`))) {
    throw new Error(`${id}: checkedAt 必须是 YYYY-MM-DD`);
  }

  if (!Array.isArray(raw.recommendedDishes) || raw.recommendedDishes.length === 0) throw new Error(`${id}.recommendedDishes 必须是非空数组`);
  const recommendedDishes = raw.recommendedDishes.map((item, itemIndex) => {
    const dish = record(item, `${id}.recommendedDishes[${itemIndex}]`);
    return {
      name: text(dish.name, `${id}.recommendedDishes[${itemIndex}].name`),
      note: text(dish.note, `${id}.recommendedDishes[${itemIndex}].note`),
      image: httpsUrl(dish.image, `${id}.recommendedDishes[${itemIndex}].image`),
    };
  });

  if (!Array.isArray(raw.environmentPhotos) || raw.environmentPhotos.length === 0) throw new Error(`${id}.environmentPhotos 必须是非空数组`);
  const environmentPhotos = raw.environmentPhotos.map((item, itemIndex) => {
    const photo = record(item, `${id}.environmentPhotos[${itemIndex}]`);
    return {
      label: text(photo.label, `${id}.environmentPhotos[${itemIndex}].label`),
      image: httpsUrl(photo.image, `${id}.environmentPhotos[${itemIndex}].image`),
    };
  });

  const notes = text(raw.notes, `${id}.notes`);
  const address = optionalText(raw.address, "地址等待补充");
  return {
    id,
    name,
    campus,
    tier,
    type: optionalText(raw.type, "学生推荐 · 待核验"),
    price: optionalText(raw.price, "价格等待补充"),
    distance: optionalText(raw.distance, "距离等待补充"),
    address,
    hours: optionalText(raw.hours, "营业时间等待补充"),
    review: optionalText(raw.review, notes),
    tags: Array.isArray(raw.tags) ? textList(raw.tags, `${id}.tags`, true) : [],
    image: raw.image ? httpsUrl(raw.image, `${id}.image`) : recommendedDishes[0].image,
    imageAlt: optionalText(raw.imageAlt, `${name}的推荐菜品`),
    mapKeyword: optionalText(raw.mapKeyword, `${name} ${address}`),
    map: raw.map ? httpsUrl(raw.map, `${id}.map`) : campusMap(campus),
    verified: raw.verified === true,
    provenance: {
      type: sourceType,
      name: text(raw.sourceName, `${id}.sourceName`),
      url: httpsUrl(raw.sourceUrl, `${id}.sourceUrl`),
      checkedAt,
      notes,
    },
    recommendReasons: textList(raw.recommendReasons, `${id}.recommendReasons`),
    recommendedDishes,
    environmentPhotos,
    importedFields: ["type", "price", "distance", "address", "hours", "review", "tags", "image", "imageAlt", "mapKeyword", "map", "verified"]
      .filter((field) => Object.prototype.hasOwnProperty.call(raw, field)),
  };
}

export function normalizeFoodImport(value: unknown) {
  const container = Array.isArray(value) ? { spots: value } : record(value, "请求体");
  const candidates = Array.isArray(container.spots) ? container.spots : [container];
  if (candidates.length === 0 || candidates.length > 100) throw new Error("每次必须导入 1 到 100 家商户");
  const spots = candidates.map(normalizeFoodSpot);
  if (new Set(spots.map((spot) => spot.id)).size !== spots.length) throw new Error("本次导入中存在重复 id");
  return spots;
}
