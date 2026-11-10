import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mutate } from "@/src/api";
import { currentMonth } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { ViolationLog, ViolationRow } from "@/src/types";
import { Card, EmptyState, ErrorView, Header, Icon, LineItem, Loading, MonthSwitcher, Pill, R, Row, S, StatTile, SyncBadge, T, useToast } from "@/src/ui";

export default function ViolationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState<string | null>(null);
  const q = useApi<ViolationLog>(`/violations-log?month=${month}`);
  const log = q.data;

  const save = async (row: ViolationRow, patch: Partial<Pick<ViolationRow, "counts" | "note" | "follow_date">>) => {
    try {
      const r = await mutate("PUT", "/violations-log/entry", { month, employee_id: row.employee_id, counts: row.counts, note: row.note, follow_date: row.follow_date, ...patch });
      if (r.queued) toast("حُفظ محلياً، ستتم المزامنة عند توفر الاتصال", "info");
      await q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    }
  };
  const step = (row: ViolationRow, code: string, d: number) => {
    const next = Math.max(0, (row.counts[code] ?? 0) + d);
    save(row, { counts: { ...row.counts, [code]: next } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="سجل التفتيش والمخالفات" subtitle="عدد المخالفات لكل موظف حسب النوع" right={<SyncBadge />} />
      {q.loading ? (
        <Loading />
      ) : q.error && !log ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : log ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <MonthSwitcher month={month} onChange={setMonth} />
          <Row style={{ gap: S.sm }}>
            <StatTile testID="vio-total" icon="warning-outline" label="إجمالي المخالفات" value={String(log.total)} />
            <StatTile testID="vio-employees" icon="people-outline" label="موظفين لديهم مخالفات" value={String(log.employees_with)} />
            <StatTile testID="vio-alerts" icon="notifications-outline" label={`تنبيهات متوقعة (≥${log.alert_threshold})`} value={String(log.expected_alerts)} />
          </Row>
          {log.rows.length === 0 ? <EmptyState icon="people-outline" title="لا يوجد موظفون نشطون" subtitle="أضف موظفين من الإعدادات" /> : null}
          {log.rows.map((r, i) => {
            const expanded = open === r.employee_id;
            const alert = r.total >= log.alert_threshold;
            return (
              <Card key={r.employee_id} style={{ gap: S.sm }} testID={`vio-row-${i}`}>
                <Pressable onPress={() => setOpen(expanded ? null : r.employee_id)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: S.sm, minHeight: 44 }}>
                  <View style={{ flex: 1 }}>
                    <T variant="h3" numberOfLines={1}>{r.name}</T>
                    <T variant="caption" numberOfLines={1}>
                      {log.types.filter((t) => (r.counts[t.code] ?? 0) > 0).map((t) => `${t.label} ${r.counts[t.code]}`).join(" · ") || "لا مخالفات"}
                    </T>
                  </View>
                  {alert ? <Pill label="تنبيه" tone="error" /> : null}
                  <Pill testID={`vio-total-${i}`} label={`المجموع ${r.total}`} tone={r.total === 0 ? "success" : alert ? "error" : "warning"} />
                  <Icon name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                </Pressable>
                {expanded ? (
                  <View style={{ gap: S.xs }}>
                    {log.types.map((t) => (
                      <Row key={t.code} style={{ justifyContent: "space-between", gap: S.sm, minHeight: 44 }}>
                        <T style={{ flex: 1 }}>{t.label}</T>
                        <Row style={{ gap: S.sm }}>
                          <Pressable testID={`vio-minus-${i}-${t.code}`} onPress={() => step(r, t.code, -1)} style={stepBtn(colors)}>
                            <Icon name="remove" size={20} color={colors.onSurface} />
                          </Pressable>
                          <T testID={`vio-count-${i}-${t.code}`} variant="h3" style={{ minWidth: 28, textAlign: "center" }}>{r.counts[t.code] ?? 0}</T>
                          <Pressable testID={`vio-plus-${i}-${t.code}`} onPress={() => step(r, t.code, 1)} style={[stepBtn(colors), { backgroundColor: colors.brand }]}>
                            <Icon name="add" size={20} color={colors.onBrand} />
                          </Pressable>
                        </Row>
                      </Row>
                    ))}
                    <NoteField label="ملاحظات" value={r.note} onCommit={(v) => save(r, { note: v })} />
                    <NoteField label="تاريخ المتابعة (YYYY-MM-DD)" value={r.follow_date} onCommit={(v) => save(r, { follow_date: v })} />
                  </View>
                ) : null}
              </Card>
            );
          })}
          <Card style={{ gap: 0 }} testID="vio-summary">
            <T variant="h2" style={{ paddingBottom: S.sm }}>الملخص الشهري — أكثر المخالفات تكرارًا</T>
            {log.by_type.map((t) => <LineItem key={t.code} label={t.label} value={String(t.count)} tone={t.count ? "error" : "muted"} />)}
            <LineItem label="المجموع" value={String(log.total)} strong />
          </Card>
        </ScrollView>
      ) : null}
    </View>
  );
}

const stepBtn = (colors: any) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.surfaceSecondary });

function NoteField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  return (
    <View style={{ gap: S.xs }}>
      <T variant="caption">{label}</T>
      <TextInput value={text} onChangeText={setText} onBlur={() => text !== value && onCommit(text)} placeholderTextColor={colors.muted}
        style={{ minHeight: 44, borderRadius: R.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: S.md, fontFamily: "Tajawal", fontSize: 15, color: colors.onSurface, textAlign: "right" }} />
    </View>
  );
}
