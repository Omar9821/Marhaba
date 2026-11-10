import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { deductionText, monthLabel, money, num } from "@/src/format";
import { themes } from "@/src/theme";
import { CompanyReport, Report } from "@/src/types";

const c = themes.light;
const css = `
  body{font-family: Tahoma, Arial, sans-serif; direction: rtl; color:${c.onSurface}; padding:24px; font-size:12px}
  h1{color:${c.brand}; margin:0 0 4px; font-size:22px} h2{color:${c.brand}; font-size:15px; margin:18px 0 8px}
  .muted{color:${c.muted}} table{width:100%; border-collapse:collapse; margin-top:6px}
  th{background:${c.brandTertiary}; color:${c.brand}; padding:7px; text-align:right; font-size:11px}
  td{padding:7px; border-bottom:1px solid ${c.border}; text-align:right}
  .box{background:${c.surfaceSecondary}; border:1px solid ${c.border}; border-radius:10px; padding:12px; margin-top:10px}
  .big{font-size:26px; color:${c.brand}; font-weight:bold} .bad{color:${c.error}} .good{color:${c.success}}
  .hdr{display:flex; justify-content:space-between; border-bottom:3px solid ${c.brand}; padding-bottom:10px; margin-bottom:10px}
`;

function wrap(title: string, body: string) {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>${title}</title><style>${css}</style></head><body>${body}
  <p class="muted" style="margin-top:24px">تم إنشاء هذا الكشف آلياً بواسطة تطبيق مسار الأداء — ${new Date().toLocaleDateString("fr-DZ")}</p></body></html>`;
}

export function employeeHtml(r: Report, currency = "دج") {
  const kpis = r.kpis
    .map((k) => `<tr><td>${k.name}</td><td>${num(k.weight)}%</td><td>${num(k.target, 2)} ${k.unit}</td><td>${num(k.achieved, 2)} ${k.unit}</td><td>${num(k.ratio, 1)}%</td><td>${num(k.weighted, 1)}</td></tr>`)
    .join("");
  const infs = r.infractions.length
    ? r.infractions.map((i) => `<tr><td>${i.date}</td><td>${i.type_name}</td><td class="bad">${deductionText(i.deduction_type, i.value, currency)}</td></tr>`).join("")
    : `<tr><td colspan="3" class="good">لا توجد مخالفات مسجلة</td></tr>`;
  const body = `
  <div class="hdr"><div><h1>كشف المنحة والمردودية</h1><div class="muted">${monthLabel(r.month)}</div></div>
  <div><b>${r.employee.full_name}</b><div class="muted">${r.employee.position_name}</div></div></div>
  <div class="box"><div class="muted">المنحة النهائية المستحقة</div><div class="big">${money(r.final_bonus, currency)}</div>
  <div>نسبة الأداء: <b>${num(r.score, 1)}%</b> — الراتب الأساسي: <b>${money(r.employee.base_salary, currency)}</b> — أيام مسجلة: ${r.days_recorded}</div>
  ${r.eligible ? "" : `<div class="bad">غير مؤهل للمنحة: ${r.ineligible_reason}</div>`}</div>
  <h2>مؤشرات الأداء</h2><table><tr><th>المؤشر</th><th>الوزن</th><th>المستهدف</th><th>المحقق</th><th>نسبة التحقيق</th><th>النقاط</th></tr>${kpis}</table>
  <h2>المخالفات والخصومات (${r.infractions_count})</h2><table><tr><th>التاريخ</th><th>المخالفة</th><th>الأثر</th></tr>${infs}</table>
  <h2>تفاصيل الحساب</h2><table>
  <tr><td>نسبة الأداء المرجحة</td><td>${num(r.score, 1)}</td></tr>
  <tr><td>خصم نقاط المخالفات</td><td class="bad">-${num(r.points_deduction, 1)}</td></tr>
  <tr><td>النقاط الصافية</td><td>${num(r.effective_score, 1)}</td></tr>
  <tr><td>المنحة الخام</td><td>${money(r.gross_bonus, currency)}</td></tr>
  <tr><td>خصم نسبة مئوية (${num(r.percent_deduction, 1)}%)</td><td class="bad">-${money(r.percent_amount, currency)}</td></tr>
  <tr><td>خصومات مالية مباشرة</td><td class="bad">-${money(r.amount_deduction, currency)}</td></tr>
  <tr><td>المنحة الصافية${r.capped ? " (بعد تطبيق السقف)" : ""}</td><td>${money(r.net_bonus, currency)}</td></tr>
  <tr><td>مساهمة صندوق الترفيه</td><td class="bad">-${money(r.fund_share, currency)}</td></tr>
  <tr><td>المنحة التنافسية</td><td class="good">+${money(r.competitive_bonus, currency)}</td></tr>
  <tr><th>المنحة النهائية</th><th>${money(r.final_bonus, currency)}</th></tr></table>`;
  return wrap(`كشف ${r.employee.full_name}`, body);
}

export function companyHtml(rep: CompanyReport) {
  const cur = rep.settings.currency;
  const rows = rep.employees
    .map((r, i) => `<tr><td>${i + 1}</td><td>${r.employee.full_name}</td><td>${r.employee.position_name}</td><td>${money(r.employee.base_salary, cur)}</td>
    <td>${num(r.score, 1)}%</td><td>${r.infractions_count}</td><td>${money(r.net_bonus, cur)}</td><td>${money(r.competitive_bonus, cur)}</td>
    <td><b>${money(r.final_bonus, cur)}</b></td><td>${money(r.employee.base_salary + r.final_bonus, cur)}</td></tr>`)
    .join("");
  const t = rep.totals;
  const body = `
  <div class="hdr"><div><h1>كشف الرواتب والمنح — الشركة</h1><div class="muted">${monthLabel(rep.month)}</div></div></div>
  <div class="box">عدد الموظفين: <b>${t.employees}</b> — متوسط الأداء: <b>${num(t.avg_score, 1)}%</b> — إجمالي المخالفات: <b>${t.infractions}</b><br/>
  إجمالي المنح: <b>${money(t.final_bonus, cur)}</b> — صندوق الترفيه: <b>${money(t.recreation_fund, cur)}</b> — المنح التنافسية: <b>${money(t.competitive_pool, cur)}</b></div>
  <h2>تفاصيل الموظفين</h2><table><tr><th>#</th><th>الموظف</th><th>المنصب</th><th>الراتب الأساسي</th><th>الأداء</th><th>المخالفات</th><th>المنحة الصافية</th><th>التنافسية</th><th>المنحة النهائية</th><th>الإجمالي المستحق</th></tr>${rows}
  <tr><th colspan="3">المجموع</th><th>${money(t.base_salaries, cur)}</th><th></th><th>${t.infractions}</th><th></th><th></th><th>${money(t.final_bonus, cur)}</th><th>${money(t.base_salaries + t.final_bonus, cur)}</th></tr></table>`;
  return wrap("كشف الشركة", body);
}

export async function exportPdf(html: string) {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "مشاركة الكشف" });
  } else {
    await Print.printAsync({ uri });
  }
}
