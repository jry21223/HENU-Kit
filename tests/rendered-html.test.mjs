import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the HENU student guide", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>河大新生手册｜HENU Kit<\/title>/i);
  assert.match(html, /把日子过明白/);
  assert.match(html, /新生第一周/);
  assert.match(html, /美食地图/);
  assert.match(html, /HENU Assistant/);
  assert.match(html, /openstreetmap\.org\/export\/embed/);
});

test("does not ship the disposable starter preview", async () => {
  const response = await render();
  const html = await response.text();
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
