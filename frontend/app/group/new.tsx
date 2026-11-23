import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { api } from "@/src/api";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Contact } from "@/src/types";
import { Btn, Card, Chip, Field, Header, Loading, Row, S, T, useToast } from "@/src/ui";

export default function NewGroup() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const contacts = useApi<Contact[]>("/chat/contacts");
  const [name, setName] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const create = async () => {
    if (!name.trim()) return toast("اكتب اسم المجموعة", "error");
    if (!sel.length) return toast("اختر عضوًا واحدًا على الأقل", "error");
    setBusy(true);
    try { const r = await api.post("/groups", { name: name.trim(), member_ids: sel }); router.replace(`/group/${r.id}` as any); }
    catch (e: any) { toast(e?.message || "تعذر الإنشاء", "error"); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="مجموعة جديدة" subtitle="اختر الأعضاء ثم اسم المجموعة" />
      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg }} keyboardShouldPersistTaps="handled">
        <Field testID="group-name" label="اسم المجموعة" value={name} onChangeText={setName} />
        <Card style={{ gap: S.sm }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T variant="h3">الأعضاء ({sel.length})</T>
            <Chip label="الكل" onPress={() => setSel((contacts.data ?? []).map((c) => c.user_id))} />
          </Row>
          {contacts.loading ? <Loading /> : null}
          <Row style={{ flexWrap: "wrap", gap: S.sm }}>
            {(contacts.data ?? []).map((c) => (
              <Chip key={c.user_id} label={`${c.name} · ${c.position_name || c.role_label}`} selected={sel.includes(c.user_id)} onPress={() => toggle(c.user_id)} />
            ))}
          </Row>
        </Card>
        <Btn testID="group-create" title="إنشاء المجموعة" onPress={create} loading={busy} />
      </ScrollView>
    </View>
  );
}
