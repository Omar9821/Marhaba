import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { money, num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Settings } from "@/src/types";
import { Btn, Card, ErrorView, Field, Header, Loading, R, S, Segmented, T, useToast } from "@/src/ui";

const NUM_KEYS = ["point_value", "multiplier", "salary_rate", "max_ratio", "bonus_cap", "fund_percent", "competitive_percent", "competitive_winners", "max_infractions", "min_score"] as const;

export default function Rules() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const q = useApi<Settings>("/settings");
  const [f, setF] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"points" | "salary">("points");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    const m: Record<string, string> = {};
    NUM_KEYS.forEach((k) => (m[k] = String(q.data![k])));
    setF(m);
    setMode(q.data.bonus_mode);
  }, [q.data]);

  const n = (k: string) => parseFloat((f[k] ?? "").replace(",", ".")) || 0;
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const example = mode === "points" ? 90 * n("point_value") * n("multiplier") : 40000 * (n("salary_rate") / 100) * 0.9 * n("multiplier");

  const save = async () => {
    setSaving(true);
    const body: any = { currency: q.data?.currency ?? "دج", bonus_mode: mode };
    NUM_KEYS.forEach((k) => (body[k] = k === "competitive_winners" || k === "max_infractions" ? Math.round(n(k)) : n(k)));
    try {
      await api.put("/settings", body);
      toast("تم حفظ قواعد المنح، وستُطبق على كل الحسابات فوراً");
      q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="المعاملات وقواعد المنح" />
      {q.loading ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : (
        <>
          <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            <Card style={{ gap: S.md }}>
              <T variant="h3">طريقة حساب المنحة</T>
              <Segmented testID="bonus-mode" value={mode} onChange={setMode} options={[{ key: "points", label: "بالنقاط" }, { key: "salary", label: "نسبة من الراتب" }]} />
              {mode === "points" ? (
                <>
                  <Field testID="rule-point-value-input" label="قيمة النقطة (دج)" value={f.point_value} onChangeText={set("point_value")} keyboardType="decimal-pad" hint="المبلغ المستحق مقابل كل نقطة أداء" />
                </>
              ) : (
                <Field testID="rule-salary-rate-input" label="النسبة القصوى للمنحة من الراتب %" value={f.salary_rate} onChangeText={set("salary_rate")} keyboardType="decimal-pad" hint="تُضرب في نسبة الأداء المحققة" />
              )}
              <Field testID="rule-multiplier-input" label="المعامل الحسابي" value={f.multiplier} onChangeText={set("multiplier")} keyboardType="decimal-pad" hint="يُضرب في النتيجة لتحويل النقاط إلى منحة" />
              <Field testID="rule-max-ratio-input" label="الحد الأقصى لنسبة تحقيق المؤشر %" value={f.max_ratio} onChangeText={set("max_ratio")} keyboardType="decimal-pad" hint="مثال: 120 تعني احتساب التجاوز حتى 120% من الهدف" />
              <View style={{ backgroundColor: colors.brandTertiary, borderRadius: R.md, padding: S.md }}>
                <T variant="caption" color="onBrandTertiary">مثال: موظف بنسبة أداء 90%{mode === "salary" ? " وراتب 40 000 دج" : ""}</T>
                <T testID="rule-example-value" variant="h3" color="brand">≈ {money(example)}</T>
              </View>
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">ميزانية المنح والصناديق</T>
              <Field testID="rule-bonus-cap-input" label="السقف الأعلى للمنحة (دج)" value={f.bonus_cap} onChangeText={set("bonus_cap")} keyboardType="decimal-pad" hint="0 = بدون سقف" />
              <Field testID="rule-fund-percent-input" label="نسبة الاقتطاع لصندوق الترفيه %" value={f.fund_percent} onChangeText={set("fund_percent")} keyboardType="decimal-pad" />
              <Field testID="rule-competitive-percent-input" label="نسبة الصندوق الموجهة للمنح التنافسية %" value={f.competitive_percent} onChangeText={set("competitive_percent")} keyboardType="decimal-pad" />
              <Field testID="rule-competitive-winners-input" label="عدد الفائزين بالمنحة التنافسية" value={f.competitive_winners} onChangeText={set("competitive_winners")} keyboardType="number-pad" hint="الأعلى أداءً في الشهر" />
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">شروط الاستحقاق</T>
              <Field testID="rule-max-infractions-input" label="الحد الأقصى للمخالفات الشهرية" value={f.max_infractions} onChangeText={set("max_infractions")} keyboardType="number-pad" hint="عند تجاوزه لا يستحق الموظف المنحة" />
              <Field testID="rule-min-score-input" label="الحد الأدنى لنسبة الأداء %" value={f.min_score} onChangeText={set("min_score")} keyboardType="decimal-pad" hint={`أقل من ${num(n("min_score"))}% = لا منحة`} />
            </Card>
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn testID="save-rules-button" title="حفظ القواعد" onPress={save} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}
