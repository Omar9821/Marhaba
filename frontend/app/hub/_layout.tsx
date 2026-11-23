import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { F } from "@/src/ui";

export const unstable_settings = { initialRouteName: "index" };

/** البوابة العامة: الرئيسية · الفروع · المراسلة · الإعدادات. */
export default function HubTabs() {
  const { colors } = useTheme();
  const chats = useApi<{ unread: number }[]>("/hub/chat/groups");
  const unread = (chats.data ?? []).reduce((a, g) => a + g.unread, 0);
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="settings"><NativeTabs.Trigger.Icon sf="gearshape.fill" /><NativeTabs.Trigger.Label>الإعدادات</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="chat"><NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" /><NativeTabs.Trigger.Label>المراسلة</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="branches"><NativeTabs.Trigger.Icon sf="building.2.fill" /><NativeTabs.Trigger.Label>الفروع</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf="house.fill" /><NativeTabs.Trigger.Label>الرئيسية</NativeTabs.Trigger.Label></NativeTabs.Trigger>
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
      <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: icon("settings-outline"), tabBarButtonTestID: "hubtab-settings" } as any} />
      <Tabs.Screen name="chat" options={{ title: "المراسلة", tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: icon("chatbubbles-outline"), tabBarButtonTestID: "hubtab-chat" } as any} />
      <Tabs.Screen name="branches" options={{ title: "الفروع", tabBarIcon: icon("business-outline"), tabBarButtonTestID: "hubtab-branches" } as any} />
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: icon("home-outline"), tabBarButtonTestID: "hubtab-home" } as any} />
    </Tabs>
  );
}
