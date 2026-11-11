import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, getCached } from "@/src/api";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Position, SheetParams } from "@/src/types";
import { Btn, Card, Chip, ConfirmSheet, Field, Header, Loading, Row, S, T, useToast } from "@/src/ui";

export default function PositionForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const params = useApi<SheetParams>("/sheet/params");
  const [ready, setReady] = useState(!id);
  const [name, setName] = useState("");
  const [perfType, setPerfType] = useState("pool");
  const [weight, setWeight] = useState("");
  const [old, setOld] = useState<Position | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCached<Position[]>("/positions").then(({ data }) => {
      const p = data.find((x) => x.id === id);
      if (p) {
        setOld(p);
        setName(p.name);
        setPerfType(p.perf_type ?? "pool");
        setWeight(p.post_weight == null ? "" : String(p.post_weight));
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, [id]);

  const save = async () => {
    if (!name.trim()) return toast("اسم المنصب مطلوب", "error");
    setSaving(true);
    const w = weight.trim() === "" ? null : parseFloat(weight.replace(",", ".")) || 0;
    const body = { name: name.trim(), point_value: old?.point_value ?? null, kpis: old?.kpis ?? [], perf_type: perfType, post_weight: w };
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
      {!ready || params.loading ? <Loading /> : (
        <>
          <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            <Card style={{ gap: S.md }}>
              <Field testID="position-name-input" label="اسم المنصب" value={name} onChangeText={setName} placeholder="مثال: مسؤول مبيعات" />
              <T variant="label" color="onSurfaceSecondary">نوع العمولة الافتراضي لهذا المنصب</T>
              <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                {(params.data?.commission_types ?? []).map((t) => (
                  <Chip key={t.id} testID={`position-ctype-${t.id}`} label={t.label} selected={perfType === t.id} onPress={() => setPerfType(t.id)} />
                ))}
              </Row>
              <Field testID="position-weight-input" label="وزن المنصب الافتراضي" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="1"
                hint="يُقترح تلقائيًا عند إضافة موظف بهذا المنصب (يمكن تغييره لكل موظف). يُستعمل لتوزيع المجمَّع." />
              <T variant="caption">تُدار أنواع العمولة نفسها من «أنواع العمولة» في الإعدادات.</T>
            </Card>
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
