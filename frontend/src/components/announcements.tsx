import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, mutate } from "@/src/api";
import { dayLabel } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Announcement, Employee } from "@/src/types";
import { Btn, Card, Chip, EmptyState, ErrorView, Header, Icon, Loading, Pill, R, Row, S, SyncBadge, T, useToast } from "@/src/ui";

const AUD: Record<Announcement["audience"], string> = { all: "الجميع", employees: "كل الموظفين", inspectors: "المراقبون", selected: "موظفون محدّدون" };

/** شاشة الإعلانات: قائمة + (للمسيّر/المراقب المخوَّل) نموذج إرسال إعلان للجميع أو لبعض الموظفين. */
export function AnnouncementsView({ canSend, canDelete }: { canSend: boolean; canDelete: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const q = useApi<Announcement[]>("/announcements");
  const emps = useApi<Employee[]>(canSend ? "/employees?include_inactive=false" : null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [aud, setAud] = useState<Announcement["audience"]>("all");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!title.trim()) return toast("اكتب عنوان الإعلان", "error");
    if (aud === "selected" && !sel.length) return toast("اختر موظفًا واحدًا على الأقل", "error");
    setBusy(true);
    try {
      await api.post("/announcements", { title, body, audience: aud, employee_ids: sel });
      toast("تم إرسال الإعلان");
      setTitle(""); setBody(""); setSel([]); setAud("all"); setComposing(false);
      await q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الإرسال", "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await api.del(`/announcements/${id}`);
      await q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الحذف", "error");
    }
  };
  const markRead = async (a: Announcement) => {
    if (a.read) return;
    await mutate("POST", `/announcements/${a.id}/read`, {}).catch(() => {});
    q.setData((q.data ?? []).map((x) => (x.id === a.id ? { ...x, read: true } : x)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="الإعلانات" subtitle={canSend ? "أرسل إعلانًا للموظفين أو لبعضهم" : "إعلانات الإدارة"} right={<SyncBadge />} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
        {canSend ? (
          composing ? (
            <Card style={{ gap: S.md }} testID="announce-form">
              <T variant="h3">إعلان جديد</T>
              <Box value={title} onChange={setTitle} placeholder="العنوان" testID="announce-title" />
              <Box value={body} onChange={setBody} placeholder="نص الإعلان" multiline testID="announce-body" />
              <T variant="label">المستلمون</T>
              <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                {(Object.keys(AUD) as Announcement["audience"][]).map((k) => (
                  <Chip key={k} testID={`announce-aud-${k}`} label={AUD[k]} selected={aud === k} onPress={() => setAud(k)} />
                ))}
              </Row>
              {aud === "selected" ? (
                <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                  {(emps.data ?? []).map((e) => (
                    <Chip key={e.id} label={e.full_name} selected={sel.includes(e.id)} onPress={() => setSel((s) => (s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id]))} />
                  ))}
                </Row>
              ) : null}
              <Row style={{ gap: S.sm }}>
                <View style={{ flex: 1 }}><Btn testID="announce-send" title="إرسال" icon="send-outline" onPress={send} loading={busy} /></View>
                <View style={{ flex: 1 }}><Btn title="إلغاء" variant="outline" onPress={() => setComposing(false)} /></View>
              </Row>
            </Card>
          ) : (
            <Btn testID="announce-new" title="إعلان جديد" icon="megaphone-outline" onPress={() => setComposing(true)} />
          )
        ) : null}
        {q.loading ? <Loading /> : q.error && !q.data ? <ErrorView message={q.error} onRetry={q.refresh} /> : null}
        {q.data && q.data.length === 0 ? <EmptyState icon="megaphone-outline" title="لا توجد إعلانات" /> : null}
        {(q.data ?? []).map((a) => (
          <Pressable key={a.id} onPress={() => markRead(a)} testID={`announcement-${a.id}`}>
            <Card style={{ gap: S.sm, borderColor: a.read ? colors.border : colors.brandSecondary, borderWidth: 1 }}>
              <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                <T variant="h3" style={{ flex: 1 }}>{a.title}</T>
                {!a.read && !canDelete ? <Pill label="جديد" tone="brand" /> : null}
              </Row>
              {a.body ? <T>{a.body}</T> : null}
              <Row style={{ justifyContent: "space-between", gap: S.sm, flexWrap: "wrap" }}>
                <T variant="caption">{a.created_by} · {dayLabel(a.created_at.slice(0, 10))}</T>
                <Row style={{ gap: S.sm }}>
                  <Pill label={AUD[a.audience]} tone="muted" />
                  {a.read_count !== undefined ? <Pill label={`قرأه ${a.read_count}`} tone="success" /> : null}
                </Row>
              </Row>
              {canDelete ? (
                <Pressable testID={`announce-del-${a.id}`} onPress={() => remove(a.id)} style={{ alignSelf: "flex-start", flexDirection: "row-reverse", gap: S.xs, alignItems: "center", minHeight: 40 }}>
                  <Icon name="trash-outline" size={18} color={colors.error} />
                  <T variant="caption" color="error">حذف الإعلان</T>
                </Pressable>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Box({ value, onChange, placeholder, multiline, testID }: { value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <TextInput testID={testID} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} multiline={multiline}
      style={{ minHeight: multiline ? 96 : 48, borderRadius: R.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: S.md, paddingVertical: S.sm,
        fontFamily: "Tajawal", fontSize: 16, color: colors.onSurface, textAlign: "right", textAlignVertical: multiline ? "top" : "center" }} />
  );
}
