import { useState } from "react";
import { ScrollView, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { pickFiles } from "@/src/files";
import { useTheme } from "@/src/theme";
import { Btn, Card, ConfirmSheet, Header, S, T, useToast } from "@/src/ui";

/** إعدادات المسؤول العام: استيراد الحسابات، معلومات الحساب، الخروج. */
export default function HubSettings() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const importTeam = async () => {
    try {
      const f = (await pickFiles())[0];
      if (!f) return;
      setImporting(true);
      const r = await api.post("/hub/import-team", { data: f.data });
      toast(`تم: ${r.admins_created + r.admins_updated} مسيّر، ${r.employees_created + r.employees_updated} موظف، ${r.supervisors} مراقب${r.errors?.length ? ` — أخطاء: ${r.errors.join("، ")}` : ""}`);
    } catch (e: any) { toast(e?.message || "تعذر الاستيراد", "error"); } finally { setImporting(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="الإعدادات" subtitle="حساب المسؤول العام وأدوات الإدارة" />
      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg }}>
        <Card style={{ gap: S.xs }}>
          <T variant="h3">حسابي</T>
          <T>{user?.name ?? "المسؤول العام"}</T>
          <T variant="caption">{user?.email}</T>
        </Card>
        <Card style={{ gap: S.sm }}>
          <T variant="h3">استيراد الفريق والحسابات</T>
          <T variant="caption">ارفع ملف Excel (أعمدة: الفرع، الاسم، المنصب، الدور، اسم المستخدم، كلمة المرور…) لإنشاء الفروع والموظفين والمسيّرين والمراقبين دفعة واحدة.</T>
          <Btn testID="hub-import" title="استيراد من Excel" variant="secondary" icon="cloud-upload-outline" onPress={importTeam} loading={importing} />
        </Card>
        <Btn testID="hub-logout" title="تسجيل الخروج" variant="ghost" icon="log-out-outline" onPress={() => setConfirm(true)} />
      </ScrollView>
      <ConfirmSheet visible={confirm} title="تسجيل الخروج" message="هل تريد تسجيل الخروج؟" confirmLabel="تسجيل الخروج" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); logout(); }} />
    </View>
  );
}
