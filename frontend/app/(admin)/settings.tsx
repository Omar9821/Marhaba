import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { setPrivacy, usePrivacy } from "@/src/privacy";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Btn, Card, ConfirmSheet, Header, S, SettingsRow, SwitchRow, T } from "@/src/ui";

export default function SettingsCenter() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, enterBranch } = useAuth();
  const hidden = usePrivacy();
  const [confirm, setConfirm] = useState(false);
  const go = (p: string) => router.push(p as any);

  const isAdmin = user?.role === "admin";
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title={isAdmin ? "مركز الإعدادات" : "حسابي"} subtitle={isAdmin ? (user?.branch?.name ? `الفرع: ${user.branch.name}` : "تخصيص قواعد العمل بدون تعديل الكود") : "المراقب"} />
      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}>
        {isAdmin ? (<>
        {user?.is_owner ? (
          <Card style={{ gap: S.sm }}>
            <T variant="caption">أنت تدير فرع «{user.branch?.name}» بصفتك المسؤول العام.</T>
            <Btn testID="back-to-hub" title="العودة إلى البوابة العامة" variant="outline" icon="business-outline" onPress={async () => { await enterBranch(null); router.replace("/hub" as any); }} />
          </Card>
        ) : null}
        <T variant="label" color="muted">البيانات الأساسية</T>
        <Card style={{ paddingVertical: S.xs }}>
          <SettingsRow testID="settings-employees-row" icon="people-outline" title="إدارة الموظفين" subtitle="إضافة، تعديل، أرشفة وحذف، نوع العمولة والوزن" onPress={() => go("/settings/employees")} />
          <SettingsRow testID="settings-positions-row" icon="briefcase-outline" title="المناصب" subtitle="إضافة المناصب وتعديلها، ونوع العمولة والوزن الافتراضي" onPress={() => go("/settings/positions")} last />
        </Card>
        <T variant="label" color="muted">قواعد الحساب</T>
        <Card style={{ paddingVertical: S.xs }}>
          <SettingsRow testID="settings-commission-row" icon="cash-outline" title="أنواع العمولة" subtitle="تجاري، مالية، متر مربع، عامل… أو أي نوع جديد" onPress={() => go("/settings/commission-types")} />
          <SettingsRow testID="settings-violation-types-row" icon="warning-outline" title="أنواع المخالفات" subtitle="أضف مخالفة وحدّد أثرها على المنحة" onPress={() => go("/settings/violation-types")} />
          <SettingsRow testID="settings-sheet-params-row" icon="options-outline" title="معاملات جدول الأداء" subtitle="الأوزان، الحدود، المجمَّع، الصندوق الترفيهي" onPress={() => go("/settings/sheet-params")} last />
        </Card>
        <T variant="label" color="muted">الصلاحيات والخصوصية</T>
        <Card style={{ paddingVertical: S.xs, gap: S.xs }}>
          <SettingsRow testID="settings-permissions-row" icon="lock-closed-outline" title="صلاحيات المراقب والعامل" subtitle="حدّد ما يراه كل منهم، وأخفِ رقم الأعمال" onPress={() => go("/settings/permissions")} last />
        </Card>
        <Card>
          <SwitchRow testID="privacy-switch" label="إخفاء رقم أعمال الشركة على هذا الجهاز" hint="يستبدل الأرقام الحساسة بنقاط، ويمكن إظهارها بضغطة" value={hidden} onChange={setPrivacy} />
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
