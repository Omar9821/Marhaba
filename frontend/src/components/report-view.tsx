import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

import { deductionText, money, num } from "@/src/format";
import { useTheme } from "@/src/theme";
import { Report } from "@/src/types";
import { BarChart, Card, EmptyState, Icon, LineItem, Pill, ProgressBar, R, Row, S, T } from "@/src/ui";

export const HERO_IMAGE =
  "https://images.unsplash.com/photo-1629197520635-16570fbd0bb3?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=900";

export function BonusHero({ r, currency = "دج" }: { r: Report; currency?: string }) {
  const { colors } = useTheme();
  return (
    <View testID="bonus-hero-card" style={{ borderRadius: R.lg, overflow: "hidden", backgroundColor: colors.brand }}>
      <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(26,32,29,0.15)", "rgba(26,32,29,0.85)"]} style={StyleSheet.absoluteFill} />
      <View style={{ padding: S.xl, gap: S.xs }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T variant="label" style={{ color: colors.onBrand }}>المنحة المتوقعة</T>
          <View style={{ backgroundColor: r.eligible ? colors.success : colors.error, borderRadius: R.pill, paddingHorizontal: S.sm + 2, paddingVertical: 2 }}>
            <T variant="caption" style={{ color: colors.onSuccess }}>{r.eligible ? "مؤهل للمنحة" : "غير مؤهل"}</T>
          </View>
        </Row>
        <T testID="final-bonus-value" variant="num" style={{ color: colors.onBrand }}>{money(r.final_bonus, currency)}</T>
        <Row style={{ gap: S.lg, marginTop: S.xs }}>
          <View>
            <T variant="caption" style={{ color: colors.onBrand, opacity: 0.8 }}>نسبة الأداء</T>
            <T testID="score-value" variant="h3" style={{ color: colors.onBrand }}>{num(r.score, 1)}%</T>
          </View>
          <View>
            <T variant="caption" style={{ color: colors.onBrand, opacity: 0.8 }}>المخالفات</T>
            <T variant="h3" style={{ color: colors.onBrand }}>{r.infractions_count}</T>
          </View>
          <View>
            <T variant="caption" style={{ color: colors.onBrand, opacity: 0.8 }}>أيام مسجلة</T>
            <T variant="h3" style={{ color: colors.onBrand }}>{r.days_recorded}</T>
          </View>
        </Row>
        {!r.eligible && r.ineligible_reason ? (
          <T variant="caption" style={{ color: colors.onBrand, marginTop: S.xs }}>{r.ineligible_reason}</T>
        ) : null}
      </View>
    </View>
  );
}

export function KpiSection({ r }: { r: Report }) {
  if (!r.kpis.length) return <EmptyState title="لا توجد مؤشرات أداء لهذا المنصب" />;
  return (
    <Card style={{ gap: S.md }} testID="kpi-section">
      <T variant="h2">مؤشرات الأداء</T>
      {r.kpis.map((k, i) => (
        <View key={k.kpi_id} style={{ gap: S.xs }} testID={`kpi-row-${i}`}>
          <Row style={{ justifyContent: "space-between", gap: S.sm }}>
            <T variant="label" style={{ flex: 1 }}>{k.name}</T>
            <Pill label={`الوزن ${num(k.weight)}%`} />
          </Row>
          <ProgressBar value={k.ratio / 100} />
          <Row style={{ justifyContent: "space-between" }}>
            <T variant="caption">المحقق {num(k.achieved, 1)} / المستهدف {num(k.target, 1)} {k.unit}</T>
            <T variant="caption" color="onSurface">{num(k.ratio, 1)}% ← {num(k.weighted, 1)} نقطة</T>
          </Row>
        </View>
      ))}
    </Card>
  );
}

export function DailyChart({ r }: { r: Report }) {
  const days = r.daily.slice(-14);
  if (!days.length) return null;
  return (
    <Card style={{ gap: S.sm }}>
      <T variant="h2">الأداء اليومي</T>
      <BarChart testID="daily-chart" data={days.map((d) => ({ key: d.date, label: String(Number(d.date.slice(8))), value: d.score }))} max={Math.max(100, ...days.map((d) => d.score))} />
    </Card>
  );
}

export function Breakdown({ r, currency = "دج" }: { r: Report; currency?: string }) {
  const formula = r.bonus_mode === "salary"
    ? `الراتب × نسبة المنحة × النقاط الصافية% × المعامل (${num(r.multiplier, 2)})`
    : `النقاط الصافية × قيمة النقطة (${money(r.point_value, currency)}) × المعامل (${num(r.multiplier, 2)})`;
  return (
    <Card testID="bonus-breakdown">
      <T variant="h2">كيف تم حساب المنحة؟</T>
      <T variant="caption" style={{ marginBottom: S.sm }}>{formula}</T>
      <LineItem label="نسبة الأداء المرجحة" value={`${num(r.score, 1)}`} />
      <LineItem label="خصم نقاط المخالفات" value={`-${num(r.points_deduction, 1)}`} tone="error" />
      <LineItem label="النقاط الصافية" value={`${num(r.effective_score, 1)}`} />
      <LineItem label="المنحة الخام" value={money(r.gross_bonus, currency)} />
      <LineItem label={`خصم نسبة مئوية (${num(r.percent_deduction, 1)}%)`} value={`-${money(r.percent_amount, currency)}`} tone="error" />
      <LineItem label="خصومات مالية مباشرة" value={`-${money(r.amount_deduction, currency)}`} tone="error" />
      {r.capped ? <LineItem label="تم تطبيق السقف الأعلى للمنحة" value="✓" tone="warning" /> : null}
      {!r.eligible ? <LineItem label={r.ineligible_reason ?? "غير مؤهل"} value={money(0, currency)} tone="error" /> : null}
      <LineItem label="المنحة الصافية" value={money(r.net_bonus, currency)} />
      <LineItem label="مساهمة صندوق الترفيه" value={`-${money(r.fund_share, currency)}`} tone="error" />
      <LineItem label="المنحة التنافسية" value={`+${money(r.competitive_bonus, currency)}`} tone="success" />
      <LineItem testID="breakdown-final-bonus" label="المنحة النهائية" value={money(r.final_bonus, currency)} strong tone="brand" />
    </Card>
  );
}

export function InfractionList({ r, currency = "دج" }: { r: Report; currency?: string }) {
  const { colors } = useTheme();
  const lost = Math.max(0, r.gross_bonus - r.net_bonus) + (r.points_deduction * r.point_value * r.multiplier || 0);
  return (
    <View style={{ gap: S.md }}>
      <Card style={{ gap: S.sm }} testID="infractions-summary">
        <T variant="h2">أثر المخالفات على المنحة</T>
        <Row style={{ gap: S.sm }}>
          <SummaryBox label="عدد المخالفات" value={String(r.infractions_count)} />
          <SummaryBox label="نقاط مخصومة" value={num(r.points_deduction, 1)} />
          <SummaryBox label="خسارة تقديرية" value={money(r.eligible ? lost : r.gross_bonus, currency)} />
        </Row>
      </Card>
      {r.infractions.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="سجل نظيف" subtitle="لا توجد مخالفات مسجلة في هذا الشهر، استمر!" testID="no-infractions-state" />
      ) : (
        <Card style={{ paddingVertical: S.sm }}>
          {r.infractions.map((i, idx) => (
            <Row key={i.id} testID={`infraction-item-${idx}`} style={{ gap: S.md, paddingVertical: S.md, borderBottomWidth: idx === r.infractions.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.errorSoft, alignItems: "center", justifyContent: "center" }}>
                <Icon name="warning-outline" size={20} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="label">{i.type_name}</T>
                <T variant="caption">{i.date}</T>
              </View>
              <T variant="label" color="error">{deductionText(i.deduction_type, i.value, currency)}</T>
            </Row>
          ))}
        </Card>
      )}
    </View>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: R.md, padding: S.md }}>
      <T variant="h3" numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      <T variant="caption">{label}</T>
    </View>
  );
}
