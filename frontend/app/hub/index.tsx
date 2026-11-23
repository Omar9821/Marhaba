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
import { Btn, Card, ConfirmSheet, EmptyState, ErrorView, Header, Loading, MonthSwitcher, Pill, ProgressBar, R, Row, S, StatTile, T, useToast } from "@/src/ui";

const ACT: Record<string, string> = { workshop: "ورشة / إنتاج", commercial: "تجاري", services: "خدمات", mirrors: "مرايا الحمام LED", other: "نشاط آخر" };
function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "error" }) {
  const { colors } = useTheme();
  const c = tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "error" ? colors.error : colors.onSurface;
  return (
    <View style={{ width: "48%", gap: 2, paddingVertical: S.xs }}>
      <T variant="caption">{label}</T>
      <T variant="h3" style={{ color: c }} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
    </View>
  );
}
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

  const enter = async (id: string, to: string = "/") => {
    await enterBranch(id);
    router.replace(to as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="البوابة العامة" subtitle={`مرحباً ${user?.name ?? ""} — أداء كل الفروع`} />
      {q.loading ? <Loading /> : q.error && !d ? <ErrorView message={q.error} onRetry={q.refresh} /> : d ? (
        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: insets.bottom + S.xxl }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <MonthSwitcher month={month} onChange={setMonth} />

          <View style={{ backgroundColor: colors.brandPrimary, borderRadius: R.lg, padding: S.lg, gap: S.sm }}>
            <T variant="caption" style={{ color: colors.onBrandPrimary, opacity: 0.85 }}>متوسط الأداء في كل الفروع</T>
            <T variant="h1" style={{ color: colors.onBrandPrimary }}>{pct(d.totals.avg_q)}</T>
            <ProgressBar value={d.totals.avg_q ?? 0} />
            <Row style={{ gap: S.lg, flexWrap: "wrap" }}>
              <T variant="caption" style={{ color: colors.onBrandPrimary }}>{d.branches.length} فروع</T>
              <T variant="caption" style={{ color: colors.onBrandPrimary }}>{d.totals.employees} موظفًا</T>
            </Row>
          </View>

          <Row style={{ gap: S.sm }}>
            <StatTile testID="hub-turnover" icon="trending-up-outline" label="رقم الأعمال" value={money(d.totals.turnover)} />
            <StatTile testID="hub-payable" icon="gift-outline" label="المنح الموزَّعة" value={money(d.totals.bonus)} />
          </Row>
          <Row style={{ gap: S.sm }}>
            <StatTile testID="hub-violations" icon="warning-outline" label="المخالفات" value={String(d.totals.violations)} />
            <StatTile testID="hub-losses" icon="cash-outline" label="الخسائر" value={money(d.totals.losses)} />
          </Row>

          <Card style={{ gap: S.xs }} testID="hub-efficiency">
            <T variant="h3">فعالية المنح</T>
            <Row style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
              <Metric label="المنح من رقم الأعمال" value={pct(d.totals.bonus_pct, 2)} />
              <Metric label="المنح من الربح قبل المنح" value={pct(d.totals.bonus_pct_profit)} />
              <Metric label="كل 1 دج منحة ↔ ربح بعد المنح" value={d.totals.profit_per_da === null ? "—" : `${num(d.totals.profit_per_da, 1)} دج`} tone="success" />
              <Metric label="الربح بعد المنح" value={money(d.totals.profit_after)} />
            </Row>
          </Card>

          <Btn testID="hub-chat" title="المراسلة العامة — أي عامل أو مجموعة في أي فرع" icon="chatbubbles-outline" onPress={() => router.push("/hubchat" as any)} />
          <Row style={{ gap: S.sm }}>
            <View style={{ flex: 1 }}><Btn testID="hub-manage" title="إدارة الفروع" variant="secondary" icon="settings-outline" onPress={() => router.push("/hub/branches" as any)} /></View>
            <View style={{ flex: 1 }}><Btn testID="hub-import" title="استيراد الحسابات" variant="secondary" icon="cloud-upload-outline" onPress={importTeam} loading={importing} /></View>
          </Row>

          <T variant="h3">الفروع</T>
          {d.branches.length === 0 ? <EmptyState icon="business-outline" title="لا توجد فروع" /> : null}
          {d.branches.map((b: BranchStat, i) => {
            const tone = b.avg_q === null ? "muted" : b.avg_q >= 0.8 ? "success" : b.avg_q >= 0.5 ? "warning" : "error";
            const wTone = b.waste_ratio === null ? undefined : b.waste_ratio < 0.04 ? "success" : b.waste_ratio < 0.08 ? "warning" : "error";
            return (
              <Card key={b.id} style={{ gap: S.sm, borderTopWidth: 4, borderTopColor: tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "error" ? colors.error : colors.border }} testID={`hub-branch-${i}`}>
                <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                  <View style={{ flex: 1 }}>
                    <T variant="h3" numberOfLines={1}>{b.name}</T>
                    <T variant="caption">{ACT[b.activity] ?? b.activity} · {b.employees} موظف</T>
                  </View>
                  <Pill label={pct(b.avg_q)} tone={tone as any} />
                </Row>
                <ProgressBar value={b.avg_q ?? 0} />
                <Row style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
                  <Metric label="رقم الأعمال" value={b.turnover === null ? "—" : money(b.turnover)} />
                  <Metric label="المنح الموزَّعة" value={money(b.bonus)} />
                  <Metric label="المنح من رقم الأعمال" value={pct(b.bonus_pct, 2)} />
                  <Metric label="نسبة الهدر" value={pct(b.waste_ratio)} tone={wTone as any} />
                  <Metric label="المنح من الربح" value={pct(b.bonus_pct_profit)} />
                  <Metric label="كل 1 دج منحة ↔ ربح" value={b.profit_per_da === null ? "—" : `${num(b.profit_per_da, 1)} دج`} tone="success" />
                  <Metric label="مخالفات / تفتيشات" value={`${b.violations} / ${b.inspections}`} />
                  <Metric label="الخسائر" value={money(b.losses)} />
                </Row>
                {b.best ? <T variant="caption">الأفضل: {b.best.name} ({pct(b.best.q)}){b.worst && b.worst.name !== b.best.name ? ` · الأضعف: ${b.worst.name} (${pct(b.worst.q)})` : ""}</T> : null}
                <Row style={{ gap: S.sm }}>
                  <View style={{ flex: 1 }}><Btn testID={`hub-enter-${i}`} title="دخول الفرع" icon="enter-outline" variant="outline" onPress={() => enter(b.id)} /></View>
                  <View style={{ flex: 1 }}><Btn testID={`hub-chat-${i}`} title="المراسلة" icon="chatbubbles-outline" variant="outline" onPress={() => enter(b.id, "/(admin)/inbox")} /></View>
                </Row>
              </Card>
            );
          })}
          <Btn testID="hub-logout" title="تسجيل الخروج" variant="ghost" icon="log-out-outline" onPress={() => setConfirm(true)} />
        </ScrollView>
      ) : null}
      <ConfirmSheet visible={confirm} title="تسجيل الخروج" message="هل تريد تسجيل الخروج؟" confirmLabel="تسجيل الخروج" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); logout(); }} />
    </View>
  );
}
