import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Btn, Card, EmptyState, ErrorView, Header, Loading, Pill, Row, S, T } from "@/src/ui";

type G = { id: string; name: string; members: number; last_text: string; unread: number; direct: boolean };

/** المراسلة العامة للمسؤول العام: محادثات ومجموعات عابرة للفروع. */
export default function HubChatList() {
  const { colors } = useTheme();
  const router = useRouter();
  const q = useApi<G[]>("/hub/chat/groups");
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="المراسلة العامة" subtitle="راسل أي عامل أو مسؤول في أي فرع" />
      {q.loading ? <Loading /> : q.error && !q.data ? <ErrorView message={q.error} onRetry={q.refresh} /> : (
        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.md }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <Btn testID="hubchat-new" title="رسالة / مجموعة جديدة" icon="create-outline" onPress={() => router.push("/hubchat/new" as any)} />
          {(q.data ?? []).length === 0 ? <EmptyState icon="chatbubbles-outline" title="لا توجد محادثات" subtitle="ابدأ برسالة إلى عامل أو أنشئ مجموعة" /> : null}
          {(q.data ?? []).map((g) => (
            <Pressable key={g.id} onPress={() => router.push(`/group/${g.id}?hub=1` as any)}>
              <Card style={{ gap: S.xs, borderWidth: 1, borderColor: g.unread ? colors.brandSecondary : colors.border }}>
                <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                  <T variant="h3" style={{ flex: 1 }}>{g.direct ? "💬" : "👥"} {g.name}{!g.direct ? <T variant="caption"> · {g.members} أعضاء</T> : null}</T>
                  {g.unread ? <Pill label={`${g.unread} جديدة`} tone="brand" /> : null}
                </Row>
                <T variant="caption" numberOfLines={1}>{g.last_text}</T>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
