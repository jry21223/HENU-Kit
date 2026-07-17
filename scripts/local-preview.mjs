import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const clientRoot = join(root, "dist", "client");
const workerUrl = pathToFileURL(join(root, "dist", "server", "index.js"));
workerUrl.searchParams.set("preview", Date.now().toString());
const { default: worker } = await import(workerUrl.href);
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function safeAssetPath(url) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  const relative = normalize(pathname).replace(/^([/\\])+/, "");
  const candidate = join(clientRoot, relative);
  return candidate.startsWith(clientRoot) ? candidate : null;
}

async function readAsset(request) {
  const candidate = safeAssetPath(request.url);
  if (!candidate) return null;
  try {
    const info = await stat(candidate);
    if (!info.isFile()) return null;
    const body = await readFile(candidate);
    return new Response(body, {
      headers: {
        "content-type": contentTypes[extname(candidate).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-cache",
      },
    });
  } catch {
    return null;
  }
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://${incoming.headers.host || `127.0.0.1:${port}`}`;
    const url = new URL(incoming.url || "/", origin);
    const headers = new Headers(incoming.headers);
    headers.set("oai-authenticated-user-email", "local-admin@henu-kit.local");
    headers.set("oai-authenticated-user-full-name", encodeURIComponent("本地管理员"));
    headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
    const method = incoming.method || "GET";
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      duplex: body ? "half" : undefined,
    });
    const assetResponse = await readAsset(request);
    const response = assetResponse || await worker.fetch(
      request,
      { ASSETS: { fetch: async (assetRequest) => (await readAsset(assetRequest)) || new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );

    outgoing.statusCode = response.status;
    for (const [name, value] of response.headers) outgoing.setHeader(name, value);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.statusCode = 500;
    outgoing.end("Local preview error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`HENU Kit local preview: http://127.0.0.1:${port}`);
});
