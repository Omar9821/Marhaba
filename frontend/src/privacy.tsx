import { useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

// «وضع الخصوصية» على هذا الجهاز: يُخفي رقم أعمال الشركة والمجمَّع (مثلاً عند وجود غرباء أمام الشاشة).
const KEY = "privacy_hide";
let hidden = false;
const listeners = new Set<(v: boolean) => void>();
storage.getItem(KEY, null).then((v) => {
  hidden = v === "1";
  listeners.forEach((l) => l(hidden));
}).catch(() => {});

export function setPrivacy(v: boolean) {
  hidden = v;
  storage.setItem(KEY, v ? "1" : "0").catch(() => {});
  listeners.forEach((l) => l(v));
}

export function usePrivacy(): boolean {
  const [v, setV] = useState(hidden);
  useEffect(() => {
    listeners.add(setV);
    setV(hidden);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

export const MASK = "••••••";
