import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { HERO_IMAGE } from "@/src/components/report-view";
import { currentMonth, money, num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { CompanyReport } from "@/src/types";
import { BarChart, Btn, Card, EmptyState, ErrorView, Header, Icon, Loading, MonthSwitcher, Pill, R, Row, S, StatTile, SyncBadge, T } from "@/src/ui";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [month, setMonth] = useState(currentMonth());
  const q = useApi<CompanyReport>(`/reports/company?month=${month}`);
  const rep = q.data;
  const cur = rep?.settings.currency ?? "دج";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title={`مرحباً، ${user?.name ?? ""}`} subtitle="لوحة تحكم المسير" right={<SyncBadge />} />
      {q.loading ? (
        <Loading />
      ) : q.error && !rep ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : rep ? (
        <ScrollView
          contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: bottomChrome + 96 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}
        >
          <MonthSwitcher month={month} onChange={setMonth} />
          <View testID="dashboard-hero-card" style={{ borderRadius: R.lg, overflow: "hidden", backgroundColor: colors.brand }}>
            <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(26,32,29,0.15)", "rgba(26,32,29,0.88)"]} style={StyleSheet.absoluteFill} />
            <View style={{ padding: S.xl, gap: S.xs }}>
              <T variant="label" style={{ color: colors.onBrand }}>إجمالي المنح المستحقة</T>
              <T testID="dashboard-total-bonus" variant="num" style={{ color: colors.onBrand }}>{money(rep.totals.final_bonus, cur)}</T>
              <Row style={{ gap: S.xl }}>
                <View>
                  <T variant="caption" style={{ color: colors.onBrand, opacity: 0.8 }}>صندوق الترفيه</T>
                  <T variant="h3" style={{ color: colors.onBrand }}>{money(rep.totals.recreation_fund, cur)}</T>
                </View>
                <View>
                  <T variant="caption" style={{ color: colors.onBrand, opacity: 0.8 }}>المنح التنافسية</T>
                  <T variant="h3" style={{ color: colors.onBrand }}>{money(rep.totals.competitive_pool, cur)}</T>
                </View>
              </Row>
            </View>
          </View>
          <Row style={{ gap: S.sm }}>
            <StatTile testID="stat-avg-score" icon="speedometer-outline" label="متوسط الأداء" value={`${num(rep.totals.avg_score, 1)}%`} />
            <StatTile testID="stat-employees" icon="people-outline" label="موظف نشط" value={String(rep.totals.employees)} />
            <StatTile testID="stat-infractions" icon="warning-outline" label="مخالفة" value={String(rep.totals.infractions)} />
          </Row>
          {rep.employees.length === 0 ? (
            <EmptyState title="لا توجد بيانات لهذا الشهر" subtitle="أضف موظفين ثم ابدأ بإدخال الأداء اليومي" action={<Btn title="إضافة بيانات" onPress={() => router.push("/settings/employees" as any)} testID="empty-add-data-button" />} />
          ) : (
            <>
              <Card style={{ gap: S.sm }}>
                <T variant="h2">نسبة الأداء حسب الموظف</T>
                <BarChart testID="employees-score-chart" data={rep.employees.map((r) => ({ key: r.employee.id, label: r.employee.full_name.split(" ")[0], value: r.score }))} max={Math.max(100, ...rep.employees.map((r) => r.score))} />
              </Card>
              <Card style={{ paddingVertical: S.sm }}>
                <T variant="h2" style={{ paddingTop: S.sm }}>ترتيب الموظفين</T>
                {rep.employees.map((r, i) => (
                  <Pressable
                    key={r.employee.id}
                    testID={`ranking-row-${i}`}
                    onPress={() => router.push({ pathname: "/employee/[id]", params: { id: r.employee.id, month } } as any)}
                    style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: S.md, paddingVertical: S.md, opacity: pressed ? 0.6 : 1, borderBottomWidth: i === rep.employees.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.divider })}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: i === 0 ? colors.brand : colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                      <T variant="label" style={{ color: i === 0 ? colors.onBrand : colors.brand }}>{i + 1}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="label" numberOfLines={1}>{r.employee.full_name}</T>
                      <T variant="caption">{r.employee.position_name} • {num(r.score, 1)}% • {r.infractions_count} مخالفة</T>
                    </View>
                    <View style={{ alignItems: "flex-start", gap: 2 }}>
                      <T variant="label" color="brand">{money(r.final_bonus, cur)}</T>
                      {!r.eligible ? <Pill label="غير مؤهل" tone="error" /> : r.competitive_bonus > 0 ? <Pill label="منحة تنافسية" tone="success" /> : null}
                    </View>
                  </Pressable>
                ))}
              </Card>
            </>
          )}
        </ScrollView>
      ) : null}
      <Pressable
        testID="fab-log-infraction"
        onPress={() => router.navigate({ pathname: "/(admin)/entry", params: { mode: "infractions" } } as any)}
        style={({ pressed }) => ({
          position: "absolute", bottom: bottomChrome + 16, left: S.lg, flexDirection: "row-reverse", alignItems: "center", gap: S.sm,
          backgroundColor: colors.brand, paddingHorizontal: S.lg, height: 52, borderRadius: R.pill, transform: [{ scale: pressed ? 0.96 : 1 }],
          shadowColor: colors.onSurface, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
        })}
      >
        <Icon name="add-circle-outline" size={22} color={colors.onBrand} />
        <T variant="label" style={{ color: colors.onBrand }}>تسجيل مخالفة</T>
      </Pressable>
    </View>
  );
}
