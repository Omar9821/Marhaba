import { Image } from "expo-image";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Btn, Card, ConfirmSheet, Header, Icon, Row, S, T } from "@/src/ui";

export default function Account() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirm, setConfirm] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="حسابي" />
      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}>
        <Card style={{ alignItems: "center", gap: S.sm }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {user?.picture ? <Image source={{ uri: user.picture }} style={{ width: 72, height: 72 }} /> : <T variant="h1" color="brand">{user?.name?.charAt(0)}</T>}
          </View>
          <T testID="account-name" variant="h2" style={{ textAlign: "center" }}>{user?.name}</T>
          <T variant="caption" style={{ textAlign: "center" }}>{user?.email}</T>
        </Card>
        <Card style={{ gap: S.md }}>
          <Row style={{ gap: S.md }}>
            <Icon name="shield-checkmark-outline" size={24} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <T variant="h3">خصوصية بياناتك</T>
              <T variant="caption">بيانات راتبك مشفرة، ولا يمكن لأي موظف آخر الاطلاع على أدائك أو منحتك.</T>
            </View>
          </Row>
          <Row style={{ gap: S.md }}>
            <Icon name="cloud-offline-outline" size={24} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <T variant="h3">يعمل بدون إنترنت</T>
              <T variant="caption">آخر بيانات تم تحميلها تبقى متاحة حتى بدون اتصال.</T>
            </View>
          </Row>
        </Card>
        <Btn testID="logout-button" title="تسجيل الخروج" variant="outline" icon="log-out-outline" onPress={() => setConfirm(true)} />
      </ScrollView>
      <ConfirmSheet visible={confirm} title="تسجيل الخروج" message="هل تريد تسجيل الخروج؟" confirmLabel="تسجيل الخروج" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); logout(); }} />
    </View>
  );
}
