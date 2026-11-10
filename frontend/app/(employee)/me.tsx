import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Breakdown, BonusHero, DailyChart, KpiSection } from "@/src/components/report-view";
import { currentMonth } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Report } from "@/src/types";
import { EmptyState, ErrorView, Header, Loading, MonthSwitcher, S, SyncBadge } from "@/src/ui";

export function useMyReport(month: string) {
  const { user } = useAuth();
  return useApi<Report>(user?.employee_id ? `/me/report?month=${month}` : null);
}

export default function MyPerformance() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currentMonth());
  const q = useMyReport(month);
  const r = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="أدائي" subtitle={user?.name} right={<SyncBadge />} />
      {!user?.employee_id ? (
        <EmptyState testID="not-linked-state" icon="link-outline" title="حسابك غير مرتبط بملف موظف" subtitle="اطلب من المسير إضافة بريدك الإلكتروني إلى ملفك ثم أعد الدخول" />
      ) : q.loading ? (
        <Loading />
      ) : q.error && !r ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : r ? (
        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <MonthSwitcher month={month} onChange={setMonth} />
          <BonusHero r={r} currency={r.currency} />
          {r.days_recorded === 0 ? <EmptyState icon="cash-outline" title="لم يتم احتساب المردودية بعد" subtitle="لا توجد بيانات أداء مسجلة لهذا الشهر" /> : null}
          <KpiSection r={r} />
          <DailyChart r={r} />
          <Breakdown r={r} currency={r.currency} />
        </ScrollView>
      ) : null}
    </View>
  );
}
