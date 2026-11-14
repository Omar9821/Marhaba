import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";

import { api } from "@/src/api";
import { dayLabel } from "@/src/format";
import { useTheme } from "@/src/theme";
import { ChatMsg, Contact } from "@/src/types";
import { EmptyState, ErrorView, Header, Icon, Loading, R, Row, S, T, useToast } from "@/src/ui";

export default function ChatScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const [other, setOther] = useState<Contact | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scroller = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/chat/with/${uid}`);
      setOther(r.other); setMsgs(r.messages); setErr(null);
    } catch (e: any) { setErr(e?.message || "تعذر التحميل"); } finally { setLoading(false); }
  }, [uid]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60); }, [msgs.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try { await api.post("/chat/send", { to_user_id: uid, text: t }); setText(""); await load(); } catch (e: any) { toast(e?.message || "تعذر الإرسال", "error"); } finally { setSending(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header back title={other?.name ?? "محادثة"} subtitle={other ? `${other.role_label}${other.position_name ? ` · ${other.position_name}` : ""}` : undefined} />
      <ScrollView ref={scroller} contentContainerStyle={{ padding: S.lg, gap: S.sm, paddingBottom: S.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {loading ? <Loading /> : err && !other ? <ErrorView message={err} onRetry={load} /> : null}
        {!loading && !err && msgs.length === 0 ? <EmptyState icon="chatbubbles-outline" title="ابدأ المحادثة" subtitle="اكتب رسالتك أدناه" /> : null}
        {msgs.map((m, i) => {
          const newDay = i === 0 || m.at.slice(0, 10) !== msgs[i - 1].at.slice(0, 10);
          return (
            <View key={m.id}>
              {newDay ? <T variant="caption" style={{ textAlign: "center", marginVertical: S.xs }}>{dayLabel(m.at.slice(0, 10))}</T> : null}
              <View testID={`msg-${m.id}`} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "82%", backgroundColor: m.mine ? colors.brandPrimary : colors.surface, borderRadius: R.lg, paddingHorizontal: S.md, paddingVertical: S.sm, borderWidth: m.mine ? 0 : 1, borderColor: colors.border }}>
                <T style={{ color: m.mine ? colors.onBrandPrimary : colors.onSurface }}>{m.text}</T>
                <T variant="caption" style={{ color: m.mine ? colors.onBrandPrimary : colors.muted, opacity: 0.8 }}>{new Date(m.at).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}</T>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Row style={{ gap: S.sm, padding: S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: "flex-end" }}>
        <TextInput testID="chat-input" value={text} onChangeText={setText} placeholder="اكتب رسالة…" placeholderTextColor={colors.muted} multiline
          style={{ flex: 1, minHeight: 46, maxHeight: 120, borderRadius: R.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: S.md, paddingVertical: S.sm, fontFamily: "Tajawal", fontSize: 16, color: colors.onSurface, textAlign: "right" }} />
        <Pressable testID="chat-send" onPress={send} disabled={sending} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", opacity: sending ? 0.6 : 1 }}>
          <Icon name="send" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </Row>
    </KeyboardAvoidingView>
  );
}
