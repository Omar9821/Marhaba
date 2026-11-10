import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { HERO_IMAGE } from "@/src/components/report-view";
import { useTheme } from "@/src/theme";
import { Btn, Field, Icon, R, Row, S, T } from "@/src/ui";

export default function Login() {
  const { loginEmail, loginGoogle } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
    setError(null);
    setBusy("email");
    try {
      await loginEmail(email.trim(), password);
    } catch (e: any) {
      setError(e?.message || "تعذر تسجيل الدخول");
    } finally {
      setBusy(null);
    }
  };
  const google = async () => {
    setError(null);
    setBusy("google");
    try {
      await loginGoogle();
    } catch (e: any) {
      setError(e?.message || "تعذر تسجيل الدخول عبر Google");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + S.xl }}>
        <View style={{ height: 300, backgroundColor: colors.brand }}>
          <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(26,32,29,0.1)", "rgba(26,32,29,0.88)"]} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, justifyContent: "flex-end", padding: S.xl, paddingTop: insets.top + S.xl, gap: S.xs }}>
            <View style={{ width: 56, height: 56, borderRadius: R.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" }}>
              <Icon name="trending-up" size={30} color={colors.brand} />
            </View>
            <T variant="h1" style={{ color: colors.onBrand, fontSize: 30, lineHeight: 46 }}>مسار الأداء</T>
            <T style={{ color: colors.onBrand, opacity: 0.85 }}>متابعة الأداء، المخالفات وحساب منحة المردودية بشفافية</T>
          </View>
        </View>
        <View style={{ padding: S.xl, gap: S.lg, marginTop: -S.lg, backgroundColor: colors.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg }}>
          <T variant="h2">تسجيل الدخول</T>
          <Field testID="login-email-input" label="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="name@company.dz" />
          <Field testID="login-password-input" label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" onSubmitEditing={submit} returnKeyType="go" />
          {error ? (
            <Row testID="login-error-message" style={{ gap: S.sm, backgroundColor: colors.errorSoft, padding: S.md, borderRadius: R.md }}>
              <Icon name="alert-circle" size={18} color={colors.error} />
              <T color="error" style={{ flex: 1 }}>{error}</T>
            </Row>
          ) : null}
          <Btn testID="login-submit-button" title="دخول" onPress={submit} loading={busy === "email"} />
          <Row style={{ gap: S.md }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
            <T variant="caption">أو</T>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
          </Row>
          <Btn testID="login-google-button" title="المتابعة باستخدام Google" variant="outline" icon="logo-google" onPress={google} loading={busy === "google"} />
          <Row style={{ gap: S.sm, justifyContent: "center" }}>
            <Icon name="lock-closed-outline" size={14} color={colors.muted} />
            <T variant="caption">بياناتك مشفرة ولا يطلع الموظف إلا على بياناته الشخصية</T>
          </Row>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
