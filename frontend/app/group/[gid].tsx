import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";

import { api } from "@/src/api";
import { dayLabel } from "@/src/format";
import { PickedFile, pickFiles, saveFile } from "@/src/files";
import { useTheme } from "@/src/theme";
import { EmptyState, ErrorView, Header, Icon, Loading, R, Row, S, T, useToast } from "@/src/ui";

type FileMeta = { id: string; name: string; type: string; size: number };
type Msg = { id: string; mine: boolean; from_name: string; text: string; files: FileMeta[]; at: string };
type Group = { id: string; name: string; can_manage: boolean; members: { user_id: string; name: string; role_label: string; owner: boolean }[]; messages: Msg[] };

function FileChip({ base, gid, f, mine }: { base: string; gid: string; f: FileMeta; mine: boolean }) {
  const { colors } = useTheme();
  const [src, setSrc] = useState<string | null>(null);
  const isImg = f.type.startsWith("image/");
  useEffect(() => { if (isImg) api.get(`${base}/${gid}/files/${f.id}`).then((r) => setSrc(`data:${r.type};base64,${r.data}`)).catch(() => {}); }, [base, gid, f.id, isImg]);
  const open = async () => { const r = await api.get(`${base}/${gid}/files/${f.id}`); saveFile(r.name, r.type, r.data); };
  if (isImg && src) return <Pressable onPress={open}><Image source={{ uri: src }} style={{ width: 200, height: 150, borderRadius: R.md }} resizeMode="cover" /></Pressable>;
  return (
    <Pressable onPress={open} style={{ flexDirection: "row", alignItems: "center", gap: S.xs }}>
      <Icon name="document-attach-outline" size={18} color={mine ? colors.onBrandPrimary : colors.brandPrimary} />
      <T style={{ color: mine ? colors.onBrandPrimary : colors.onSurface, textDecorationLine: "underline" }} numberOfLines={1}>{f.name} ({Math.max(1, Math.round(f.size / 1024))} ك.ب)</T>
    </Pressable>
  );
}

export default function GroupScreen() {
  const { gid, hub } = useLocalSearchParams<{ gid: string; hub?: string }>();
  const base = hub ? "/hub/chat/groups" : "/groups";
  const { colors } = useTheme();
  const toast = useToast();
  const [g, setG] = useState<Group | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const scroller = useRef<any>(null);

  const load = useCallback(async () => {
    try { setG(await api.get(`${base}/${gid}`)); setErr(null); } catch (e: any) { setErr(e?.message || "تعذر التحميل"); } finally { setLoading(false); }
  }, [gid, base]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60); }, [g?.messages.length]);

  const attach = async () => { try { const add = await pickFiles(); setFiles((f) => [...f, ...add].slice(0, 5)); } catch (e: any) { toast(e?.message || "تعذر اختيار الملف", "error"); } };
  const send = async () => {
    const t = text.trim();
    if ((!t && !files.length) || sending) return;
    setSending(true);
    try { await api.post(`${base}/${gid}/messages`, { text: t, files: files.map(({ name, type, data }) => ({ name, type, data })) }); setText(""); setFiles([]); await load(); }
    catch (e: any) { toast(e?.message || "تعذر الإرسال", "error"); } finally { setSending(false); }
  };

  const msgs = g?.messages ?? [];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header back title={g?.name ?? "مجموعة"} subtitle={g ? `${g.members.length} أعضاء` : undefined}
        right={<Pressable testID="group-members" onPress={() => setShowMembers((s) => !s)}><Icon name="people-outline" size={24} color={colors.brandPrimary} /></Pressable>} />
      {showMembers && g ? (
        <View style={{ padding: S.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
          {g.members.map((m) => <T key={m.user_id} variant="caption">{m.name} · {m.role_label}{m.owner ? " (المنشئ)" : ""}</T>)}
        </View>
      ) : null}
      <ScrollView ref={scroller} contentContainerStyle={{ padding: S.lg, gap: S.sm, paddingBottom: S.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {loading ? <Loading /> : err && !g ? <ErrorView message={err} onRetry={load} /> : null}
        {!loading && !err && msgs.length === 0 ? <EmptyState icon="chatbubbles-outline" title="ابدأ المحادثة" subtitle="اكتب رسالة أو أرفق صورة/ملفًا" /> : null}
        {msgs.map((m, i) => {
          const newDay = i === 0 || m.at.slice(0, 10) !== msgs[i - 1].at.slice(0, 10);
          return (
            <View key={m.id}>
              {newDay ? <T variant="caption" style={{ textAlign: "center", marginVertical: S.xs }}>{dayLabel(m.at.slice(0, 10))}</T> : null}
              <View style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "82%", gap: S.xs, backgroundColor: m.mine ? colors.brandPrimary : colors.surface, borderRadius: R.lg, paddingHorizontal: S.md, paddingVertical: S.sm, borderWidth: m.mine ? 0 : 1, borderColor: colors.border }}>
                {!m.mine ? <T variant="caption" style={{ fontWeight: "700" }}>{m.from_name}</T> : null}
                {m.text ? <T style={{ color: m.mine ? colors.onBrandPrimary : colors.onSurface }}>{m.text}</T> : null}
                {m.files.map((f) => <FileChip key={f.id} base={base} gid={gid as string} f={f} mine={m.mine} />)}
                <T variant="caption" style={{ color: m.mine ? colors.onBrandPrimary : colors.muted, opacity: 0.8 }}>{new Date(m.at).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}</T>
              </View>
            </View>
          );
        })}
      </ScrollView>
      {files.length ? (
        <Row style={{ gap: S.sm, paddingHorizontal: S.md, paddingTop: S.sm, flexWrap: "wrap", backgroundColor: colors.surface }}>
          {files.map((f, i) => (
            <Pressable key={i} onPress={() => setFiles((x) => x.filter((_, j) => j !== i))} style={{ flexDirection: "row", gap: S.xs, alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: R.md, paddingHorizontal: S.sm, paddingVertical: 4 }}>
              <T variant="caption" numberOfLines={1}>{f.name}</T><Icon name="close" size={14} color={colors.muted} />
            </Pressable>
          ))}
        </Row>
      ) : null}
      <Row style={{ gap: S.sm, padding: S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: "flex-end" }}>
        <Pressable testID="group-attach" onPress={attach} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
          <Icon name="attach" size={22} color={colors.brandPrimary} />
        </Pressable>
        <TextInput testID="group-input" value={text} onChangeText={setText} placeholder="اكتب رسالة…" placeholderTextColor={colors.muted} multiline
          style={{ flex: 1, minHeight: 46, maxHeight: 120, borderRadius: R.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: S.md, paddingVertical: S.sm, fontFamily: "Tajawal", fontSize: 16, color: colors.onSurface, textAlign: "right" }} />
        <Pressable testID="group-send" onPress={send} disabled={sending} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", opacity: sending ? 0.6 : 1 }}>
          <Icon name="send" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </Row>
    </KeyboardAvoidingView>
  );
}
