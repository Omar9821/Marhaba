import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dayLabel } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { ChatItem, Contact, RequestStatus, RequestSummary } from "@/src/types";
import { PushCard } from "@/src/components/push-card";
import { Btn, Card, Chip, EmptyState, ErrorView, Header, Icon, Loading, Pill, Row, S, Segmented, SyncBadge, T } from "@/src/ui";

export const STATUS_TONE: Record<RequestStatus, "brand" | "success" | "warning" | "error" | "muted"> = {
  new: "warning", answered: "brand", approved: "success", rejected: "error", issued: "success", closed: "muted", withdrawn: "muted",
};
export const KIND_ICON: Record<string, any> = {
  complaint: "alert-circle-outline", leave_exit: "exit-outline", absence_excuse: "document-text-outline",
  question: "help-circle-outline", written_inquiry: "mail-unread-outline",
};
type Filter = "all" | "open" | "done";
const OPEN: RequestStatus[] = ["new", "answered", "approved"];

/** صندوق الطلبات والمراسلة: يُستعمل للعامل (طلباته) وللمسيّر/المراقب (الواردة + الاستفسارات الكتابية). */
export function InboxView({ staff }: { staff: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [seg, setSeg] = useState<"requests" | "chat">("requests");
  const [filter, setFilter] = useState<Filter>("all");
  const reqs = useApi<RequestSummary[]>("/requests");
  const chats = useApi<ChatItem[]>("/chat");
  const [picking, setPicking] = useState(false);
  const contacts = useApi<Contact[]>(picking ? "/chat/contacts" : null);
  const unreadChat = (chats.data ?? []).reduce((a, c) => a + c.unread, 0);
  const unreadReq = (reqs.data ?? []).filter((r) => r.unread).length;
  const list = (reqs.data ?? []).filter((r) => (filter === "all" ? true : filter === "open" ? OPEN.includes(r.status) : !OPEN.includes(r.status)));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="الطلبات والمراسلة" subtitle={staff ? "طلبات العمال والاستفسارات الكتابية والرسائل" : "قدّم طلبك وتواصل مع مسؤول الورشة أو المسيّر"} right={<SyncBadge />} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}
        refreshControl={<RefreshControl refreshing={reqs.refreshing} onRefresh={() => { reqs.refresh(); chats.refresh(); }} tintColor={colors.brandPrimary} />}>
        <PushCard />
        <Segmented testID="inbox-seg" value={seg} onChange={setSeg}
          options={[{ key: "requests", label: `الطلبات${unreadReq ? ` (${unreadReq})` : ""}` }, { key: "chat", label: `المراسلة${unreadChat ? ` (${unreadChat})` : ""}` }]} />

        {seg === "requests" ? (
          <>
            <Row style={{ gap: S.sm }}>
              {!staff ? <View style={{ flex: 1 }}><Btn testID="request-new" title="طلب أو نموذج جديد" icon="add-circle-outline" onPress={() => router.push("/request/new" as any)} /></View> : null}
              {staff ? <View style={{ flex: 1 }}><Btn testID="inquiry-new" title="استفسار كتابي لعامل" icon="mail-unread-outline" onPress={() => router.push("/request/new?mode=inquiry" as any)} /></View> : null}
            </Row>
            <Row style={{ gap: S.sm, flexWrap: "wrap" }}>
              <Chip testID="req-filter-all" label="الكل" selected={filter === "all"} onPress={() => setFilter("all")} />
              <Chip testID="req-filter-open" label="قيد المعالجة" selected={filter === "open"} onPress={() => setFilter("open")} />
              <Chip testID="req-filter-done" label="المحسومة" selected={filter === "done"} onPress={() => setFilter("done")} />
            </Row>
            {reqs.loading ? <Loading /> : reqs.error && !reqs.data ? <ErrorView message={reqs.error} onRetry={reqs.refresh} /> : null}
            {reqs.data && list.length === 0 ? (
              <EmptyState icon="file-tray-outline" title="لا توجد طلبات" subtitle={staff ? "ستظهر هنا طلبات العمال الموجّهة إليك" : "شكوى، إذن خروج، تبرير غياب أو سؤال: ابدأ من الزر أعلاه"} />
            ) : null}
            {list.map((r) => (
              <Pressable key={r.id} testID={`request-${r.id}`} onPress={() => router.push(`/request/${r.id}` as any)}>
                <Card style={{ gap: S.sm, borderColor: r.unread ? colors.brandSecondary : colors.border, borderWidth: 1 }}>
                  <Row style={{ gap: S.sm, justifyContent: "space-between" }}>
                    <Row style={{ gap: S.sm, flex: 1 }}>
                      <Icon name={KIND_ICON[r.kind]} size={22} color={colors.brandPrimary} />
                      <T variant="h3" style={{ flex: 1 }} numberOfLines={1}>{r.subject}</T>
                    </Row>
                    {r.unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error }} /> : null}
                  </Row>
                  <Row style={{ gap: S.sm, flexWrap: "wrap" }}>
                    <Pill label={r.kind_label} tone="muted" />
                    <Pill label={r.status_label} tone={STATUS_TONE[r.status]} />
                    {r.overdue ? <Pill label="تجاوز المهلة" tone="error" /> : null}
                    {r.to === "supervisor" && r.kind !== "written_inquiry" ? <Pill label="إلى مسؤول الورشة" tone="muted" /> : null}
                  </Row>
                  {r.last_text ? <T variant="caption" numberOfLines={1}>{r.last_text}</T> : null}
                  <T variant="caption">{staff ? `${r.employee_name}${r.position_name ? ` · ${r.position_name}` : ""} · ` : ""}{r.ref} · {dayLabel(r.created_at.slice(0, 10))}</T>
                </Card>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Btn testID="chat-new" title={picking ? "إخفاء القائمة" : "رسالة جديدة"} icon="chatbubble-ellipses-outline" onPress={() => setPicking((p) => !p)} />
            {picking ? (
              <Card style={{ gap: S.sm }}>
                <T variant="label">اختر المستلم</T>
                {contacts.loading ? <Loading /> : null}
                <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                  {(contacts.data ?? []).map((c) => (
                    <Chip key={c.user_id} testID={`contact-${c.user_id}`} label={`${c.name} · ${c.position_name || c.role_label}`} onPress={() => { setPicking(false); router.push(`/chat/${c.user_id}` as any); }} />
                  ))}
                </Row>
              </Card>
            ) : null}
            {chats.loading ? <Loading /> : chats.error && !chats.data ? <ErrorView message={chats.error} onRetry={chats.refresh} /> : null}
            {chats.data && chats.data.length === 0 && !picking ? <EmptyState icon="chatbubbles-outline" title="لا توجد محادثات" subtitle="ابدأ محادثة لحلّ أي مشكلة في حينها" /> : null}
            {(chats.data ?? []).map((c) => (
              <Pressable key={c.id} testID={`chat-${c.user_id}`} onPress={() => router.push(`/chat/${c.user_id}` as any)}>
                <Card style={{ gap: S.xs, borderColor: c.unread ? colors.brandSecondary : colors.border, borderWidth: 1 }}>
                  <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                    <T variant="h3" style={{ flex: 1 }}>{c.name} <T variant="caption">· {c.role_label}</T></T>
                    {c.unread ? <Pill label={`${c.unread} جديدة`} tone="brand" /> : null}
                  </Row>
                  <T variant="caption" numberOfLines={1}>{c.mine ? "أنت: " : ""}{c.last_text}</T>
                  {c.last_at ? <T variant="caption">{dayLabel(c.last_at.slice(0, 10))}</T> : null}
                </Card>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
