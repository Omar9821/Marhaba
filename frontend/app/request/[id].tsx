import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { api } from "@/src/api";
import { STATUS_TONE } from "@/src/components/inbox";
import { dayLabel } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { RequestDetail } from "@/src/types";
import { Btn, Card, EmptyState, ErrorView, Field, Header, Loading, Pill, Row, S, T, useToast } from "@/src/ui";

function when(iso: string) {
  return `${dayLabel(iso.slice(0, 10))} · ${new Date(iso).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}`;
}

function FieldsView({ r }: { r: RequestDetail }) {
  const f = r.fields || {};
  const rows: [string, string][] = [];
  if (r.kind === "leave_exit") rows.push(["التاريخ", f.date], ["من", f.from_time], ["إلى", f.to_time || "—"]);
  if (r.kind === "absence_excuse") rows.push(["من تاريخ", f.from_date], ["إلى تاريخ", f.to_date], ["وثيقة مثبتة", f.has_document ? "نعم" : "لا"]);
  if (r.kind === "materials") rows.push(["نوع المواد", f.category || "—"], ["الآلة / الورشة", f.machine || "—"]);
  if (r.kind === "written_inquiry" && r.due_at) rows.push(["آخر أجل للرد", when(r.due_at)]);
  return (
    <>
      {rows.map(([k, v]) => <Row key={k} style={{ justifyContent: "space-between" }}><T variant="caption">{k}</T><T variant="label">{v}</T></Row>)}
      {r.kind === "materials" ? (f.items || []).map((it: any, i: number) => (
        <Row key={i} style={{ justifyContent: "space-between", gap: S.sm }}><T style={{ flex: 1 }}>{i + 1}. {it.name}{it.ref ? ` (${it.ref})` : ""}</T><T variant="label">{it.qty} {it.unit}</T></Row>
      )) : null}
    </>
  );
}

export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const q = useApi<RequestDetail>(`/requests/${id}`);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const r = q.data;

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); setText(""); setNote(""); await q.reload(); } catch (e: any) { toast(e?.message || "تعذر التنفيذ", "error"); } finally { setBusy(false); }
  };
  const decide = (decision: string, ok: string) => act(() => api.post(`/requests/${id}/decide`, { decision, note }), ok);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header back title={r ? r.kind_label : "الطلب"} subtitle={r?.ref} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: S.xxxl }}>
        {q.loading ? <Loading /> : q.error && !r ? <ErrorView message={q.error} onRetry={q.reload} /> : null}
        {!q.loading && !r && !q.error ? <EmptyState title="الطلب غير موجود" /> : null}
        {r ? (
          <>
            <Card style={{ gap: S.sm }}>
              <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                <T variant="h2" style={{ flex: 1 }}>{r.subject}</T>
                <Pill label={r.status_label} tone={STATUS_TONE[r.status]} />
              </Row>
              <T variant="caption">{r.employee_name}{r.position_name ? ` · ${r.position_name}` : ""} · {when(r.created_at)}</T>
              {r.overdue ? <Pill label="تجاوز مهلة الرد" tone="error" /> : null}
              <View style={{ height: 1, backgroundColor: colors.divider }} />
              <FieldsView r={r} />
            </Card>

            <T variant="h3">المراسلات والقرارات</T>
            {r.thread.length === 0 ? <T variant="caption">لا توجد ردود بعد.</T> : null}
            {r.thread.map((m) => {
              const staff = m.by_role === "admin" || m.by_role === "inspector" || m.by_role === "owner";
              return (
                <View key={m.id} testID={`thread-${m.id}`} style={{ alignSelf: m.type === "decision" ? "stretch" : staff ? "flex-start" : "flex-end", maxWidth: m.type === "decision" ? "100%" : "88%" }}>
                  <Card style={{ gap: S.xs, padding: S.md, backgroundColor: m.type === "decision" ? colors.warningSoft : staff ? colors.surface : colors.brandTertiary }}>
                    <T variant="caption">{m.by_name} · {when(m.at)}</T>
                    <T>{m.text}</T>
                  </Card>
                </View>
              );
            })}

            {r.can_reply ? (
              <Card style={{ gap: S.sm }}>
                <Field testID="reply-text" label={r.kind === "written_inquiry" && !r.can_decide ? "ردّك الكتابي" : "إضافة ردّ"} value={text} onChangeText={setText} multiline style={{ minHeight: 80, textAlignVertical: "top", paddingTop: S.sm }} />
                <Btn testID="reply-send" title="إرسال الرد" icon="send-outline" loading={busy} onPress={() => (text.trim() ? act(() => api.post(`/requests/${id}/reply`, { text }), "تم إرسال الرد") : toast("اكتب الرد أولاً", "error"))} />
              </Card>
            ) : null}

            {r.can_decide || r.can_close ? (
              <Card style={{ gap: S.sm }}>
                <T variant="label">قرار الإدارة</T>
                <Field testID="decide-note" label="ملاحظة (اختياري)" value={note} onChangeText={setNote} />
                {r.can_decide && r.status !== "approved" ? (
                  <Row style={{ gap: S.sm }}>
                    <View style={{ flex: 1 }}><Btn testID="decide-approve" title="موافقة" icon="checkmark-circle-outline" loading={busy} onPress={() => decide("approved", "تمت الموافقة")} /></View>
                    <View style={{ flex: 1 }}><Btn testID="decide-reject" variant="danger" title="رفض" icon="close-circle-outline" loading={busy} onPress={() => decide("rejected", "تم الرفض")} /></View>
                  </Row>
                ) : null}
                {r.can_decide && r.kind === "materials" && r.status === "approved" ? <Btn testID="decide-issue" title="تأكيد صرف المواد من المخزن" icon="cube-outline" loading={busy} onPress={() => decide("issued", "سُجّل الصرف")} /> : null}
                {r.can_close ? <Btn testID="decide-close" variant="outline" title="إغلاق الطلب" loading={busy} onPress={() => decide("closed", "أُغلق الطلب")} /> : null}
              </Card>
            ) : null}
            {r.can_withdraw ? <Btn testID="withdraw" variant="outline" title="سحب الطلب" loading={busy} onPress={() => act(() => api.post(`/requests/${id}/withdraw`), "تم سحب الطلب").then(() => router.back())} /> : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
