import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uid } from "@/src/api";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { IMPACT_LABEL, ImpactGroup, SheetParams, ViolationType } from "@/src/types";
import { Btn, Card, Chip, Field, Header, Icon, Loading, Row, S, SwitchRow, T, useToast } from "@/src/ui";

export default function ViolationTypesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const q = useApi<SheetParams>("/sheet/params");
  const [items, setItems] = useState<ViolationType[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) setItems(q.data.violation_types);
  }, [q.data]);
  const upd = (i: number, patch: Partial<ViolationType>) => setItems((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    if (items.some((t) => !t.label.trim())) return toast("أدخل اسم كل مخالفة", "error");
    setSaving(true);
    try {
      await api.put("/sheet/params", { ...q.data, violation_types: items.map((t) => ({ ...t, label: t.label.trim() })) });
      toast("تم حفظ أنواع المخالفات");
      router.back();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="أنواع المخالفات" subtitle="أضف مخالفة وحدّد أثرها على المنحة" />
      {q.loading ? <Loading /> : (
        <>
          <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            <T variant="caption">كل مخالفة تُسجَّل في «سجل المخالفات» تُحتسب تلقائيًا حسب الأثر الذي تختاره: التأخرات والغيابات (كل مخالفة = يوم)، الهندام والنظافة (أي مخالفة = رسوب)، الاحترام (أي مخالفة = «لا»)، أو «لا يؤثر» (للتوثيق فقط). المخالفة المعطَّلة تختفي من الإدخال وتبقى سجلاتها السابقة.</T>
            {items.map((t, i) => (
              <Card key={t.code} style={{ gap: S.md, opacity: t.active ? 1 : 0.6 }} testID={`vtype-${i}`}>
                <Field testID={`vtype-label-${i}`} label="اسم المخالفة" value={t.label} onChangeText={(v) => upd(i, { label: v })} />
                <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                  {(Object.keys(IMPACT_LABEL) as ImpactGroup[]).map((g) => (
                    <Chip key={g} testID={`vtype-impact-${i}-${g}`} label={IMPACT_LABEL[g]} selected={t.impact === g} onPress={() => upd(i, { impact: g })} />
                  ))}
                </Row>
                <SwitchRow label="مفعَّلة" value={t.active} onChange={(v) => upd(i, { active: v })} />
              </Card>
            ))}
            <Btn testID="vtype-add" title="إضافة مخالفة" variant="secondary" icon="add"
              onPress={() => setItems((s) => [...s, { code: "v" + uid().slice(-8), label: "", impact: "none", active: true }])} />
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn testID="vtype-save" title="حفظ" onPress={save} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}
