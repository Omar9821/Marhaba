import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { F } from "@/src/ui";

export const unstable_settings = { initialRouteName: "index" };

// Declared right-to-left visually: the first trigger sits on the left, so home is declared last.
export default function AdminTabs() {
  const { colors } = useTheme();
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>الإعدادات</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reports">
          <NativeTabs.Trigger.Icon sf="doc.text.fill" />
          <NativeTabs.Trigger.Label>التقارير</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="entry">
          <NativeTabs.Trigger.Icon sf="square.and.pencil" />
          <NativeTabs.Trigger.Label>الإدخال</NativeTabs.Trigger.Label>
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
      <Tabs.Screen name="reports" options={{ title: "التقارير", tabBarIcon: icon("document-text-outline"), tabBarButtonTestID: "tab-reports" } as any} />
      <Tabs.Screen name="entry" options={{ title: "الإدخال", tabBarIcon: icon("create-outline"), tabBarButtonTestID: "tab-entry" } as any} />
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: icon("home-outline"), tabBarButtonTestID: "tab-home" } as any} />
    </Tabs>
  );
}
