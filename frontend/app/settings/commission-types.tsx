import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uid } from "@/src/api";
import { parseNum } from "@/src/components/sheet-ui";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { SheetParams } from "@/src/types";
import { Btn, Card, Chip, Field, Header, Icon, Loading, Row, S, T, useToast } from "@/src/ui";

type Form = { id: string; label: string; kind: "rate" | "pool"; base_label: string; unit: string; rate: string; share: string };
const isMoney = (u: string) => !u.trim() || u.trim() === "دج";

const toForm = (t: SheetParams["commission_types"][number]): Form => ({
  id: t.id, label: t.label, kind: t.kind, base_label: t.base_label, unit: t.unit,
  rate: String(Math.round((isMoney(t.unit) ? t.rate * 100 : t.rate) * 1e6) / 1e6), share: String(Math.round(t.share * 100 * 1e6) / 1e6),
});

export default function CommissionTypesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const q = useApi<SheetParams>("/sheet/params");
  const [items, setItems] = useState<Form[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) setItems(q.data.commission_types.map(toForm));
  }, [q.data]);
  const upd = (i: number, k: keyof Form, v: string) => setItems((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const save = async () => {
    const out = [];
    for (const it of items) {
      if (!it.label.trim()) return toast("أدخل اسم كل نوع", "error");
      const rate = parseNum(it.rate) ?? 0;
      const share = parseNum(it.share) ?? 0;
      if (it.kind === "rate" && rate < 0) return toast(`قيمة غير صالحة في «${it.label}»`, "error");
      if (share < 0 || share > 100) return toast(`الحصة المشروطة في «${it.label}» بين 0 و100%`, "error");
      out.push({ id: it.id, label: it.label.trim(), kind: it.kind, base_label: it.base_label.trim(), unit: it.unit.trim(),
        rate: it.kind === "pool" ? 0 : isMoney(it.unit) ? rate / 100 : rate, share: it.kind === "pool" ? 0 : share / 100 });
    }
    setSaving(true);
    try {
      await api.put("/sheet/params", { ...q.data, commission_types: out });
      toast("تم حفظ أنواع العمولة");
      router.back();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="أنواع العمولة" subtitle="تجاري، مالية، متر مربع، عامل… أضف ما تشاء" />
      {q.loading ? <Loading /> : (
        <>
          <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            <T variant="caption">«عمولة على أساس»: المنحة القصوى = الأساس الذي يكتبه المسير × النسبة (أو سعر الوحدة)، والحصة المشروطة بالأداء تتأثر بنتيجة التفتيش. «مجمَّع»: لا أساس له، يُوزَّع عليه المجمَّع حسب وزن المنصب.</T>
            {items.map((it, i) => {
              const money = isMoney(it.unit);
              return (
                <Card key={it.id} style={{ gap: S.md }} testID={`ctype-${i}`}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <T variant="label" color="muted">النوع {i + 1}</T>
                    {it.id !== "pool" ? (
                      <Pressable testID={`ctype-remove-${i}`} onPress={() => setItems((s) => s.filter((_, j) => j !== i))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                        <Icon name="trash-outline" size={20} color={colors.error} />
                      </Pressable>
                    ) : null}
                  </Row>
                  <Field testID={`ctype-label-${i}`} label="اسم النوع" value={it.label} onChangeText={(v) => upd(i, "label", v)} placeholder="مثال: متر مربع" />
                  <Row style={{ gap: S.sm }}>
                    <Chip label="عمولة على أساس" selected={it.kind === "rate"} onPress={() => upd(i, "kind", "rate")} />
                    <Chip label="مجمَّع (حسب الوزن)" selected={it.kind === "pool"} onPress={() => upd(i, "kind", "pool")} />
                  </Row>
                  {it.kind === "rate" ? (
                    <>
                      <Field testID={`ctype-base-${i}`} label="اسم الأساس" value={it.base_label} onChangeText={(v) => upd(i, "base_label", v)} placeholder="رقم الأعمال / المتر المربع / المبالغ المستردة" />
                      <Field testID={`ctype-unit-${i}`} label="وحدة الأساس" value={it.unit} onChangeText={(v) => upd(i, "unit", v)} placeholder="دج أو متر أو م²…" hint="«دج» ← النسبة بالمئة من المبلغ · أي وحدة أخرى ← سعر الوحدة بالدينار" />
                      <Field testID={`ctype-rate-${i}`} label={money ? "نسبة العمولة (%)" : `سعر الوحدة (دج لكل ${it.unit.trim()})`} value={it.rate} onChangeText={(v) => upd(i, "rate", v)} keyboardType="decimal-pad" />
                      <Field testID={`ctype-share-${i}`} label="الحصة المشروطة بالأداء (%)" value={it.share} onChangeText={(v) => upd(i, "share", v)} keyboardType="decimal-pad" hint="النسبة من العمولة التي تتأثر بنتيجة الأداء" />
                    </>
                  ) : <T variant="caption">يُوزَّع عليهم المجمَّع بنسبة وزن المنصب المكتوب في ملف الموظف.</T>}
                </Card>
              );
            })}
            <Btn testID="ctype-add" title="إضافة نوع عمولة" variant="secondary" icon="add"
              onPress={() => setItems((s) => [...s, { id: "t" + uid().slice(-8), label: "", kind: "rate", base_label: "", unit: "دج", rate: "0", share: "40" }])} />
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn testID="ctype-save" title="حفظ" onPress={save} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}
