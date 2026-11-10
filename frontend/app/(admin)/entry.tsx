import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getCached, mutate, setCache, uid } from "@/src/api";
import { dayLabel, DEDUCTION_LABEL, deductionText, num, shiftDay, todayISO } from "@/src/format";
import { useApi } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Employee, Infraction, InfType, Position } from "@/src/types";
import { Btn, Card, Chip, ChipRow, EmptyState, ErrorView, Header, Icon, Loading, Pill, ProgressBar, R, Row, S, Segmented, SyncBadge, T, useToast } from "@/src/ui";

const tap = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
};

export default function Entry() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { colors } = useTheme();
  const [mode, setMode] = useState<"perf" | "inf">(params.mode === "infractions" ? "inf" : "perf");
  useEffect(() => {
    if (params.mode === "infractions") setMode("inf");
  }, [params.mode]);
  const [date, setDate] = useState(todayISO());
  const emps = useApi<Employee[]>("/employees?include_inactive=false");
  const positions = useApi<Position[]>("/positions");
  const types = useApi<InfType[]>("/infraction-types");
  const [empId, setEmpId] = useState<string | null>(null);
  const [dayInfs, setDayInfs] = useState<Infraction[]>([]);
  const infPath = `/infractions?date=${date}`;

  useEffect(() => {
    if (emps.data?.length && !emps.data.find((e) => e.id === empId)) setEmpId(emps.data[0].id);
  }, [emps.data, empId]);
  useEffect(() => {
    getCached<Infraction[]>(infPath).then((r) => setDayInfs(r.data)).catch(() => setDayInfs([]));
  }, [infPath]);

  const emp = emps.data?.find((e) => e.id === empId);
  const pos = positions.data?.find((p) => p.id === emp?.position_id);
  const loading = emps.loading || positions.loading || types.loading;
  const error = emps.error || positions.error || types.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="الإدخال اليومي" subtitle="الأداء والمخالفات" right={<SyncBadge />} />
      <View style={{ backgroundColor: colors.surface, paddingTop: S.md, gap: S.md }}>
        <Row style={{ paddingHorizontal: S.lg, gap: S.sm }}>
          <Pressable testID="day-prev-button" onPress={() => setDate(shiftDay(date, -1))} style={styles.dayBtn(colors)}>
            <Icon name="chevron-forward" size={20} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="day-today-button" onPress={() => setDate(todayISO())} style={{ flex: 1, alignItems: "center" }}>
            <T testID="entry-date-label" variant="h3" style={{ textAlign: "center" }}>{dayLabel(date)}</T>
            {date === todayISO() ? <T variant="caption" style={{ textAlign: "center" }} color="brandPrimary">اليوم</T> : <T variant="caption" style={{ textAlign: "center" }}>اضغط للعودة إلى اليوم</T>}
          </Pressable>
          <Pressable testID="day-next-button" onPress={() => setDate(shiftDay(date, 1))} style={styles.dayBtn(colors)}>
            <Icon name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
        </Row>
        <View style={{ paddingHorizontal: S.lg }}>
          <Segmented testID="entry-mode" value={mode} onChange={setMode} options={[{ key: "perf", label: "الأداء" }, { key: "inf", label: "المخالفات" }]} />
        </View>
        <ChipRow>
          {(emps.data ?? []).map((e, i) => (
            <Chip key={e.id} testID={`employee-chip-${i}`} label={e.full_name} selected={e.id === empId} onPress={() => setEmpId(e.id)} badge={dayInfs.filter((x) => x.employee_id === e.id).length} />
          ))}
        </ChipRow>
      </View>
      {loading ? (
        <Loading />
      ) : error && !emps.data ? (
        <ErrorView message={error} onRetry={emps.refresh} />
      ) : !emp ? (
        <EmptyState icon="people-outline" title="لا يوجد موظفون نشطون" subtitle="أضف موظفين من الإعدادات أولاً" />
      ) : mode === "perf" ? (
        <PerfForm key={`${emp.id}-${date}`} emp={emp} pos={pos} date={date} />
      ) : (
        <InfPanel emp={emp} types={(types.data ?? []).filter((t) => t.active)} allTypes={types.data ?? []} date={date} dayInfs={dayInfs} emps={emps.data ?? []}
          onChange={(next) => { setDayInfs(next); setCache(infPath, next); }} />
      )}
    </View>
  );
}

const styles = {
  dayBtn: (colors: any) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.surfaceSecondary }),
};

function useBottomPad() {
  const insets = useSafeAreaInsets();
  return (usesNativeTabs ? insets.bottom : 0) + S.xl;
}

function PerfForm({ emp, pos, date }: { emp: Employee; pos?: Position; date: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const bottomPad = useBottomPad();
  const path = `/performance?employee_id=${emp.id}&date=${date}`;
  const [vals, setVals] = useState<Record<string, { target: string; achieved: string }>>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const init = (rows: { kpi_id: string; target: number; achieved: number }[]) => {
      const m: Record<string, { target: string; achieved: string }> = {};
      (pos?.kpis ?? []).forEach((k) => {
        const r = rows.find((x) => x.kpi_id === k.id);
        m[k.id] = { target: String(r ? r.target : k.target), achieved: r ? String(r.achieved) : "" };
      });
      setVals(m);
      setExists(rows.length > 0);
      setReady(true);
    };
    getCached(path).then((r) => init(r.data)).catch(() => init([]));
  }, [path, pos]);

  const n = (s?: string) => {
    const v = parseFloat((s ?? "").replace(",", "."));
    return Number.isFinite(v) ? v : 0;
  };
  const dayScore = useMemo(
    () => (pos?.kpis ?? []).reduce((acc, k) => {
      const t = n(vals[k.id]?.target);
      return acc + (t > 0 ? Math.min(n(vals[k.id]?.achieved) / t, 1.2) : 0) * k.weight;
    }, 0),
    [vals, pos],
  );

  if (!pos || pos.kpis.length === 0) return <EmptyState icon="options-outline" title="لا توجد مؤشرات أداء لهذا المنصب" subtitle="أضف مؤشرات من الإعدادات ← المناصب" />;
  if (!ready) return <Loading />;

  const save = async () => {
    setSaving(true);
    try {
      const values = pos.kpis.map((k) => ({ kpi_id: k.id, target: n(vals[k.id]?.target), achieved: n(vals[k.id]?.achieved) }));
      const r = await mutate("POST", "/performance/batch", { employee_id: emp.id, date, values });
      await setCache(path, values);
      setExists(true);
      tap();
      toast(r.queued ? "حُفظ محلياً، ستتم المزامنة عند توفر الاتصال" : "تم حفظ الأداء بنجاح", r.queued ? "info" : "success");
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareScrollView bottomOffset={80} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: bottomPad }}>
      <Card style={{ gap: S.sm }}>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <T variant="h3">{emp.full_name}</T>
            <T variant="caption">{pos.name}</T>
          </View>
          <View style={{ alignItems: "flex-start" }}>
            <T variant="caption">نتيجة اليوم</T>
            <T testID="day-score-preview" variant="h2" color="brand">{num(dayScore, 1)}%</T>
          </View>
        </Row>
        <ProgressBar value={dayScore / 100} />
        {exists ? <Pill label="تم إدخال بيانات هذا اليوم — يمكنك التعديل" tone="success" /> : null}
      </Card>
      {pos.kpis.map((k, i) => {
        const t = n(vals[k.id]?.target);
        const ratio = t > 0 ? n(vals[k.id]?.achieved) / t : 0;
        return (
          <Card key={k.id} style={{ gap: S.sm }} testID={`kpi-entry-card-${i}`}>
            <Row style={{ justifyContent: "space-between", gap: S.sm }}>
              <T variant="label" style={{ flex: 1 }}>{k.name}</T>
              <Pill label={`الوزن ${num(k.weight)}%`} />
            </Row>
            <Row style={{ gap: S.sm }}>
              <NumBox testID={`kpi-target-input-${i}`} label={`المستهدف (${k.unit})`} value={vals[k.id]?.target ?? ""} onChange={(v) => setVals((s) => ({ ...s, [k.id]: { ...s[k.id], target: v } }))} />
              <NumBox testID={`kpi-achieved-input-${i}`} label={`المحقق (${k.unit})`} value={vals[k.id]?.achieved ?? ""} onChange={(v) => setVals((s) => ({ ...s, [k.id]: { ...s[k.id], achieved: v } }))} highlight />
            </Row>
            {k.unit === "يوم" ? (
              <Row style={{ gap: S.sm }}>
                <Btn small testID={`kpi-present-button-${i}`} title="حاضر" variant={vals[k.id]?.achieved === "1" ? "primary" : "outline"} style={{ flex: 1 }} onPress={() => setVals((s) => ({ ...s, [k.id]: { ...s[k.id], achieved: "1" } }))} />
                <Btn small testID={`kpi-absent-button-${i}`} title="غائب" variant={vals[k.id]?.achieved === "0" ? "danger" : "outline"} style={{ flex: 1 }} onPress={() => setVals((s) => ({ ...s, [k.id]: { ...s[k.id], achieved: "0" } }))} />
              </Row>
            ) : null}
            <Row style={{ gap: S.sm }}>
              <View style={{ flex: 1 }}><ProgressBar value={ratio} /></View>
              <T variant="caption" color="onSurface">{num(ratio * 100, 0)}%</T>
            </Row>
          </Card>
        );
      })}
      <Btn testID="save-performance-button" title="حفظ أداء اليوم" icon="checkmark-circle-outline" onPress={save} loading={saving} />
      <T variant="caption" style={{ textAlign: "center" }}>يعمل الحفظ بدون إنترنت وتتم المزامنة تلقائياً</T>
      <View style={{ height: 1, backgroundColor: colors.surfaceSecondary }} />
    </KeyboardAwareScrollView>
  );
}

function NumBox({ label, value, onChange, testID, highlight }: { label: string; value: string; onChange: (v: string) => void; testID: string; highlight?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: S.xs }}>
      <T variant="caption">{label}</T>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        style={{ minHeight: 48, borderRadius: R.md, borderWidth: 1, borderColor: highlight ? colors.brandSecondary : colors.border, backgroundColor: highlight ? colors.brandTertiary : colors.surfaceSecondary, paddingHorizontal: S.md, fontFamily: "Cairo", fontSize: 18, color: colors.onSurface, textAlign: "center" }}
      />
    </View>
  );
}

function InfPanel({ emp, types, allTypes, date, dayInfs, emps, onChange }: { emp: Employee; types: InfType[]; allTypes: InfType[]; date: string; dayInfs: Infraction[]; emps: Employee[]; onChange: (n: Infraction[]) => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const bottomPad = useBottomPad();
  const mine = dayInfs.filter((i) => i.employee_id === emp.id);

  const toggle = async (t: InfType) => {
    tap();
    const existing = mine.find((i) => i.type_id === t.id);
    try {
      if (existing) {
        onChange(dayInfs.filter((i) => i.id !== existing.id));
        const r = await mutate("DELETE", `/infractions/${existing.id}`);
        toast(r.queued ? "أُلغيت محلياً، ستتم المزامنة لاحقاً" : `أُلغيت مخالفة "${t.name}"`, r.queued ? "info" : "success");
      } else {
        const item: Infraction = { id: uid(), employee_id: emp.id, type_id: t.id, date, note: "" };
        onChange([item, ...dayInfs]);
        const r = await mutate("POST", "/infractions", item);
        toast(r.queued ? "سُجلت محلياً، ستتم المزامنة لاحقاً" : `سُجلت مخالفة "${t.name}" على ${emp.full_name}`, r.queued ? "info" : "success");
      }
    } catch (e: any) {
      toast(e?.message || "تعذر الحفظ", "error");
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: bottomPad }}>
      <T variant="caption">اختر المخالفات المرتكبة من طرف {emp.full_name} في {dayLabel(date)}</T>
      {types.length === 0 ? (
        <EmptyState icon="list-outline" title="لا توجد مخالفات مفعلة" subtitle="فعّل المخالفات من الإعدادات" />
      ) : (
        <Card style={{ paddingVertical: S.xs }}>
          {types.map((t, i) => {
            const checked = !!mine.find((x) => x.type_id === t.id);
            return (
              <Pressable
                key={t.id}
                testID={`infraction-toggle-${i}`}
                onPress={() => toggle(t)}
                style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: S.md, minHeight: 60, opacity: pressed ? 0.6 : 1, borderBottomWidth: i === types.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.divider })}
              >
                <Icon name={checked ? "checkbox" : "square-outline"} size={26} color={checked ? colors.error : colors.borderStrong} />
                <View style={{ flex: 1 }}>
                  <T variant="label">{t.name}</T>
                  <T variant="caption">{DEDUCTION_LABEL[t.deduction_type]}</T>
                </View>
                <T variant="label" color={checked ? "error" : "muted"}>{deductionText(t.deduction_type, t.value)}</T>
              </Pressable>
            );
          })}
        </Card>
      )}
      <T variant="h3" style={{ marginTop: S.sm }}>سجل مخالفات اليوم ({dayInfs.length})</T>
      {dayInfs.length === 0 ? (
        <T variant="caption">لا توجد مخالفات مسجلة لهذا اليوم</T>
      ) : (
        <Card style={{ paddingVertical: S.xs }} testID="day-infractions-log">
          {dayInfs.map((i, idx) => (
            <Row key={i.id} style={{ gap: S.sm, paddingVertical: S.sm, borderBottomWidth: idx === dayInfs.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
              <Icon name="ellipse" size={8} color={colors.error} />
              <T style={{ flex: 1 }}>{emps.find((e) => e.id === i.employee_id)?.full_name ?? "—"}</T>
              <T variant="caption">{allTypes.find((t) => t.id === i.type_id)?.name ?? "—"}</T>
            </Row>
          ))}
        </Card>
      )}
    </KeyboardAwareScrollView>
  );
}
