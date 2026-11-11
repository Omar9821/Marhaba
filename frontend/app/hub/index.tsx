import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { currentMonth, money, num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { BranchStat, HubOverview } from "@/src/types";
import { Btn, Card, ConfirmSheet, EmptyState, ErrorView, Header, Loading, MonthSwitcher, Pill, ProgressBar, Row, S, StatTile, T } from "@/src/ui";

const ACT: Record<string, string> = { workshop: "ورشة / إنتاج", commercial: "تجاري", services: "خدمات", other: "نشاط آخر" };
const pct = (v: number | null) => (v === null || v === undefined ? "—" : `${num(v * 100, 1)}%`);

/** البوابة العامة للمسؤول العام: أداء كل الفروع في نظرة واحدة + الدخول إلى أي فرع + إدارة الفروع. */
export default function HubHome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, enterBranch } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [confirm, setConfirm] = useState(false);
  const q = useApi<HubOverview>(`/hub/overview?month=${month}`);
  const d = q.data;

  const enter = async (id: string) => {
    await enterBranch(id);
    router.replace("/" as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="البوابة العامة" subtitle={`مرحباً ${user?.name ?? ""} — أداء كل الفروع`} />
      {q.loading ? <Loading /> : q.error && !d ? <ErrorView message={q.error} onRetry={q.refresh} /> : d ? (
        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: insets.bottom + S.xxl }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <MonthSwitcher month={month} onChange={setMonth} />
          <Row style={{ gap: S.sm }}>
            <StatTile testID="hub-branches" icon="business-outline" label="الفروع" value={String(d.branches.length)} />
            <StatTile testID="hub-employees" icon="people-outline" label="الموظفون" value={String(d.totals.employees)} />
            <StatTile testID="hub-avg" icon="speedometer-outline" label="متوسط الأداء" value={pct(d.totals.avg_q)} />
          </Row>
          <Row style={{ gap: S.sm }}>
            <StatTile testID="hub-turnover" icon="trending-up-outline" label="رقم الأعمال الكلي" value={money(d.totals.turnover)} />
            <StatTile testID="hub-payable" icon="gift-outline" label="المنح المستحقة" value={money(d.totals.payable)} />
          </Row>
          <Row style={{ gap: S.sm }}>
            <StatTile testID="hub-violations" icon="warning-outline" label="المخالفات" value={String(d.totals.violations)} />
            <StatTile testID="hub-losses" icon="cash-outline" label="الخسائر" value={money(d.totals.losses)} />
          </Row>
          <Btn testID="hub-manage" title="إدارة الفروع (إضافة / تعطيل)" variant="secondary" icon="settings-outline" onPress={() => router.push("/hub/branches" as any)} />
          {d.branches.length === 0 ? <EmptyState icon="business-outline" title="لا توجد فروع" /> : null}
          {d.branches.map((b: BranchStat, i) => (
            <Card key={b.id} style={{ gap: S.sm }} testID={`hub-branch-${i}`}>
              <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                <View style={{ flex: 1 }}>
                  <T variant="h3" numberOfLines={1}>{b.name}</T>
                  <T variant="caption">{ACT[b.activity] ?? b.activity} · {b.employees} موظف</T>
                </View>
                <Pill label={pct(b.avg_q)} tone={b.avg_q === null ? "muted" : b.avg_q >= 0.8 ? "success" : b.avg_q >= 0.5 ? "warning" : "error"} />
              </Row>
              <ProgressBar value={b.avg_q ?? 0} />
              <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: S.sm }}>
                <T variant="caption">رقم الأعمال: {b.turnover === null ? "—" : money(b.turnover)}</T>
                <T variant="caption">المنح المستحقة: {money(b.payable)}</T>
              </Row>
              <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: S.sm }}>
                <T variant="caption">مخالفات: {b.violations} · تفتيشات: {b.inspections}</T>
                <T variant="caption">خسائر: {money(b.losses)}</T>
              </Row>
              {b.best ? <T variant="caption">الأفضل: {b.best.name} ({pct(b.best.q)}){b.worst && b.worst.name !== b.best.name ? ` · الأضعف: ${b.worst.name} (${pct(b.worst.q)})` : ""}</T> : null}
              <Btn testID={`hub-enter-${i}`} title="دخول الفرع" icon="enter-outline" variant="outline" onPress={() => enter(b.id)} />
            </Card>
          ))}
          <Btn testID="hub-logout" title="تسجيل الخروج" variant="ghost" icon="log-out-outline" onPress={() => setConfirm(true)} />
        </ScrollView>
      ) : null}
      <ConfirmSheet visible={confirm} title="تسجيل الخروج" message="هل تريد تسجيل الخروج؟" confirmLabel="تسجيل الخروج" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); logout(); }} />
    </View>
  );
}
