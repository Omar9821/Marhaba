import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { F } from "@/src/ui";

export const unstable_settings = { initialRouteName: "sheet" };

// Declared right-to-left visually: the first trigger sits on the left, so home is declared last.
export default function AdminTabs() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>الإعدادات</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reports" hidden>
          <NativeTabs.Trigger.Icon sf="doc.text.fill" />
          <NativeTabs.Trigger.Label>التقارير</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="entry" hidden>
          <NativeTabs.Trigger.Icon sf="square.and.pencil" />
          <NativeTabs.Trigger.Label>الإدخال</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="violations">
          <NativeTabs.Trigger.Icon sf="exclamationmark.triangle.fill" />
          <NativeTabs.Trigger.Label>المخالفات</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="sheet">
          <NativeTabs.Trigger.Icon sf="tablecells.fill" />
          <NativeTabs.Trigger.Label>الأداء</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>الرئيسية</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  const icon = (name: React.ComponentProps<typeof Ionicons>["name"]) =>
    function TabIcon({ color, size }: { color: string; size: number }) {
      return <Ionicons name={name} color={color} size={size} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: icon("settings-outline"), tabBarButtonTestID: "tab-settings" } as any} />
      <Tabs.Screen name="reports" options={{ href: null, title: "التقارير" } as any} />
      <Tabs.Screen name="entry" options={{ href: null, title: "الإدخال" } as any} />
      <Tabs.Screen name="violations" options={{ title: "المخالفات", tabBarIcon: icon("warning-outline"), tabBarButtonTestID: "tab-violations" } as any} />
      <Tabs.Screen name="sheet" options={{ title: "الأداء", tabBarIcon: icon("grid-outline"), tabBarButtonTestID: "tab-sheet" } as any} />
      <Tabs.Screen name="index" options={{ href: isAdmin ? undefined : null, title: "الرئيسية", tabBarIcon: icon("home-outline"), tabBarButtonTestID: "tab-home" } as any} />
    </Tabs>
  );
}
