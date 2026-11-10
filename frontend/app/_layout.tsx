import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { I18nManager, LogBox, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { flushOutbox } from "@/src/api";
import { AuthProvider, useAuth } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";
import { Loading, ToastProvider } from "@/src/ui";

LogBox.ignoreAllLogs(true);
// RTL is handled explicitly in styles (row-reverse / right aligned), so keep the native layout direction stable.
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch {}

const ADMIN_AREAS = ["(admin)", "settings", "employee"];

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    if (!user) {
      if (first !== "login") router.replace("/login");
      return;
    }
    const home = (user.role === "admin" ? "/" : "/me") as any;
    if (!first || first === "login" || (user.role === "employee" && ADMIN_AREAS.includes(first)) || (user.role === "admin" && first === "(employee)")) {
      router.replace(home);
    }
  }, [user, loading, segments, router]);

  useEffect(() => {
    if (!user) return;
    flushOutbox();
    const t = setInterval(flushOutbox, 20000);
    return () => clearInterval(t);
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]}>
          <Loading />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo: require("../assets/fonts/Cairo.ttf"),
    Tajawal: require("../assets/fonts/Tajawal-Regular.ttf"),
    "Tajawal-Medium": require("../assets/fonts/Tajawal-Medium.ttf"),
    "Tajawal-Bold": require("../assets/fonts/Tajawal-Bold.ttf"),
  });
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <KeyboardProvider>
              <ToastProvider>
                <AuthProvider>
                  <StatusBar style="dark" />
                  <Gate />
                </AuthProvider>
              </ToastProvider>
            </KeyboardProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
