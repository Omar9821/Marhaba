import NetInfo from "@react-native-community/netinfo";

import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const TOKEN_KEY = "auth_token";
const OUTBOX_KEY = "outbox_v1";
const CACHE_PREFIX = "cache_v1_";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export class NetworkError extends Error {}

export function uid() {
  return Date.now().toString(16) + Math.random().toString(16).slice(2, 12);
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}
export async function loadToken() {
  token = (await storage.secureGet(TOKEN_KEY, null)) as string | null;
  return token;
}
export async function setToken(t: string | null) {
  token = t;
  if (t) await storage.secureSet(TOKEN_KEY, t);
  else await storage.secureRemove(TOKEN_KEY);
}

async function raw(method: string, path: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError("لا يوجد اتصال بالإنترنت");
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && !path.startsWith("/auth/login")) {
    await setToken(null);
    onUnauthorized?.();
  }
  if (!res.ok) {
    const d = data?.detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? "بيانات غير صالحة، تحقق من الحقول" : "حدث خطأ غير متوقع";
    throw new ApiError(msg, res.status);
  }
  return data;
}

export const api = {
  get: (p: string) => raw("GET", p),
  post: (p: string, b?: unknown) => raw("POST", p, b ?? {}),
  put: (p: string, b: unknown) => raw("PUT", p, b),
  del: (p: string) => raw("DELETE", p),
};

// ---- read cache (offline-first reads) ----
export async function setCache(path: string, data: unknown) {
  await storage.setItem(CACHE_PREFIX + path, JSON.stringify(data));
}
export async function getCached<T = any>(path: string): Promise<{ data: T; offline: boolean }> {
  try {
    const data = await raw("GET", path);
    await setCache(path, data);
    return { data, offline: false };
  } catch (e) {
    if (e instanceof NetworkError) {
      const c = (await storage.getItem(CACHE_PREFIX + path, null)) as string | null;
      if (c) return { data: JSON.parse(c), offline: true };
    }
    throw e;
  }
}

// ---- outbox (offline-first writes, replayed in order) ----
type Op = { id: string; method: string; path: string; body?: unknown };
const outboxListeners = new Set<(n: number) => void>();
const onlineListeners = new Set<(o: boolean) => void>();
let online = true;

async function getOutbox(): Promise<Op[]> {
  const s = (await storage.getItem(OUTBOX_KEY, "[]")) as string;
  try {
    return JSON.parse(s || "[]");
  } catch {
    return [];
  }
}
async function saveOutbox(ops: Op[]) {
  await storage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  outboxListeners.forEach((l) => l(ops.length));
}

export async function mutate(method: string, path: string, body?: unknown): Promise<{ queued: boolean; data?: any }> {
  const pending = await getOutbox();
  if (pending.length === 0) {
    try {
      return { queued: false, data: await raw(method, path, body) };
    } catch (e) {
      if (!(e instanceof NetworkError)) throw e;
    }
  }
  await saveOutbox([...pending, { id: uid(), method, path, body }]);
  return { queued: true };
}

let flushing = false;
export async function flushOutbox() {
  if (flushing || !token) return;
  flushing = true;
  try {
    let ops = await getOutbox();
    while (ops.length) {
      try {
        await raw(ops[0].method, ops[0].path, ops[0].body);
      } catch (e) {
        if (e instanceof NetworkError) break;
        // server rejected the op (e.g. deleted record) – drop it so the queue keeps moving
      }
      ops = ops.slice(1);
      await saveOutbox(ops);
    }
  } finally {
    flushing = false;
  }
}

export function subscribeOutbox(fn: (n: number) => void) {
  outboxListeners.add(fn);
  getOutbox().then((o) => fn(o.length));
  return () => {
    outboxListeners.delete(fn);
  };
}
export function subscribeOnline(fn: (o: boolean) => void) {
  onlineListeners.add(fn);
  fn(online);
  return () => {
    onlineListeners.delete(fn);
  };
}

NetInfo.addEventListener((s) => {
  const next = s.isConnected !== false;
  if (next !== online) {
    online = next;
    onlineListeners.forEach((l) => l(online));
  }
  if (next) flushOutbox();
});
