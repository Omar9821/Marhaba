import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Btn, Card, Header, Loading, S, SwitchRow, T, useToast } from "@/src/ui";

type Resp = { perms: { inspector: Record<string, boolean>; employee: Record<string, boolean> }; schema: { role: "inspector" | "employee"; key: string; label: string }[] };

export default function PermissionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const q = useApi<Resp>("/permissions");
  const [p, setP] = useState<Resp["perms"] | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (q.data) setP(q.data.perms);
  }, [q.data]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/permissions", p);
      toast("تم حفظ الصلاحيات — تسري عند الدخول التالي لكل مستخدم");
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };
  const groups: { role: "inspector" | "employee"; title: string }[] = [
    { role: "inspector", title: "المراقب يستطيع…" },
    { role: "employee", title: "العامل / العون التجاري يستطيع…" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="الصلاحيات" subtitle="ما يراه المراقب والعامل" />
      {q.loading || !p || !q.data ? <Loading /> : (
        <>
          <KeyboardAwareScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            {groups.map((g) => (
              <Card key={g.role} style={{ gap: S.xs }}>
                <T variant="h3" style={{ paddingBottom: S.sm }}>{g.title}</T>
                {q.data!.schema.filter((s) => s.role === g.role).map((s) => (
                  <SwitchRow key={s.key} testID={`perm-${g.role}-${s.key}`} label={s.label} value={!!p[g.role][s.key]}
                    onChange={(v) => setP({ ...p, [g.role]: { ...p[g.role], [s.key]: v } })} />
                ))}
              </Card>
            ))}
            <T variant="caption">المسيّر يملك كل الصلاحيات دائمًا. مبالغ الدينار تتبع «رؤية مبالغ المنح»، وإخفاء «رقم الأعمال المحقق» عن العمال يكون بإيقاف خيار رؤية أساس العمولة.</T>
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn testID="perm-save" title="حفظ الصلاحيات" onPress={save} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}
