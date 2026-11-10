import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { InfractionList } from "@/src/components/report-view";
import { currentMonth } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Report } from "@/src/types";
import { EmptyState, ErrorView, Header, Loading, MonthSwitcher, S } from "@/src/ui";

export default function MyInfractions() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currentMonth());
  const q = useApi<Report>(user?.employee_id ? `/me/report?month=${month}` : null);
  const r = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="سجل المخالفات" subtitle="المخالفات وأثرها على منحتك" />
      {!user?.employee_id ? (
        <EmptyState icon="link-outline" title="حسابك غير مرتبط بملف موظف" />
      ) : q.loading ? (
        <Loading />
      ) : q.error && !r ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : r ? (
        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <MonthSwitcher month={month} onChange={setMonth} />
          <InfractionList r={r} currency={r.currency} />
        </ScrollView>
      ) : null}
    </View>
  );
}
