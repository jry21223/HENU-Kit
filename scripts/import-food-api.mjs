import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const input = resolve(process.argv.find((arg) => arg.endsWith(".json")) || "data/food-spots.source.json");
const baseUrl = (process.env.HENU_API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const apiKey = process.env.HENU_IMPORT_API_KEY || "";
const dryRun = process.argv.includes("--dry-run");
const payload = await readFile(input, "utf8");
const response = await fetch(`${baseUrl}/api/food-import${dryRun ? "?dryRun=true" : ""}`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  },
  body: payload,
});
const result = await response.json();
if (!response.ok) {
  console.error(result);
  process.exit(1);
}
console.log(`${dryRun ? "校验" : "导入"}成功：${result.count} 家商户`);
console.log(result.ids.join("\n"));
