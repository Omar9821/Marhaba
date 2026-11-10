import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { DEDUCTION_LABEL, deductionText } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { InfType } from "@/src/types";
import { Btn, EmptyState, ErrorView, Field, Header, Icon, Loading, R, Row, S, Segmented, Sheet, SwitchRow, T, useToast } from "@/src/ui";

type Form = { id?: string; name: string; deduction_type: InfType["deduction_type"]; value: string; active: boolean };
const EMPTY: Form = { name: "", deduction_type: "points", value: "", active: true };

export default function InfractionTypes() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const q = useApi<InfType[]>("/infraction-types");
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = async (t: InfType, active: boolean) => {
    q.setData((q.data ?? []).map((x) => (x.id === t.id ? { ...x, active } : x)));
    try {
      await api.put(`/infraction-types/${t.id}`, { ...t, active });
    } catch (e: any) {
      toast(e?.message || "تعذر التحديث", "error");
      q.reload();
    }
  };
  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) return toast("اسم المخالفة مطلوب", "error");
    setSaving(true);
    const body = { name: form.name.trim(), deduction_type: form.deduction_type, value: parseFloat(form.value.replace(",", ".")) || 0, active: form.active };
    try {
      if (form.id) await api.put(`/infraction-types/${form.id}`, body);
      else await api.post("/infraction-types", body);
      toast("تم حفظ المخالفة");
      setForm(null);
      q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!form?.id) return;
    setSaving(true);
    try {
      await api.del(`/infraction-types/${form.id}`);
      toast("تم حذف المخالفة");
      setForm(null);
      q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الحذف", "error");
    } finally {
      setSaving(false);
    }
  };

  const unitLabel = form?.deduction_type === "points" ? "عدد النقاط المخصومة" : form?.deduction_type === "percent" ? "النسبة المخصومة من المنحة %" : "المبلغ المخصوم (دج)";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header
        back
        title="المخالفات والخصومات"
        right={
          <Pressable testID="add-infraction-type-button" onPress={() => setForm({ ...EMPTY })} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
            <Icon name="add" size={24} color={colors.onBrandPrimary} />
          </Pressable>
        }
      />
      {q.loading ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ padding: S.lg, gap: S.sm, paddingBottom: insets.bottom + S.xl }}
          ListHeaderComponent={<T variant="caption" style={{ marginBottom: S.sm }}>المخالفات المعطلة لا تظهر في قائمة الإدخال اليومي، ويبقى سجلها محفوظاً.</T>}
          ListEmptyComponent={<EmptyState icon="warning-outline" title="لم يتم إعداد المخالفات بعد" />}
          renderItem={({ item, index }) => (
            <Pressable
              testID={`infraction-type-row-${index}`}
              onPress={() => setForm({ id: item.id, name: item.name, deduction_type: item.deduction_type, value: String(item.value), active: item.active })}
              style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: S.md, padding: S.md, borderRadius: R.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : item.active ? 1 : 0.6 })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="label">{item.name}</T>
                <T variant="caption">{DEDUCTION_LABEL[item.deduction_type]} • <T variant="caption" color="error">{deductionText(item.deduction_type, item.value)}</T></T>
              </View>
              <Switch testID={`infraction-type-active-switch-${index}`} value={item.active} onValueChange={(v) => toggle(item, v)} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surface} />
            </Pressable>
          )}
        />
      )}
      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? "تعديل المخالفة" : "مخالفة جديدة"} testID="infraction-type-sheet">
        {form ? (
          <>
            <Field testID="infraction-type-name-input" label="اسم المخالفة" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="مثال: تأخر عن العمل" />
            <T variant="label" color="onSurfaceSecondary">نوع الخصم</T>
            <Segmented testID="deduction-type" value={form.deduction_type} onChange={(v) => setForm({ ...form, deduction_type: v })} options={[{ key: "points", label: "نقاط" }, { key: "percent", label: "نسبة %" }, { key: "amount", label: "مبلغ دج" }]} />
            <Field testID="infraction-type-value-input" label={unitLabel} value={form.value} onChangeText={(v) => setForm({ ...form, value: v })} keyboardType="decimal-pad" placeholder="0" />
            <SwitchRow testID="infraction-type-sheet-active-switch" label="مفعلة في الإدخال اليومي" value={form.active} onChange={(v) => setForm({ ...form, active: v })} />
            <Btn testID="save-infraction-type-button" title="حفظ" onPress={save} loading={saving} />
            {form.id ? <Btn testID="delete-infraction-type-button" title="حذف المخالفة" variant="ghost" icon="trash-outline" onPress={remove} /> : null}
            <Row />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
