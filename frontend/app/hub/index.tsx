import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { pickFiles } from "@/src/files";
import { currentMonth, money, num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { BranchStat, HubOverview } from "@/src/types";
import { Btn, Card, ConfirmSheet, EmptyState, ErrorView, Header, Loading, MonthSwitcher, Pill, ProgressBar, Row, S, StatTile, T, useToast } from "@/src/ui";

const ACT: Record<string, string> = { workshop: "ورشة / إنتاج", commercial: "تجاري", services: "خدمات", mirrors: "مرايا الحمام LED", other: "نشاط آخر" };
const pct = (v: number | null, digits = 1) => (v === null || v === undefined ? "—" : `${num(v * 100, digits)}%`);

/** البوابة العامة للمسؤول العام: أداء كل الفروع في نظرة واحدة + الدخول إلى أي فرع + إدارة الفروع. */
export default function HubHome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, enterBranch } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const importTeam = async () => {
    try {
      const f = (await pickFiles())[0];
      if (!f) return;
      setImporting(true);
      const r = await api.post("/hub/import-team", { data: f.data });
      toast(`تم: ${r.admins_created + r.admins_updated} مسيّر، ${r.employees_created + r.employees_updated} موظف، ${r.supervisors} مراقب${r.errors?.length ? ` — أخطاء: ${r.errors.join("، ")}` : ""}`);
      q.refresh();
    } catch (e: any) { toast(e?.message || "تعذر الاستيراد", "error"); } finally { setImporting(false); }
  };
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
          <Card style={{ gap: S.xs }} testID="hub-efficiency">
            <T variant="h3">فعالية المنح (كل الفروع)</T>
            <T>المنح الموزَّعة: {money(d.totals.bonus)}</T>
            <T>المنح كنسبة من رقم الأعمال: {pct(d.totals.bonus_pct, 2)}</T>
            <T>المنح كنسبة من الربح قبل المنح: {pct(d.totals.bonus_pct_profit)}</T>
            <T>كل 1 دج منحة يقابله ربح بعد المنح: {d.totals.profit_per_da === null ? "—" : `${num(d.totals.profit_per_da, 1)} دج`}</T>
          </Card>
          <Btn testID="hub-manage" title="إدارة الفروع (إضافة / تعطيل)" variant="secondary" icon="settings-outline" onPress={() => router.push("/hub/branches" as any)} />
          <Btn testID="hub-import" title="استيراد الفريق والحسابات من Excel" variant="secondary" icon="cloud-upload-outline" onPress={importTeam} loading={importing} />
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
              <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: S.sm }}>
                <T variant="caption">المنح الموزَّعة: {money(b.bonus)} · {pct(b.bonus_pct, 2)} من رقم الأعمال</T>
                <T variant="caption">نسبة الهدر: {pct(b.waste_ratio)}</T>
              </Row>
              <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: S.sm }}>
                <T variant="caption">من الربح قبل المنح: {pct(b.bonus_pct_profit)}</T>
                <T variant="caption">كل 1 دج منحة ↔ ربح بعد المنح {b.profit_per_da === null ? "—" : `${num(b.profit_per_da, 1)} دج`}</T>
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
