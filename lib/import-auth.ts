import { getRuntimeEnv } from "../db/runtime";
import type { ChatGPTUser } from "../app/chatgpt-auth";

function adminEmails() {
  const value = getRuntimeEnv().ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function isAdminUser(user: ChatGPTUser | null) {
  if (!user) return false;
  const email = user.email.toLowerCase();
  if (!getRuntimeEnv().DB && email === "local-admin@henu-kit.local") return true;
  return adminEmails().has(email);
}

async function sameSecret(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export async function authorizeImport(request: Request, user: ChatGPTUser | null) {
  if (isAdminUser(user)) return user?.email ?? "admin";
  const expected = getRuntimeEnv().IMPORT_API_KEY ?? process.env.IMPORT_API_KEY;
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (expected && provided && await sameSecret(provided, expected)) return "api-key";
  return null;
}
