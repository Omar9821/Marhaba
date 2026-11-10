import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Breakdown, BonusHero, DailyChart, InfractionList, KpiSection } from "@/src/components/report-view";
import { currentMonth } from "@/src/format";
import { useApi } from "@/src/hooks";
import { employeeHtml, exportPdf } from "@/src/pdf";
import { useTheme } from "@/src/theme";
import { Report } from "@/src/types";
import { Btn, ErrorView, Header, Loading, MonthSwitcher, S, Segmented, useToast } from "@/src/ui";

export default function EmployeeDetail() {
  const { id, month: m } = useLocalSearchParams<{ id: string; month?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [month, setMonth] = useState(m || currentMonth());
  const [tab, setTab] = useState<"perf" | "inf">("perf");
  const [busy, setBusy] = useState(false);
  const q = useApi<Report>(`/reports/employee/${id}?month=${month}`);
  const r = q.data;
  const cur = r?.currency ?? "دج";

  const exportOne = async () => {
    if (!r) return;
    setBusy(true);
    try {
      await exportPdf(employeeHtml(r, cur));
    } catch {
      toast("تعذر إنشاء ملف PDF", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title={r?.employee.full_name ?? "كشف الموظف"} subtitle={r?.employee.position_name} />
      {q.loading ? (
        <Loading />
      ) : q.error && !r ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : r ? (
        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: insets.bottom + S.xl }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <MonthSwitcher month={month} onChange={setMonth} />
          <BonusHero r={r} currency={cur} />
          <Btn testID="export-employee-pdf-button" title="تصدير كشف الموظف PDF" icon="download-outline" variant="secondary" onPress={exportOne} loading={busy} />
          <Segmented testID="employee-detail-tabs" value={tab} onChange={setTab} options={[{ key: "perf", label: "الأداء والحساب" }, { key: "inf", label: "المخالفات" }]} />
          {tab === "perf" ? (
            <>
              <KpiSection r={r} />
              <DailyChart r={r} />
              <Breakdown r={r} currency={cur} />
            </>
          ) : (
            <InfractionList r={r} currency={cur} />
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}
