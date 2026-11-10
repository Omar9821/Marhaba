export const MONTHS = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function num(n: number, digits = 0) {
  const v = Number.isFinite(n) ? n : 0;
  const fixed = Math.abs(v).toFixed(digits);
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  // العزل الاتجاهي (LRI…PDI): يمنع النص العربي من عكس ترتيب مجموعات الأرقام داخل الأسطر RTL (مثل «9 036 دج»)
  return "\u2066" + (v < 0 ? "-" : "") + grouped + (dec && Number(dec) !== 0 ? "." + dec : "") + "\u2069";
}
export function money(n: number, currency = "دج") {
  return `${num(Math.round(n))} ${currency}`;
}
const pad = (n: number) => String(n).padStart(2, "0");
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function currentMonth() {
  return todayISO().slice(0, 7);
}
export function shiftDay(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}
export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
export function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]}`;
}
export const DEDUCTION_LABEL: Record<string, string> = { points: "خصم نقاط", percent: "نسبة من المنحة", amount: "مبلغ مالي" };
export function deductionText(type: string, value: number, currency = "دج") {
  if (type === "points") return `-${num(value, 1)} نقطة`;
  if (type === "percent") return `-${num(value, 1)}% من المنحة`;
  return `-${money(value, currency)}`;
}
