import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, getCached } from "@/src/api";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Employee, PERF_TYPE_LABEL, PerfType, Position } from "@/src/types";
import { Btn, Card, Chip, ConfirmSheet, Field, Header, Loading, Row, S, SwitchRow, T, useToast } from "@/src/ui";

export default function EmployeeForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const positions = useApi<Position[]>("/positions");
  const [ready, setReady] = useState(!id);
  const [f, setF] = useState({ full_name: "", phone: "", email: "", password: "", position_id: "", hire_date: "", base_salary: "", status: "active" as "active" | "inactive", perf_type: "pool" as PerfType, post_weight: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: keyof typeof f) => (v: any) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    getCached<Employee[]>("/employees").then(({ data }) => {
      const e = data.find((x) => x.id === id);
      if (e) setF({ full_name: e.full_name, phone: e.phone, email: e.email ?? "", password: "", position_id: e.position_id, hire_date: e.hire_date, base_salary: String(e.base_salary), status: e.status, perf_type: e.perf_type ?? "pool", post_weight: e.post_weight == null ? "" : String(e.post_weight) });
      setReady(true);
    }).catch(() => setReady(true));
  }, [id]);
  useEffect(() => {
    if (!id && !f.position_id && positions.data?.length) setF((s) => ({ ...s, position_id: positions.data![0].id }));
  }, [positions.data, id, f.position_id]);

  const save = async () => {
    if (!f.full_name.trim()) return toast("الاسم الكامل مطلوب", "error");
    if (!f.position_id) return toast("اختر المنصب", "error");
    if (f.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(f.hire_date)) return toast("صيغة التاريخ: YYYY-MM-DD", "error");
    setSaving(true);
    const body = { ...f, full_name: f.full_name.trim(), email: f.email.trim() || null, password: f.password || null, base_salary: parseFloat(f.base_salary.replace(",", ".")) || 0, post_weight: f.perf_type === "pool" && f.post_weight.trim() !== "" ? parseFloat(f.post_weight.replace(",", ".")) || 0 : null };
    try {
      if (id) await api.put(`/employees/${id}`, body);
      else await api.post("/employees", body);
      toast(id ? "تم تحديث بيانات الموظف" : "تمت إضافة الموظف");
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
      await api.del(`/employees/${id}`);
      toast("تم حذف الموظف وسجلاته");
      setConfirmDel(false);
      router.back();
    } catch (e: any) {
      toast(e?.message || "تعذر الحذف", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title={id ? "تعديل موظف" : "موظف جديد"} />
      {!ready || positions.loading ? (
        <Loading />
      ) : (
        <>
          <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            <Card style={{ gap: S.md }}>
              <T variant="h3">البيانات الشخصية</T>
              <Field testID="employee-name-input" label="الاسم الكامل" value={f.full_name} onChangeText={set("full_name")} placeholder="مثال: محمد أمين" />
              <Field testID="employee-phone-input" label="رقم الهاتف" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="05XXXXXXXX" />
              <Field testID="employee-hire-date-input" label="تاريخ التوظيف" value={f.hire_date} onChangeText={set("hire_date")} placeholder="2024-01-15" hint="بالصيغة سنة-شهر-يوم" />
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">المنصب والراتب</T>
              <T variant="label" color="onSurfaceSecondary">المنصب / الوظيفة</T>
              <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                {(positions.data ?? []).map((p, i) => (
                  <Chip key={p.id} testID={`position-option-${i}`} label={p.name} selected={f.position_id === p.id} onPress={() => set("position_id")(p.id)} />
                ))}
              </Row>
              <Field testID="employee-salary-input" label="الراتب الأساسي (دج)" value={f.base_salary} onChangeText={set("base_salary")} keyboardType="decimal-pad" placeholder="40000" hint="يُخزن مشفراً في قاعدة البيانات" />
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">نوع المردودية (جدول الأداء)</T>
              <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                {(Object.keys(PERF_TYPE_LABEL) as PerfType[]).map((k) => (
                  <Chip key={k} testID={`perf-type-${k}`} label={PERF_TYPE_LABEL[k]} selected={f.perf_type === k} onPress={() => set("perf_type")(k)} />
                ))}
              </Row>
              {f.perf_type === "pool" ? (
                <Field testID="employee-post-weight-input" label="وزن المنصب (للعمال فقط)" value={f.post_weight} onChangeText={set("post_weight")} keyboardType="decimal-pad" placeholder="1" hint="يُوزَّع المجمَّع بنسبة وزن كل منصب" />
              ) : (
                <T variant="caption">التجاري/المالية/التقطيع: عمولة = الأساس × النسبة (الأساس يكتبه المسير في جدول الأداء).</T>
              )}
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">حساب الدخول لبوابة الموظف</T>
              <Field testID="employee-email-input" label="البريد الإلكتروني" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" placeholder="employee@company.dz" hint="يمكن للموظف الدخول به عبر Google أو بكلمة المرور" />
              <Field testID="employee-password-input" label={id ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور (اختياري)"} value={f.password} onChangeText={set("password")} secureTextEntry placeholder="6 أحرف على الأقل" />
            </Card>
            <Card>
              <SwitchRow testID="employee-status-switch" label="الحالة: نشط" hint="الموظف المعطل يُحفظ سجله ولا يظهر في القوائم اليومية" value={f.status === "active"} onChange={(v) => set("status")(v ? "active" : "inactive")} />
            </Card>
            {id ? <Btn testID="delete-employee-button" title="حذف الموظف نهائياً" variant="ghost" icon="trash-outline" onPress={() => setConfirmDel(true)} /> : null}
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn testID="save-employee-button" title="حفظ" onPress={save} loading={saving} />
          </View>
        </>
      )}
      <ConfirmSheet visible={confirmDel} title="حذف الموظف" message="سيتم حذف الموظف وكل سجلات أدائه ومخالفاته. للحفاظ على السجل التاريخي، يُفضل تعطيله بدلاً من الحذف." confirmLabel="حذف نهائي" loading={saving} onClose={() => setConfirmDel(false)} onConfirm={remove} />
    </View>
  );
}
