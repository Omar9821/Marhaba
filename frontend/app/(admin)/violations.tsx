import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mutate } from "@/src/api";
import { useAuth } from "@/src/auth";
import { parseNum } from "@/src/components/sheet-ui";
import { dayLabel, money, shiftDay, todayISO } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { ViolationLog, ViolationRow } from "@/src/types";
import { Card, Chip, EmptyState, ErrorView, Header, Icon, LineItem, Loading, Pill, R, Row, S, StatTile, SyncBadge, T, useToast } from "@/src/ui";

export default function ViolationsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState<string | null>(null);
  const month = date.slice(0, 7);
  const q = useApi<ViolationLog>(`/violations-log?month=${month}&date=${date}`);
  const log = q.data;
  const canEdit = user?.role === "admin" || !!user?.perms?.edit_violations;
  const canLoss = user?.role === "admin" || !!user?.perms?.enter_losses;

  // كل تعديل يحفظ «تفتيش هذا التاريخ» للموظف (عدّادات + خسارة + ملاحظة)
  const save = async (row: ViolationRow, patch: Partial<{ counts: Record<string, number>; loss: number; note: string }>) => {
    try {
      const body = { employee_id: row.employee_id, date, counts: row.day_counts, loss: row.day_loss, note: row.day_note, ...patch };
      const r = await mutate("PUT", "/violations-log/entry", body);
      if (r.queued) toast("حُفظ محلياً، ستتم المزامنة عند توفر الاتصال", "info");
      await q.reload();
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    }
  };
  const step = (row: ViolationRow, code: string, d: number) => {
    const next = Math.max(0, (row.day_counts[code] ?? 0) + d);
    save(row, { counts: { ...row.day_counts, [code]: next } });
  };
  const dayTotal = (r: ViolationRow) => Object.values(r.day_counts).reduce((a, b) => a + b, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="سجل التفتيش والمخالفات" subtitle="يمكن إجراء عدة تفتيشات في الشهر، لكل تاريخ سجله" right={<SyncBadge />} />
      {q.loading ? (
        <Loading />
      ) : q.error && !log ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : log ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + S.xl }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}>
          <Row style={{ gap: S.sm, justifyContent: "space-between" }}>
            <Pressable testID="vio-day-prev" onPress={() => setDate(shiftDay(date, -1))} style={nav(colors)}><Icon name="chevron-forward" size={20} color={colors.onSurface} /></Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <T testID="vio-date-label" variant="h3">{dayLabel(date)}</T>
              <T variant="caption">تاريخ التفتيش / المتابعة</T>
            </View>
            <Pressable testID="vio-day-next" onPress={() => setDate(shiftDay(date, 1))} style={nav(colors)}><Icon name="chevron-back" size={20} color={colors.onSurface} /></Pressable>
          </Row>
          <Row style={{ gap: S.sm, flexWrap: "wrap" }}>
            <Chip testID="vio-today" label="اليوم" selected={date === todayISO()} onPress={() => setDate(todayISO())} />
            {log.inspections.map((i) => (
              <Chip key={i.date} label={`${i.date.slice(8)} · ${i.violations} مخالفة${i.loss ? ` · ${money(i.loss)}` : ""}`} selected={i.date === date} onPress={() => setDate(i.date)} />
            ))}
          </Row>
          <T variant="caption">تفتيشات هذا الشهر: {log.inspections.length}. كل ما يُسجَّل هنا (مخالفات وخسائر) يُحتسب تلقائيًا في منحة الشهر.</T>
          <Row style={{ gap: S.sm }}>
            <StatTile testID="vio-total" icon="warning-outline" label="مخالفات الشهر" value={String(log.total)} />
            <StatTile testID="vio-employees" icon="people-outline" label="موظفون لديهم مخالفات" value={String(log.employees_with)} />
            <StatTile testID="vio-loss" icon="cash-outline" label="خسائر الشهر" value={money(log.loss_total)} />
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
                      {dayTotal(r) || r.day_loss ? `اليوم: ${dayTotal(r)} مخالفة${r.day_loss ? ` · خسارة ${money(r.day_loss)}` : ""}` : "لا تسجيل في هذا التاريخ"}
                    </T>
                  </View>
                  {alert ? <Pill label="تنبيه" tone="error" /> : null}
                  <Pill testID={`vio-total-${i}`} label={`الشهر ${r.total}`} tone={r.total === 0 ? "success" : alert ? "error" : "warning"} />
                  <Icon name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                </Pressable>
                {expanded ? (
                  <View style={{ gap: S.xs }}>
                    {log.types.map((t) => (
                      <Row key={t.code} style={{ justifyContent: "space-between", gap: S.sm, minHeight: 44 }}>
                        <View style={{ flex: 1 }}>
                          <T>{t.label}</T>
                          {(r.counts[t.code] ?? 0) > 0 ? <T variant="caption">إجمالي الشهر {r.counts[t.code]}</T> : null}
                        </View>
                        <Row style={{ gap: S.sm }}>
                          <Pressable disabled={!canEdit} testID={`vio-minus-${i}-${t.code}`} onPress={() => step(r, t.code, -1)} style={stepBtn(colors)}>
                            <Icon name="remove" size={20} color={colors.onSurface} />
                          </Pressable>
                          <T testID={`vio-count-${i}-${t.code}`} variant="h3" style={{ minWidth: 28, textAlign: "center" }}>{r.day_counts[t.code] ?? 0}</T>
                          <Pressable disabled={!canEdit} testID={`vio-plus-${i}-${t.code}`} onPress={() => step(r, t.code, 1)} style={[stepBtn(colors), { backgroundColor: colors.brand }]}>
                            <Icon name="add" size={20} color={colors.onBrand} />
                          </Pressable>
                        </Row>
                      </Row>
                    ))}
                    {canLoss ? <LossField label="مبلغ الخسارة في هذا التفتيش (دج) — يدخل في نتيجة الأداء" value={r.day_loss} onCommit={(v) => save(r, { loss: v })} /> : null}
                    <NoteField label="ملاحظات هذا التفتيش" value={r.day_note} onCommit={(v) => save(r, { note: v })} />
                    {r.dates.length ? <T variant="caption">تواريخ تفتيش هذا الموظف في الشهر: {r.dates.map((d) => d.slice(8)).join(" · ")}</T> : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
          <Card style={{ gap: 0 }} testID="vio-summary">
            <T variant="h2" style={{ paddingBottom: S.sm }}>الملخص الشهري — أكثر المخالفات تكرارًا</T>
            {log.by_type.map((t) => <LineItem key={t.code} label={t.label} value={String(t.count)} tone={t.count ? "error" : "muted"} />)}
            <LineItem label="المجموع" value={String(log.total)} strong />
            <LineItem label="إجمالي الخسائر" value={money(log.loss_total)} tone={log.loss_total ? "error" : "muted"} />
          </Card>
        </ScrollView>
      ) : null}
    </View>
  );
}

const nav = (colors: any) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.surface });
const stepBtn = (colors: any) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.surfaceSecondary });

function useBox() {
  const { colors } = useTheme();
  return { minHeight: 44, borderRadius: R.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: S.md, fontFamily: "Tajawal", fontSize: 15, color: colors.onSurface, textAlign: "right" as const };
}

function NoteField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const { colors } = useTheme();
  const box = useBox();
  const [text, setText] = useState(value);
  return (
    <View style={{ gap: S.xs }}>
      <T variant="caption">{label}</T>
      <TextInput value={text} onChangeText={setText} onBlur={() => text !== value && onCommit(text)} placeholderTextColor={colors.muted} style={box} />
    </View>
  );
}

function LossField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const { colors } = useTheme();
  const box = useBox();
  const [text, setText] = useState(value ? String(value) : "");
  return (
    <View style={{ gap: S.xs }}>
      <T variant="caption">{label}</T>
      <TextInput testID="vio-loss-input" value={text} onChangeText={setText} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted}
        onBlur={() => { const n = parseNum(text) ?? 0; if (n !== value) onCommit(n); }} style={box} />
    </View>
  );
}
