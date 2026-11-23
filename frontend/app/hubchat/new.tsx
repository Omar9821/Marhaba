import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { api } from "@/src/api";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Btn, Card, Chip, Field, Header, Loading, Row, S, T, useToast } from "@/src/ui";

type C = { key: string; name: string; branch: string; role_label: string; position: string };

export default function HubChatNew() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const contacts = useApi<C[]>("/hub/chat/contacts");
  const [name, setName] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const byBranch = useMemo(() => {
    const m: Record<string, C[]> = {};
    (contacts.data ?? []).forEach((c) => { (m[c.branch] ||= []).push(c); });
    return m;
  }, [contacts.data]);
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const create = async () => {
    if (!sel.length) return toast("اختر شخصًا واحدًا على الأقل", "error");
    if (sel.length > 1 && !name.trim()) return toast("اكتب اسم المجموعة", "error");
    setBusy(true);
    try { const r = await api.post("/hub/chat/groups", { name: name.trim(), member_keys: sel }); router.replace(`/group/${r.id}?hub=1` as any); }
    catch (e: any) { toast(e?.message || "تعذر الإنشاء", "error"); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="محادثة جديدة" subtitle="شخص واحد = رسالة مباشرة، أكثر = مجموعة" />
      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg }} keyboardShouldPersistTaps="handled">
        {sel.length > 1 ? <Field label="اسم المجموعة" value={name} onChangeText={setName} /> : null}
        {contacts.loading ? <Loading /> : null}
        {Object.entries(byBranch).map(([branch, list]) => (
          <Card key={branch} style={{ gap: S.sm }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T variant="h3">{branch}</T>
              <Chip label="كل الفرع" onPress={() => setSel((s) => Array.from(new Set([...s, ...list.map((c) => c.key)])))} />
            </Row>
            <Row style={{ flexWrap: "wrap", gap: S.sm }}>
              {list.map((c) => <Chip key={c.key} label={`${c.name} · ${c.position || c.role_label}`} selected={sel.includes(c.key)} onPress={() => toggle(c.key)} />)}
            </Row>
          </Card>
        ))}
        <Btn testID="hubchat-create" title={sel.length > 1 ? `إنشاء مجموعة (${sel.length})` : "بدء المحادثة"} onPress={create} loading={busy} />
      </ScrollView>
    </View>
  );
}
