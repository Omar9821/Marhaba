import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { F } from "@/src/ui";

export const unstable_settings = { initialRouteName: "me" };

export default function EmployeeTabs() {
  const { colors } = useTheme();
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="account">
          <NativeTabs.Trigger.Icon sf="person.crop.circle" />
          <NativeTabs.Trigger.Label>حسابي</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="notices">
          <NativeTabs.Trigger.Icon sf="megaphone.fill" />
          <NativeTabs.Trigger.Label>الإعلانات</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="infractions">
          <NativeTabs.Trigger.Icon sf="exclamationmark.triangle.fill" />
          <NativeTabs.Trigger.Label>المخالفات</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="me">
          <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
          <NativeTabs.Trigger.Label>أدائي</NativeTabs.Trigger.Label>
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
      <Tabs.Screen name="account" options={{ title: "حسابي", tabBarIcon: icon("person-circle-outline"), tabBarButtonTestID: "tab-account" } as any} />
      <Tabs.Screen name="notices" options={{ title: "الإعلانات", tabBarIcon: icon("megaphone-outline"), tabBarButtonTestID: "tab-announcements" } as any} />
      <Tabs.Screen name="infractions" options={{ title: "المخالفات", tabBarIcon: icon("warning-outline"), tabBarButtonTestID: "tab-infractions" } as any} />
      <Tabs.Screen name="me" options={{ title: "أدائي", tabBarIcon: icon("bar-chart-outline"), tabBarButtonTestID: "tab-performance" } as any} />
    </Tabs>
  );
}
