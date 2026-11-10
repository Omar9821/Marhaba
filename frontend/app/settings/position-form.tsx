import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, getCached, uid } from "@/src/api";
import { num } from "@/src/format";
import { useTheme } from "@/src/theme";
import { Position } from "@/src/types";
import { Btn, Card, ConfirmSheet, Field, Header, Icon, Loading, Pill, Row, S, T, useToast } from "@/src/ui";

type KpiForm = { id: string; name: string; weight: string; target: string; unit: string };

export default function PositionForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [ready, setReady] = useState(!id);
  const [name, setName] = useState("");
  const [pointValue, setPointValue] = useState("");
  const [kpis, setKpis] = useState<KpiForm[]>([{ id: uid(), name: "", weight: "100", target: "", unit: "" }]);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCached<Position[]>("/positions").then(({ data }) => {
      const p = data.find((x) => x.id === id);
      if (p) {
        setName(p.name);
        setPointValue(p.point_value ? String(p.point_value) : "");
        setKpis(p.kpis.map((k) => ({ id: k.id, name: k.name, weight: String(k.weight), target: String(k.target), unit: k.unit })));
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, [id]);

  const n = (s: string) => parseFloat(s.replace(",", ".")) || 0;
  const sum = kpis.reduce((a, k) => a + n(k.weight), 0);
  const upd = (i: number, k: keyof KpiForm, v: string) => setKpis((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const save = async () => {
    if (!name.trim()) return toast("اسم المنصب مطلوب", "error");
    if (kpis.some((k) => !k.name.trim())) return toast("أدخل اسم كل مؤشر", "error");
    if (kpis.length && Math.abs(sum - 100) > 0.01) return toast("مجموع الأوزان يجب أن يساوي 100%", "error");
    setSaving(true);
    const body = { name: name.trim(), point_value: pointValue ? n(pointValue) : null, kpis: kpis.map((k) => ({ id: k.id, name: k.name.trim(), weight: n(k.weight), target: n(k.target), unit: k.unit.trim() })) };
    try {
      if (id) await api.put(`/positions/${id}`, body);
      else await api.post("/positions", body);
      toast("تم حفظ المنصب");
      router.back();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setSaving(true);
    try {
      await api.del(`/positions/${id}`);
      toast("تم حذف المنصب");
      setConfirmDel(false);
      router.back();
    } catch (e: any) {
      setConfirmDel(false);
      toast(e?.message || "تعذر الحذف", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title={id ? "تعديل المنصب" : "منصب جديد"} />
      {!ready ? (
        <Loading />
      ) : (
        <>
          <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            <Card style={{ gap: S.md }}>
              <Field testID="position-name-input" label="اسم المنصب" value={name} onChangeText={setName} placeholder="مثال: مسؤول مبيعات" />
              <Field testID="position-point-value-input" label="قيمة النقطة الخاصة بالمنصب (دج)" value={pointValue} onChangeText={setPointValue} keyboardType="decimal-pad" placeholder="اتركه فارغاً لاعتماد القيمة العامة" />
            </Card>
            <Row style={{ justifyContent: "space-between" }}>
              <T variant="h2">مؤشرات الأداء</T>
              <Pill testID="weights-sum-pill" label={`المجموع ${num(sum, 1)}%`} tone={Math.abs(sum - 100) < 0.01 ? "success" : "error"} />
            </Row>
            {kpis.map((k, i) => (
              <Card key={k.id} style={{ gap: S.md }} testID={`kpi-form-card-${i}`}>
                <Row style={{ justifyContent: "space-between" }}>
                  <T variant="label" color="muted">المؤشر {i + 1}</T>
                  <Pressable testID={`remove-kpi-button-${i}`} onPress={() => setKpis((s) => s.filter((_, j) => j !== i))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                </Row>
                <Field testID={`kpi-name-input-${i}`} label="اسم المؤشر" value={k.name} onChangeText={(v) => upd(i, "name", v)} placeholder="مثال: رقم المبيعات" />
                <Row style={{ gap: S.sm, alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}><Field testID={`kpi-weight-input-${i}`} label="الوزن %" value={k.weight} onChangeText={(v) => upd(i, "weight", v)} keyboardType="decimal-pad" /></View>
                  <View style={{ flex: 1 }}><Field testID={`kpi-target-input-${i}`} label="الهدف اليومي" value={k.target} onChangeText={(v) => upd(i, "target", v)} keyboardType="decimal-pad" /></View>
                  <View style={{ flex: 1 }}><Field testID={`kpi-unit-input-${i}`} label="الوحدة" value={k.unit} onChangeText={(v) => upd(i, "unit", v)} placeholder="دج" /></View>
                </Row>
              </Card>
            ))}
            <Btn testID="add-kpi-button" title="إضافة مؤشر" variant="secondary" icon="add" onPress={() => setKpis((s) => [...s, { id: uid(), name: "", weight: "0", target: "", unit: "" }])} />
            {id ? <Btn testID="delete-position-button" title="حذف المنصب" variant="ghost" icon="trash-outline" onPress={() => setConfirmDel(true)} /> : null}
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn testID="save-position-button" title="حفظ" onPress={save} loading={saving} />
          </View>
        </>
      )}
      <ConfirmSheet visible={confirmDel} title="حذف المنصب" message="لا يمكن حذف منصب مرتبط بموظفين. هل تريد المتابعة؟" confirmLabel="حذف" loading={saving} onClose={() => setConfirmDel(false)} onConfirm={remove} />
    </View>
  );
}
