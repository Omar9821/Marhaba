import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

export type PickedFile = { name: string; type: string; data: string; size: number };
const MAX = 5 * 1024 * 1024;

/** يختار ملفات (صور/مستندات) ويعيدها base64 — يعمل على الويب والجوال. */
export async function pickFiles(): Promise<PickedFile[]> {
  const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ["image/*", "application/pdf", "application/*", "text/*"] });
  if (r.canceled) return [];
  const out: PickedFile[] = [];
  for (const a of r.assets) {
    if ((a.size ?? 0) > MAX) throw new Error(`الملف ${a.name} أكبر من 5 ميغابايت`);
    const blob = await (await fetch(a.uri)).blob();
    const data = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1] || "");
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    out.push({ name: a.name, type: a.mimeType || "application/octet-stream", data, size: a.size ?? 0 });
  }
  return out;
}

/** يفتح/ينزّل ملفًا مستلمًا (base64) على الويب. */
export function saveFile(name: string, type: string, b64: string) {
  if (Platform.OS !== "web") return;
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
