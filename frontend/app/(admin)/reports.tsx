import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { currentMonth, money, num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { companyHtml, exportPdf } from "@/src/pdf";
import { useTheme } from "@/src/theme";
import { CompanyReport } from "@/src/types";
import { Btn, Card, EmptyState, ErrorView, Header, Icon, LineItem, Loading, MonthSwitcher, Pill, Row, S, T, useToast } from "@/src/ui";

export default function Reports() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [busy, setBusy] = useState(false);
  const q = useApi<CompanyReport>(`/reports/company?month=${month}`);
  const rep = q.data;
  const cur = rep?.settings.currency ?? "دج";

  const exportCompany = async () => {
    if (!rep) return;
    setBusy(true);
    try {
      await exportPdf(companyHtml(rep));
    } catch {
      toast("تعذر إنشاء ملف PDF", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="التقارير والكشوف" subtitle="الرواتب، المنح والأداء" />
      {q.loading ? (
        <Loading />
      ) : q.error && !rep ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : rep ? (
        <ScrollView
          contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}
        >
          <MonthSwitcher month={month} onChange={setMonth} />
          <Card>
            <T variant="h2">ملخص الشهر</T>
            <LineItem label="مجموع الرواتب الأساسية" value={money(rep.totals.base_salaries, cur)} />
            <LineItem label="إجمالي المنح النهائية" value={money(rep.totals.final_bonus, cur)} tone="brand" />
            <LineItem label="مساهمات الصندوق" value={money(rep.totals.fund_pool, cur)} />
            <LineItem label="منها منح تنافسية" value={money(rep.totals.competitive_pool, cur)} />
            <LineItem label="رصيد صندوق الترفيه" value={money(rep.totals.recreation_fund, cur)} />
            <LineItem testID="report-total-payroll" label="إجمالي الكتلة المستحقة" value={money(rep.totals.base_salaries + rep.totals.final_bonus, cur)} strong />
          </Card>
          <Btn testID="export-company-pdf-button" title="تصدير كشف الشركة PDF" icon="download-outline" onPress={exportCompany} loading={busy} disabled={!rep.employees.length} />
          {rep.employees.length === 0 ? (
            <EmptyState title="لا يوجد موظفون نشطون" />
          ) : (
            <Card style={{ paddingVertical: S.xs }}>
              <T variant="h2" style={{ paddingTop: S.sm }}>كشوف الموظفين</T>
              {rep.employees.map((r, i) => (
                <Pressable
                  key={r.employee.id}
                  testID={`report-employee-row-${i}`}
                  onPress={() => router.push({ pathname: "/employee/[id]", params: { id: r.employee.id, month } } as any)}
                  style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: S.md, paddingVertical: S.md, opacity: pressed ? 0.6 : 1, borderBottomWidth: i === rep.employees.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.divider })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="label">{r.employee.full_name}</T>
                    <T variant="caption">الراتب {money(r.employee.base_salary, cur)} • الأداء {num(r.score, 1)}%</T>
                  </View>
                  <View style={{ alignItems: "flex-start", gap: 2 }}>
                    <T variant="label" color="brand">{money(r.final_bonus, cur)}</T>
                    {r.eligible ? <Pill label={`${r.infractions_count} مخالفة`} tone={r.infractions_count ? "warning" : "success"} /> : <Pill label="غير مؤهل" tone="error" />}
                  </View>
                  <Icon name="chevron-back" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </Card>
          )}
          <Row style={{ gap: S.sm, justifyContent: "center" }}>
            <Icon name="information-circle-outline" size={16} color={colors.muted} />
            <T variant="caption">اضغط على أي موظف لعرض كشفه المفصل وتصديره</T>
          </Row>
        </ScrollView>
      ) : null}
    </View>
  );
}
