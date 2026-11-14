import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, getCached } from "@/src/api";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Employee, PerfType, Position, SheetParams, typeOf } from "@/src/types";
import { Btn, Card, Chip, ConfirmSheet, Field, Header, Loading, Row, S, SwitchRow, T, useToast } from "@/src/ui";

export default function EmployeeForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const positions = useApi<Position[]>("/positions");
  const params = useApi<SheetParams>("/sheet/params");
  const staff = useApi<Employee[]>("/employees");
  const [ready, setReady] = useState(!id);
  const [f, setF] = useState({ full_name: "", phone: "", email: "", password: "", position_id: "", hire_date: "", base_salary: "", status: "active" as "active" | "inactive", perf_type: "pool" as PerfType, post_weight: "", supervisor: false, supervise_employees: [] as string[] });
  const pickPosition = (p: Position) => setF((s) => (id ? { ...s, position_id: p.id } : { ...s, position_id: p.id, perf_type: p.perf_type ?? s.perf_type, post_weight: p.post_weight == null ? s.post_weight : String(p.post_weight) }));
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: keyof typeof f) => (v: any) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    getCached<Employee[]>("/employees").then(({ data }) => {
      const e = data.find((x) => x.id === id);
      if (e) setF({ full_name: e.full_name, phone: e.phone, email: e.email ?? "", password: "", position_id: e.position_id, hire_date: e.hire_date, base_salary: String(e.base_salary), status: e.status, perf_type: e.perf_type ?? "pool", post_weight: e.post_weight == null ? "" : String(e.post_weight), supervisor: !!e.supervisor, supervise_employees: e.supervise_employees ?? [] });
      setReady(true);
    }).catch(() => setReady(true));
  }, [id]);
  useEffect(() => {
    if (!id && !f.position_id && positions.data?.length) { const p0 = positions.data[0]; setF((s) => ({ ...s, position_id: p0.id, perf_type: p0.perf_type ?? s.perf_type, post_weight: p0.post_weight == null ? s.post_weight : String(p0.post_weight) })); }
  }, [positions.data, id, f.position_id]);

  const save = async () => {
    if (!f.full_name.trim()) return toast("الاسم الكامل مطلوب", "error");
    if (!f.position_id) return toast("اختر المنصب", "error");
    if (f.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(f.hire_date)) return toast("صيغة التاريخ: YYYY-MM-DD", "error");
    if (f.supervisor && !f.email.trim()) return toast("أدخل البريد الإلكتروني وكلمة المرور لمنح صلاحية المراقب", "error");
    setSaving(true);
    const body = { ...f, full_name: f.full_name.trim(), email: f.email.trim() || null, password: f.password || null, base_salary: parseFloat(f.base_salary.replace(",", ".")) || 0, post_weight: f.post_weight.trim() !== "" ? parseFloat(f.post_weight.replace(",", ".")) || 0 : null };
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
      {!ready || positions.loading || params.loading || staff.loading ? (
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
                  <Chip key={p.id} testID={`position-option-${i}`} label={p.name} selected={f.position_id === p.id} onPress={() => pickPosition(p)} />
                ))}
              </Row>
              <Field testID="employee-salary-input" label="الراتب الأساسي (دج)" value={f.base_salary} onChangeText={set("base_salary")} keyboardType="decimal-pad" placeholder="40000" hint="يُخزن مشفراً في قاعدة البيانات" />
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">نوع العمولة والوزن (جدول الأداء)</T>
              <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                {(params.data?.commission_types ?? []).map((t) => (
                  <Chip key={t.id} testID={`perf-type-${t.id}`} label={t.label} selected={f.perf_type === t.id} onPress={() => set("perf_type")(t.id)} />
                ))}
              </Row>
              <Field testID="employee-post-weight-input" label="الوزن" value={f.post_weight} onChangeText={set("post_weight")} keyboardType="decimal-pad" placeholder="1"
                hint="يُوزَّع المجمَّع بنسبة الوزن على من لا أساس عمولة له (العمال). يُملأ تلقائيًا من المنصب." />
              {typeOf(params.data?.commission_types, f.perf_type)?.kind === "rate" ? (
                <T variant="caption">عمولة على أساس: يكتب المسير الأساس ({typeOf(params.data?.commission_types, f.perf_type)?.base_label || "الأساس"}) في جدول الأداء.</T>
              ) : null}
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">حساب الدخول لبوابة الموظف</T>
              <Field testID="employee-email-input" label="البريد الإلكتروني" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" placeholder="employee@company.dz" hint="يمكن للموظف الدخول به عبر Google أو بكلمة المرور" />
              <Field testID="employee-password-input" label={id ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور (اختياري)"} value={f.password} onChangeText={set("password")} secureTextEntry placeholder="6 أحرف على الأقل" />
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">صلاحية المراقب</T>
              <SwitchRow testID="employee-supervisor-switch" label="يراقب فريقه" hint="يمنحه المسير بوابة المراقب: يسجّل المخالفات والنتائج ويردّ على طلبات عمال الفريق الذي يحدّده فقط. صلاحياته تُضبط من الإعدادات ← صلاحيات المراقب." value={f.supervisor} onChange={(v) => set("supervisor")(v)} />
              {f.supervisor ? (
                <>
                  <T variant="label" color="onSurfaceSecondary">العمال التابعون له ({f.supervise_employees.length})</T>
                  <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                    <Chip testID="supervise-same-position" label="كل عمال منصبه" selected={false} onPress={() => setF((s) => ({ ...s, supervise_employees: Array.from(new Set([...s.supervise_employees, ...(staff.data ?? []).filter((e) => e.position_id === s.position_id && e.id !== id && e.status === "active").map((e) => e.id)])) }))} />
                    <Chip testID="supervise-clear" label="مسح الاختيار" selected={false} onPress={() => setF((s) => ({ ...s, supervise_employees: [] }))} />
                  </Row>
                  <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                    {(staff.data ?? []).filter((e) => e.id !== id && e.status === "active").map((e, i) => {
                      const on = f.supervise_employees.includes(e.id);
                      return <Chip key={e.id} testID={`supervise-employee-${i}`} label={`${e.full_name} · ${e.position_name}`} selected={on} onPress={() => setF((s) => ({ ...s, supervise_employees: on ? s.supervise_employees.filter((x) => x !== e.id) : [...s.supervise_employees, e.id] }))} />;
                    })}
                  </Row>
                  <T variant="caption">يلزم البريد وكلمة المرور في قسم «حساب الدخول» أعلاه. يرى المراقب هؤلاء العمال فقط، ولا يراقب نفسه: يقيّمه المسير من جدول الأداء ويرى هو نتيجته ومنحته في تبويب «أدائي».</T>
                </>
              ) : null}
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
