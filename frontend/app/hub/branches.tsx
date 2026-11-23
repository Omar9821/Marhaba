import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Branch } from "@/src/types";
import { Btn, Card, Chip, Field, Header, Loading, Pill, Row, S, SwitchRow, T, useToast } from "@/src/ui";

const ACTIVITIES = [
  { key: "workshop", label: "ورشة / إنتاج" }, { key: "commercial", label: "تجاري" }, { key: "services", label: "خدمات" }, { key: "mirrors", label: "مرايا الحمام LED" }, { key: "other", label: "نشاط آخر" },
];

export default function BranchesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const { enterBranch } = useAuth();
  const q = useApi<Branch[]>("/hub/branches");
  const [editing, setEditing] = useState<string | null>(null);
  const [ed, setEd] = useState({ name: "", activity: "other" });
  const startEdit = (b: Branch) => { setEditing(b.id); setEd({ name: b.name, activity: b.activity }); };
  const saveEdit = async (b: Branch) => {
    if (!ed.name.trim()) return toast("اكتب اسم الفرع", "error");
    try {
      await api.put(`/hub/branches/${b.id}`, { name: ed.name.trim(), activity: ed.activity });
      toast("تم حفظ تعديل الفرع");
      setEditing(null);
      await q.reload();
    } catch (e: any) { toast(e?.message || "تعذر الحفظ", "error"); }
  };
  const open = async (b: Branch) => { await enterBranch(b.id); router.replace("/" as any); };
  const [f, setF] = useState({ name: "", activity: "commercial", admin_email: "", admin_password: "", inspector_email: "", inspector_password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const add = async () => {
    if (!f.name.trim()) return toast("اكتب اسم الفرع", "error");
    if (!f.admin_email.trim() || f.admin_password.length < 6) return toast("أدخل بريد مسيّر الفرع وكلمة مرور (6 أحرف على الأقل)", "error");
    setBusy(true);
    try {
      await api.post("/hub/branches", { ...f, name: f.name.trim() });
      toast("تم إنشاء الفرع بإعداداته حسب النشاط");
      setF({ name: "", activity: "commercial", admin_email: "", admin_password: "", inspector_email: "", inspector_password: "" });
      await q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الإنشاء", "error");
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (b: Branch) => {
    try {
      await api.put(`/hub/branches/${b.id}`, { active: !b.active });
      await q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر التعديل", "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="إدارة الفروع" subtitle="كل فرع له بياناته وإعداداته المستقلة" />
      {q.loading ? <Loading /> : (
        <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: insets.bottom + S.xxl }}>
          <Card style={{ gap: S.md }} testID="branch-form">
            <T variant="h3">فرع جديد</T>
            <Field testID="branch-name" label="اسم الفرع" value={f.name} onChangeText={set("name")} placeholder="مثال: فرع الخدمات — وهران" />
            <T variant="label" color="onSurfaceSecondary">النشاط (يحدّد الإعدادات الأولية: المناصب وأنواع العمولة)</T>
            <Row style={{ flexWrap: "wrap", gap: S.sm }}>
              {ACTIVITIES.map((a) => <Chip key={a.key} testID={`branch-act-${a.key}`} label={a.label} selected={f.activity === a.key} onPress={() => set("activity")(a.key)} />)}
            </Row>
            <Field testID="branch-admin-email" label="بريد مسيّر الفرع" value={f.admin_email} onChangeText={set("admin_email")} autoCapitalize="none" keyboardType="email-address" />
            <Field testID="branch-admin-password" label="كلمة مرور المسيّر" value={f.admin_password} onChangeText={set("admin_password")} secureTextEntry placeholder="6 أحرف على الأقل" />
            <Field testID="branch-insp-email" label="بريد المراقب (اختياري)" value={f.inspector_email} onChangeText={set("inspector_email")} autoCapitalize="none" keyboardType="email-address" />
            <Field testID="branch-insp-password" label="كلمة مرور المراقب (اختياري)" value={f.inspector_password} onChangeText={set("inspector_password")} secureTextEntry />
            <Btn testID="branch-create" title="إنشاء الفرع" icon="add" onPress={add} loading={busy} />
            <T variant="caption">بعد الإنشاء يدخل مسيّر الفرع بحسابه ويضبط موظفيه وإعداداته الخاصة، وتدخل أنت أي فرع من البوابة العامة.</T>
          </Card>
          {[["الفروع النشطة", true], ["الفروع المؤرشفة (المعطّلة)", false]].map(([title, act]) => {
            const list = (q.data ?? []).filter((b) => !!b.active === act);
            if (!list.length) return null;
            return (
              <View key={String(title)} style={{ gap: S.md }}>
                <T variant="h3">{title as string}</T>
                {list.map((b, i) => (
                  <Card key={b.id} style={{ gap: S.sm }} testID={`branch-row-${i}`}>
                    <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                      <View style={{ flex: 1 }}>
                        <T variant="h3">{b.name}</T>
                        <T variant="caption">{ACTIVITIES.find((a) => a.key === b.activity)?.label ?? b.activity}{b.id === "main" ? " · الفرع الرئيسي" : ""}</T>
                      </View>
                      <Pill label={b.active ? "نشط" : "معطّل"} tone={b.active ? "success" : "muted"} />
                    </Row>
                    {editing === b.id ? (
                      <View style={{ gap: S.sm }}>
                        <Field testID={`edit-name-${b.id}`} label="اسم الفرع" value={ed.name} onChangeText={(v) => setEd((s) => ({ ...s, name: v }))} />
                        <T variant="label" color="onSurfaceSecondary">التصنيف (للعرض فقط، لا يغيّر المناصب ولا العمولات الموجودة)</T>
                        <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                          {ACTIVITIES.map((a) => <Chip key={a.key} label={a.label} selected={ed.activity === a.key} onPress={() => setEd((s) => ({ ...s, activity: a.key }))} />)}
                        </Row>
                        <Row style={{ gap: S.sm }}>
                          <View style={{ flex: 1 }}><Btn title="حفظ" onPress={() => saveEdit(b)} /></View>
                          <View style={{ flex: 1 }}><Btn title="إلغاء" variant="outline" onPress={() => setEditing(null)} /></View>
                        </Row>
                      </View>
                    ) : (
                      <Row style={{ gap: S.sm }}>
                        <View style={{ flex: 1 }}><Btn testID={`branch-edit-${b.id}`} title="تعديل الاسم والتصنيف" icon="create-outline" variant="outline" onPress={() => startEdit(b)} /></View>
                        <View style={{ flex: 1 }}><Btn testID={`branch-open-${b.id}`} title="فتح الفرع وتعديل بياناته" icon="enter-outline" variant="outline" onPress={() => open(b)} /></View>
                      </Row>
                    )}
                    {b.id !== "main" ? <SwitchRow label={b.active ? "الفرع مفعَّل" : "الفرع مؤرشف"} hint={b.active ? "تعطيله يمنع دخول فريقه ويُخفيه من المقارنة، وتبقى بياناته محفوظة" : "فعّله ليعود فريقه إلى الدخول ويظهر في المقارنة"} value={b.active} onChange={() => toggle(b)} /> : null}
                  </Card>
                ))}
              </View>
            );
          })}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}
