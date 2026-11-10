import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { parseNum } from "@/src/components/sheet-ui";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { IMPACT_LABEL, ImpactGroup, SheetParams } from "@/src/types";
import { Btn, Card, Chip, Field, Header, Loading, Row, S, T, useToast } from "@/src/ui";

type NumKey = Exclude<keyof SheetParams, "violation_map" | "violation_types">;
type Def = { key: NumKey; label: string; unit: string; scale: number; hint?: string };
const GROUPS: { title: string; defs: Def[] }[] = [
  { title: "الهندام والنظافة والاحترام", defs: [
    { key: "pass_threshold", label: "حدّ النجاح (نسبة التفتيش)", unit: "%", scale: 100, hint: "نجاح كامل إن بلغت النسبة الحد، وإلا صفر" },
    { key: "w_hygiene", label: "وزن الهندام والنظافة", unit: "%", scale: 100 },
    { key: "w_respect", label: "وزن الاحترام", unit: "%", scale: 100 },
  ] },
  { title: "الخسائر والتأخرات", defs: [
    { key: "loss_limit", label: "حدّ الخسائر", unit: "دج", scale: 1, hint: "يتناقص المعامل خطياً حتى يبلغ الصفر عند هذا الحد" },
    { key: "w_loss", label: "وزن الخسائر", unit: "%", scale: 100 },
    { key: "days_limit", label: "حدّ الأيام (تأخرات + غيابات)", unit: "أيام", scale: 1 },
    { key: "w_days", label: "وزن التأخرات والغيابات", unit: "%", scale: 100 },
  ] },
  { title: "العمولات (التجاريون · المالية · التقطيع)", defs: [
    { key: "rate_commercial", label: "نسبة عمولة التجاريين", unit: "%", scale: 100 },
    { key: "share_commercial", label: "الحصة المشروطة بالأداء (تجاري)", unit: "%", scale: 100 },
    { key: "rate_finance", label: "نسبة عمولة مسؤول المالية", unit: "%", scale: 100 },
    { key: "share_finance", label: "الحصة المشروطة بالأداء (مالية)", unit: "%", scale: 100 },
    { key: "price_meter", label: "سعر المتر المقطوع (التقطيع)", unit: "دج", scale: 1, hint: "يُترك 0 حتى يُحدَّد" },
    { key: "share_cutting", label: "الحصة المشروطة بالأداء (تقطيع)", unit: "%", scale: 100 },
  ] },
  { title: "المجمَّع والصندوق الترفيهي", defs: [
    { key: "pool_rate", label: "نسبة المجمَّع الموزَّع على العمال", unit: "% من رقم الأعمال", scale: 100 },
    { key: "fund_ratio", label: "نسبة الفرق للصندوق الترفيهي", unit: "%", scale: 100 },
  ] },
];

export default function SheetParamsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const q = useApi<SheetParams>("/sheet/params");
  const [f, setF] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [vmap, setVmap] = useState<Record<string, ImpactGroup>>({});

  useEffect(() => {
    if (!q.data) return;
    const m: Record<string, string> = {};
    GROUPS.forEach((g) => g.defs.forEach((d) => { m[d.key] = String(Math.round(q.data![d.key] * d.scale * 1e6) / 1e6); }));
    setF(m);
    setVmap(q.data.violation_map ?? {});
  }, [q.data]);

  const save = async () => {
    const body: Record<string, number> = {};
    for (const g of GROUPS) for (const d of g.defs) {
      const v = parseNum(f[d.key] ?? "");
      if (v === null || v < 0) return toast(`قيمة غير صالحة: ${d.label}`, "error");
      body[d.key] = v / d.scale;
    }
    if (body.pass_threshold > 1 || body.pool_rate > 1 || body.fund_ratio > 1 || body.share_commercial > 1 || body.share_finance > 1 || body.share_cutting > 1)
      return toast("النسب يجب ألا تتجاوز 100%", "error");
    setSaving(true);
    try {
      await api.put("/sheet/params", { ...body, violation_map: vmap });
      toast("تم حفظ المعاملات");
      router.back();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="معاملات جدول الأداء" subtitle="تُضبط مرة واحدة" />
      {q.loading ? <Loading /> : (
        <>
          <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            {GROUPS.map((g) => (
              <Card key={g.title} style={{ gap: S.md }}>
                <T variant="h3">{g.title}</T>
                {g.defs.map((d) => (
                  <Field key={d.key} testID={`param-${d.key}`} label={`${d.label} (${d.unit})`} hint={d.hint} value={f[d.key] ?? ""}
                    onChangeText={(v) => setF((s) => ({ ...s, [d.key]: v }))} keyboardType="decimal-pad" />
                ))}
              </Card>
            ))}
            <Card style={{ gap: S.md }} testID="violation-impact-card">
              <T variant="h3">أثر المخالفات على المنحة</T>
              <T variant="caption">كل مخالفة تُسجَّل في «سجل المخالفات» تُحتسب تلقائيًا في منحة الشهر حسب المؤشر الذي تختاره هنا: التأخرات والغيابات (كل مخالفة = يوم)، الهندام والنظافة (أي مخالفة = رسوب)، الاحترام (أي مخالفة = «لا»).</T>
              {(q.data?.violation_types ?? []).map((t) => (
                <View key={t.code} style={{ gap: S.xs }}>
                  <T variant="label">{t.label}</T>
                  <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                    {(Object.keys(IMPACT_LABEL) as ImpactGroup[]).map((g) => (
                      <Chip key={g} testID={`impact-${t.code}-${g}`} label={IMPACT_LABEL[g]} selected={(vmap[t.code] ?? "none") === g} onPress={() => setVmap((s) => ({ ...s, [t.code]: g }))} />
                    ))}
                  </Row>
                </View>
              ))}
            </Card>
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn testID="save-params-button" title="حفظ المعاملات" onPress={save} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}
