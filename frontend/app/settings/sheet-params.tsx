import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { parseNum } from "@/src/components/sheet-ui";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { SheetParams } from "@/src/types";
import { Btn, Card, Field, Header, Loading, S, T, useToast } from "@/src/ui";

type NumKey = Exclude<keyof SheetParams, "commission_types" | "violation_types">;
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

  useEffect(() => {
    if (!q.data) return;
    const m: Record<string, string> = {};
    GROUPS.forEach((g) => g.defs.forEach((d) => { m[d.key] = String(Math.round(q.data![d.key] * d.scale * 1e6) / 1e6); }));
    setF(m);
  }, [q.data]);

  const save = async () => {
    const body: Record<string, number> = {};
    for (const g of GROUPS) for (const d of g.defs) {
      const v = parseNum(f[d.key] ?? "");
      if (v === null || v < 0) return toast(`قيمة غير صالحة: ${d.label}`, "error");
      body[d.key] = v / d.scale;
    }
    if (body.pass_threshold > 1 || body.pool_rate > 1 || body.fund_ratio > 1)
      return toast("النسب يجب ألا تتجاوز 100%", "error");
    setSaving(true);
    try {
      await api.put("/sheet/params", { ...q.data, ...body });
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
      <Header back title="معاملات جدول الأداء" subtitle="الأوزان والحدود والمجمَّع والصندوق" />
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
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn testID="save-params-button" title="حفظ المعاملات" onPress={save} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}
