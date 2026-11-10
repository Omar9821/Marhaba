import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Btn, Card, ConfirmSheet, Header, S, SettingsRow, T } from "@/src/ui";

export default function SettingsCenter() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const go = (p: string) => router.push(p as any);

  const isAdmin = user?.role === "admin";
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title={isAdmin ? "مركز الإعدادات" : "حسابي"} subtitle={isAdmin ? "تخصيص قواعد العمل بدون تعديل الكود" : "المراقب"} />
      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}>
        {isAdmin ? (<>
        <T variant="label" color="muted">البيانات الأساسية</T>
        <Card style={{ paddingVertical: S.xs }}>
          <SettingsRow testID="settings-employees-row" icon="people-outline" title="إدارة الموظفين" subtitle="إضافة، تعديل، أرشفة وحذف" onPress={() => go("/settings/employees")} />
          <SettingsRow testID="settings-positions-row" icon="briefcase-outline" title="المناصب ومؤشرات الأداء" subtitle="المؤشرات، الأوزان والأهداف لكل منصب" onPress={() => go("/settings/positions")} last />
        </Card>
        <T variant="label" color="muted">قواعد الحساب</T>
        <Card style={{ paddingVertical: S.xs }}>
          <SettingsRow testID="settings-sheet-params-row" icon="options-outline" title="معاملات جدول الأداء" subtitle="الأوزان، الحدود، نسب العمولة والمجمَّع والصندوق" onPress={() => go("/settings/sheet-params")} />
          <SettingsRow testID="settings-infractions-row" icon="warning-outline" title="المخالفات والخصومات" subtitle="أنواع المخالفات وقيم الخصم" onPress={() => go("/settings/infractions")} />
          <SettingsRow testID="settings-rules-row" icon="calculator-outline" title="المعاملات وقواعد المنح" subtitle="قيمة النقطة، المعامل، السقف والصناديق" onPress={() => go("/settings/rules")} last />
        </Card>
        </>) : null}
        <T variant="label" color="muted">الحساب</T>
        <Card style={{ gap: S.md }}>
          <View>
            <T variant="h3">{user?.name}</T>
            <T variant="caption">{user?.email} • {isAdmin ? "مسير" : "مراقب"}</T>
          </View>
          <Btn testID="logout-button" title="تسجيل الخروج" variant="outline" icon="log-out-outline" onPress={() => setConfirm(true)} />
        </Card>
      </ScrollView>
      <ConfirmSheet visible={confirm} title="تسجيل الخروج" message="هل تريد تسجيل الخروج من التطبيق؟" confirmLabel="تسجيل الخروج" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); logout(); }} />
    </View>
  );
}
