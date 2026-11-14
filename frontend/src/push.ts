import { Platform } from "react-native";

import { api } from "@/src/api";

export type PushState = "unsupported" | "needs-install" | "unavailable" | "denied" | "enabled" | "disabled";

const w: any = Platform.OS === "web" && typeof window !== "undefined" ? window : null;

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () => !!w && /iphone|ipad|ipod/i.test(w.navigator.userAgent);
const standalone = () => !!w && (w.matchMedia?.("(display-mode: standalone)").matches || (w.navigator as any).standalone === true);

async function registration() {
  return w.navigator.serviceWorker.register("/sw.js");
}

/** حالة الإشعارات على هذا الجهاز. */
export async function pushState(): Promise<PushState> {
  if (!w || !("serviceWorker" in w.navigator) || !("PushManager" in w) || !("Notification" in w)) {
    return isIOS() && !standalone() ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  try {
    const { key } = await api.get("/push/key");
    if (!key) return "unavailable";
    const reg = await w.navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    return Notification.permission === "granted" && sub ? "enabled" : "disabled";
  } catch {
    return "disabled";
  }
}

/** يطلب الإذن ويسجّل اشتراك هذا الجهاز في الخادم. */
export async function enablePush(): Promise<PushState> {
  if (!w) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "disabled";
  const { key } = await api.get("/push/key");
  if (!key) return "unavailable";
  const reg = await registration();
  await w.navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  const j = sub.toJSON();
  await api.post("/push/subscribe", { endpoint: j.endpoint, keys: j.keys });
  return "enabled";
}

export async function disablePush(): Promise<PushState> {
  if (!w) return "unsupported";
  const reg = await w.navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return "disabled";
}

/** عند فتح التطبيق: إن كان الإذن ممنوحًا سابقًا يُعاد تسجيل الاشتراك بصمت (يغطي تغيّر الحساب على الجهاز). */
export async function syncPush() {
  if (!w || !("serviceWorker" in w.navigator) || !("Notification" in w) || Notification.permission !== "granted") return;
  try { await enablePush(); } catch {}
}
