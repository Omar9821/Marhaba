import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { currentMonth, money, num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { SheetParams, SheetRow, typeBaseLabel, typeLabel, typeOf } from "@/src/types";
import { Card, EmptyState, ErrorView, Header, LineItem, Loading, MonthSwitcher, Pill, ProgressBar, S, SyncBadge, T } from "@/src/ui";

const pct = (v: number | null) => (v === null ? "—" : `${num(v * 100, 1)}%`);

export default function MyPerformance() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currentMonth());
  const q = useApi<{ month: string; row: SheetRow; params: SheetParams; perms: Record<string, boolean> }>(user?.employee_id ? `/me/sheet?month=${month}` : null);
  const r = q.data?.row;

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
          <Card style={{ gap: S.sm }} testID="bonus-hero-card">
            <T variant="label">المنحة المستحقة — {typeLabel(q.data?.params.commission_types, r.perf_type)}</T>
            <T testID="final-bonus-value" variant="num">{r.t === null ? "—" : money(r.t)}</T>
            <Row2 label="نتيجة الأداء" value={pct(r.q)} />
            <ProgressBar value={r.q ?? 0} />
            <Pill label={r.status || "—"} tone={r.status === "✔" ? "success" : "warning"} />
          </Card>
          <Card style={{ gap: 0 }}>
            <T variant="h2" style={{ paddingBottom: S.sm }}>تفاصيل الحساب</T>
            <LineItem label="الهندام والنظافة" value={r.hygiene === null ? "—" : `${num(r.hygiene * 100, 1)}% (معامل ${r.c === null ? "—" : num(r.c, 3)})`} />
            <LineItem label="الاحترام" value={r.respect ? `${r.respect} (معامل ${r.e === null ? "—" : num(r.e, 3)})` : "—"} />
            <LineItem label="الخسائر" value={r.losses === null ? "—" : `${money(r.losses)} (معامل ${r.g === null ? "—" : num(r.g, 3)})`} />
            <LineItem label="التأخرات والغيابات" value={r.days === null ? "—" : `${num(r.days)} يوم (معامل ${r.i === null ? "—" : num(r.i, 3)})`} />
            <LineItem label="مضاعف الأداء" value={pct(r.r)} />
            {r.base !== null ? <LineItem label={typeBaseLabel(typeOf(q.data?.params.commission_types, r.perf_type))} value={num(r.base)} /> : null}
            <LineItem label="المنحة القصوى" value={r.s === null ? "—" : money(r.s)} />
            <LineItem label="المنحة المستحقة" value={r.t === null ? "—" : money(r.t)} strong />
            <LineItem label="مخالفات الشهر" value={String(r.violations)} tone={r.violations ? "error" : "muted"} />
          </Card>
        </ScrollView>
      ) : null}
    </View>
  );
}

function Row2({ label, value }: { label: string; value: string }) {
  return <LineItem label={label} value={value} strong />;
}
