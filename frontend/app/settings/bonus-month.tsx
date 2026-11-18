import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { parseNum } from "@/src/components/sheet-ui";
import { currentMonth, money, monthLabel, shiftMonth } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Btn, Card, Chip, ChipRow, Field, Header, Loading, S, T, useToast } from "@/src/ui";

const ROLES: [string, string][] = [["commercial", "عون تجاري"], ["workshop_head", "مسؤول الورشة"], ["cutting_head", "مسؤول التقطيع"], ["cutter", "عون تقطيع"], ["team", "فريق / محصّل"]];
const ROLE_LABEL = Object.fromEntries(ROLES);
const INPUTS: [string, string][] = [
  ["turnover", "رقم الأعمال المحصَّل (دج) — اتركه فارغًا لأخذه من جدول الأداء"],
  ["m2_cut", "الأمتار المربعة المقطوعة (م²)"],
  ["glass_consumed", "قيمة الزجاج المستهلك بسعر الشراء (دج) = المبيع + الكسر"],
  ["breakage", "قيمة الكسر والخسائر بسعر الشراء (دج)"],
  ["offcut_revenue", "عائد بيع البقايا أو السلع المصنوعة منها (دج)"],
];

export default function BonusMonthScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const res = useApi<any>(`/bonus/month?month=${month}`);
  const emps = useApi<any[]>("/employees");
  const [f, setF] = useState<Record<string, string>>({});
  const [col, setCol] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const i = res.data?.inputs;
    if (!i) return;
    const m: Record<string, string> = {};
    INPUTS.forEach(([k]) => { m[k] = i[k] ? String(i[k]) : ""; });
    setF(m);
    setCol(Object.fromEntries(Object.entries(i.collected || {}).map(([k, v]) => [k, String(v)])));
  }, [res.data]);
  useEffect(() => { if (emps.data) setRoles(Object.fromEntries(emps.data.map((e) => [e.id, e.bonus_role || ""]))); }, [emps.data]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/bonus/roles", { roles });
      const body: any = { month, collected: {} };
      INPUTS.forEach(([k]) => { const v = parseNum(f[k] ?? ""); body[k] = v === null ? (k === "turnover" ? null : 0) : v; });
      Object.entries(col).forEach(([id, v]) => { const n = parseNum(v); if (n) body.collected[id] = n; });
      await api.put("/bonus/inputs", body);
      toast("تم الحفظ وإعادة الحساب");
      res.reload?.();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally { setSaving(false); }
  };

  const r = res.data;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="منح الأداء الشهرية" subtitle="النظام المعتمد: عتبات، شرائح، أثر الهدر" />
      {res.loading ? <Loading /> : (
        <>
          <KeyboardAwareScrollView bottomOffset={90} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: S.xl }}>
            <ChipRow>
              <Chip label="◀" onPress={() => setMonth(shiftMonth(month, -1))} />
              <Chip label={monthLabel(month)} selected />
              <Chip label="▶" onPress={() => setMonth(shiftMonth(month, 1))} />
            </ChipRow>
            <Card style={{ gap: S.md }}>
              <T variant="h3">أرقام الشهر</T>
              {INPUTS.map(([k, label]) => (
                <Field key={k} label={label} value={f[k] ?? ""} onChangeText={(v) => setF((s) => ({ ...s, [k]: v }))} keyboardType="decimal-pad" />
              ))}
            </Card>
            <Card style={{ gap: S.md }}>
              <T variant="h3">الأدوار (ومحصَّل كل عون تجاري كاملًا)</T>
              {(emps.data || []).filter((e) => e.status === "active").map((e) => (
                <View key={e.id} style={{ gap: S.xs }}>
                  <T variant="label">{e.full_name}</T>
                  <ChipRow>
                    {ROLES.map(([k, l]) => (
                      <Chip key={k} label={l} selected={roles[e.id] === k} onPress={() => setRoles((s) => ({ ...s, [e.id]: s[e.id] === k ? "" : k }))} />
                    ))}
                  </ChipRow>
                  {roles[e.id] === "commercial" && (
                    <Field label="المحصَّل كاملًا هذا الشهر (دج)" value={col[e.id] ?? ""} onChangeText={(v) => setCol((s) => ({ ...s, [e.id]: v }))} keyboardType="decimal-pad" />
                  )}
                </View>
              ))}
            </Card>
            {r && (
              <Card style={{ gap: S.sm }}>
                <T variant="h3">النتيجة</T>
                <T>نسبة الهدر: {(r.waste_ratio * 100).toFixed(2)}% — معامل المنحة: {(r.waste_factor * 100).toFixed(0)}%</T>
                <T>{r.reward_paid ? `مكافأة الهدر المباع مُسلَّمة (حصة الشركة ${money(r.reward_company)})` : "مكافأة الهدر المباع غير مُسلَّمة"}</T>
                {r.rows.map((x: any) => (
                  <T key={x.id}>{x.name} — {ROLE_LABEL[x.role]}: {money(x.payable)} (من أصل {money(x.bonus_max)})</T>
                ))}
                <T variant="h3">المجموع: {money(r.total_payable)}</T>
                {r.unassigned?.length > 0 && <T color="muted">بلا دور (خارج النظام): {r.unassigned.join("، ")}</T>}
              </Card>
            )}
          </KeyboardAwareScrollView>
          <View style={{ padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Btn title="حفظ وحساب" onPress={save} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}
