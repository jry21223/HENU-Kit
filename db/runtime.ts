export type HenuRuntimeEnv = {
  DB?: D1Database;
  ADMIN_EMAILS?: string;
  IMPORT_API_KEY?: string;
};

let runtimeEnv: HenuRuntimeEnv = {};

export function setRuntimeEnv(env: HenuRuntimeEnv) {
  runtimeEnv = env;
}

export function getRuntimeEnv() {
  return runtimeEnv;
}
