import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mutate } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CalcCell, CellInput } from "@/src/components/sheet-ui";
import { currentMonth, money, num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { MASK, usePrivacy } from "@/src/privacy";
import { Sheet, SheetRow, typeBaseLabel, typeLabel, typeOf } from "@/src/types";
import { Card, EmptyState, ErrorView, Header, LineItem, Loading, MonthSwitcher, Pill, R, Row, S, SyncBadge, T, useToast } from "@/src/ui";

const pct = (v: number | null, d = 1) => (v === null || v === undefined ? "—" : `${num(v * 100, d)}%`);
const dz = (v: number | null) => (v === null || v === undefined ? "—" : money(v));

export default function SheetScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const perms = user?.perms ?? {};
  const canEditTurnover = isAdmin || !!perms.edit_turnover;
  const canEditBase = isAdmin || !!perms.edit_base;
  const hide = usePrivacy();
  const [reveal, setReveal] = useState(false);
  const masked = hide && !reveal;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const q = useApi<Sheet>(`/sheet?month=${month}`);
  const sh = q.data;

  const save = async (path: string, body: any) => {
    try {
      const r = await mutate("PUT", path, body);
      if (r.queued) toast("حُفظ محلياً، ستتم المزامنة عند توفر الاتصال", "info");
      await q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    }
  };
  const saveBase = (row: SheetRow, base: number | null) => save("/sheet/entry", { month, employee_id: row.id, base });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="جدول الأداء والمردودية" subtitle="النتيجة والمعامل لكل مؤشر" right={<SyncBadge />} />
      {q.loading ? (
        <Loading />
      ) : q.error && !sh ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : sh ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <MonthSwitcher month={month} onChange={setMonth} />
          {sh.turnover !== null || canEditTurnover ? (
            <Card style={{ gap: S.sm }}>
              {masked ? (
                <Pressable testID="sheet-turnover-masked" onPress={() => setReveal(true)} style={{ minHeight: 56, justifyContent: "center", gap: S.xs }}>
                  <T variant="caption">رقم أعمال الشركة المحصَّل الصافي (مخفي — وضع الخصوصية)</T>
                  <T variant="h2">{MASK}</T>
                  <T variant="caption" color="brand">اضغط لإظهاره مؤقتًا</T>
                </Pressable>
              ) : (
                <CellInput testID="sheet-turnover-input" label="رقم أعمال الشركة المحصَّل الصافي" unit="دج" value={sh.turnover} highlight editable={canEditTurnover}
                  onCommit={(v) => save("/sheet/turnover", { month, turnover: v })} />
              )}
              <Row style={{ justifyContent: "space-between", gap: S.md }}>
                <T variant="caption">المجمَّع للتوزيع ({pct(sh.params.pool_rate, 2)} من رقم الأعمال)</T>
                <T testID="sheet-pool" variant="label">{masked ? MASK : dz(sh.pool)}</T>
              </Row>
              <Row style={{ justifyContent: "space-between", gap: S.md }}>
                <T variant="caption">مجموع أوزان العمال</T>
                <T variant="label">{num(sh.pool_weights, 2)}</T>
              </Row>
              {hide && reveal ? <Pressable onPress={() => setReveal(false)}><T variant="caption" color="brand">إخفاء من جديد</T></Pressable> : null}
            </Card>
          ) : null}
          <T variant="caption">الأخضر الفاتح = تكتبه أنت (رقم الأعمال، الأساس) · الرمادي = يُحسب وحده. الهندام والاحترام والتأخرات والخسائر تُحسب تلقائيًا من «سجل المخالفات» (كل التفتيشات في الشهر). تُحفظ القيمة عند مغادرة الحقل.</T>

          {sh.rows.length === 0 ? <EmptyState icon="people-outline" title="لا يوجد موظفون نشطون" subtitle="أضف موظفين من الإعدادات" /> : null}
          {sh.rows.map((r, i) => {
            const ok = r.status === "✔";
            const ct = typeOf(sh.params.commission_types, r.perf_type);
            const isBase = ct?.kind === "rate";
            return (
              <Card key={r.id} style={{ gap: S.sm }} testID={`sheet-row-${i}`}>
                <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                  <View style={{ flex: 1 }}>
                    <T variant="h3" numberOfLines={1}>{r.name}</T>
                    <T variant="caption">{typeLabel(sh.params.commission_types, r.perf_type)}{r.violations ? ` · ${r.violations} مخالفة` : ""}{r.inspections ? ` · ${r.inspections} تفتيش` : ""}</T>
                  </View>
                  <Pill testID={`sheet-status-${i}`} label={r.status || "—"} tone={ok ? "success" : "warning"} />
                </Row>

                <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                  <CalcCell label="الهندام والنظافة (من السجل)" value={(r.hits?.hygiene ?? 0) > 0 ? `راسب · ${r.hits?.hygiene} مخالفة` : "ناجح ✔"} />
                  <CalcCell label="الاحترام (من السجل)" value={(r.hits?.respect ?? 0) > 0 ? `لا · ${r.hits?.respect} مخالفة` : "نعم ✔"} />
                  <CalcCell label="التأخرات والغيابات (من السجل)" value={`${num(r.days ?? 0)} يوم`} />
                  <CalcCell label="الخسائر (من السجل)" value={money(r.losses ?? 0)} />
                </Row>

                {isBase ? (
                  perms.view_base === false && !isAdmin ? null : masked ? (
                    <CalcCell label={typeBaseLabel(ct)} value={MASK} />
                  ) : (
                    <CellInput testID={`sheet-base-${i}`} label={typeBaseLabel(ct)} value={r.base} highlight editable={canEditBase} onCommit={(v) => saveBase(r, v)} />
                  )
                ) : (
                  <Row style={{ justifyContent: "space-between" }}>
                    <T variant="caption">وزن المنصب (للعمال فقط)</T>
                    <T variant="label">{r.post_weight === null ? "— (حدّده من ملف الموظف)" : num(r.post_weight, 2)}</T>
                  </Row>
                )}

                <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                  <CalcCell label="معامل النظافة" value={r.c === null ? "—" : num(r.c, 3)} />
                  <CalcCell label="معامل الاحترام" value={r.e === null ? "—" : num(r.e, 3)} />
                  <CalcCell label="معامل الخسائر" value={r.g === null ? "—" : num(r.g, 3)} />
                  <CalcCell label="معامل الأيام" value={r.i === null ? "—" : num(r.i, 3)} />
                </Row>
                <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                  <CalcCell label="نتيجة الأداء" value={pct(r.q)} strong />
                  <CalcCell label="مضاعف الأداء" value={pct(r.r)} strong />
                </Row>
                {r.t !== null || r.s !== null ? (
                  <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                    <CalcCell label="المنحة القصوى / العمولة الخام" value={dz(r.s)} />
                    <CalcCell label="المنحة المستحقة" value={dz(r.t)} strong />
                    <CalcCell label="الفرق ← الصندوق" value={dz(r.u)} />
                  </Row>
                ) : null}
              </Card>
            );
          })}

          {sh.totals ? (
            <Card style={{ gap: 0 }} testID="sheet-totals">
              <T variant="h2" style={{ paddingBottom: S.sm }}>المجموع</T>
              <LineItem label="المنحة القصوى / العمولة الخام" value={money(sh.totals.gross)} />
              <LineItem testID="sheet-total-payable" label="المنحة المستحقة" value={money(sh.totals.payable)} strong />
              <LineItem label="الفرق" value={money(sh.totals.gap)} />
              <LineItem testID="sheet-total-fund" label="يُوجَّه لصندوق الترفيه" value={money(sh.totals.fund)} tone="success" />
              <LineItem label="يبقى للشركة" value={money(sh.totals.company_keeps)} />
            </Card>
          ) : null}
          <T variant="caption">نتيجة الأداء = مجموع المعاملات المحقَّقة ÷ مجموع أوزانها. الهندام والنظافة والاحترام: نجاح كامل أو صفر. الخسائر والتأخرات: يتناقص معاملها بالتدريج حتى الحد المحدد. العمولة المستحقة = الخام × [(1 − الحصة المشروطة) + الحصة × نتيجة الأداء]. باقي العمال: يُوزَّع المجمَّع بنسبة وزن المنصب وتُصرف لكل عامل نتيجته من حصته.</T>
        </ScrollView>
      ) : null}
    </View>
  );
}
