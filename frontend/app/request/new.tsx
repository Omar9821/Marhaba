import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { todayISO } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Employee, RequestKind } from "@/src/types";
import { Btn, Card, Chip, Field, Header, Icon, Row, S, SwitchRow, T, useToast } from "@/src/ui";

const KINDS: { kind: RequestKind; label: string; icon: any; to: ("supervisor" | "manager")[]; hint: string }[] = [
  { kind: "leave_exit", label: "إذن بالخروج", icon: "exit-outline", to: ["supervisor", "manager"], hint: "لخروج مؤقت أثناء الدوام" },
  { kind: "absence_excuse", label: "تبرير غياب", icon: "document-text-outline", to: ["supervisor", "manager"], hint: "لتبرير غياب أو تأخر مع الوثيقة" },
  { kind: "materials", label: "طلب مواد من المخزن", icon: "cube-outline", to: ["supervisor", "manager"], hint: "مواد أولية أو إكسسوارات أو قطع غيار" },
  { kind: "complaint", label: "شكوى", icon: "alert-circle-outline", to: ["manager"], hint: "سرّية: تصل المسيّر وحده" },
  { kind: "question", label: "سؤال / استفسار", icon: "help-circle-outline", to: ["supervisor", "manager"], hint: "أي سؤال أو اقتراح" },
];
const TO_LABEL = { supervisor: "مسؤول الورشة", manager: "المسيّر" };
type Item = { name: string; ref: string; unit: string; qty: string };

export default function NewRequest() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const inquiry = mode === "inquiry";
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [kind, setKind] = useState<RequestKind>(inquiry ? "written_inquiry" : "leave_exit");
  const spec = KINDS.find((k) => k.kind === kind);
  const [to, setTo] = useState<"supervisor" | "manager">("supervisor");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(todayISO());
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [toDate, setToDate] = useState("");
  const [hasDoc, setHasDoc] = useState(false);
  const [category, setCategory] = useState("");
  const [machine, setMachine] = useState("");
  const [items, setItems] = useState<Item[]>([{ name: "", ref: "", unit: "", qty: "1" }]);
  const [empId, setEmpId] = useState<string | null>(null);
  const [hours, setHours] = useState("48");
  const [busy, setBusy] = useState(false);
  const emps = useApi<Employee[]>(inquiry ? "/employees?include_inactive=false" : null);
  const effTo = spec && !spec.to.includes(to) ? spec.to[0] : to;

  const setItem = (i: number, k: keyof Item, v: string) => setItems((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const submit = async () => {
    const fields: any =
      kind === "leave_exit" ? { date, from_time: from, to_time: until }
      : kind === "absence_excuse" ? { from_date: date, to_date: toDate || date, has_document: hasDoc }
      : kind === "materials" ? { category, machine, items: items.filter((i) => i.name.trim()).map((i) => ({ ...i, qty: Number(i.qty.replace(",", ".")) || 0 })) }
      : {};
    setBusy(true);
    try {
      const r = await api.post("/requests", { kind, to: effTo, subject, body, fields, employee_id: inquiry ? empId : undefined, deadline_hours: Number(hours) || 48 });
      toast(inquiry ? "أُرسل الاستفسار الكتابي للعامل" : "تم إرسال الطلب");
      router.replace(`/request/${r.id}` as any);
    } catch (e: any) {
      toast(e?.message || "تعذر الإرسال", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header back title={inquiry ? "استفسار كتابي" : "طلب أو نموذج جديد"} subtitle={inquiry ? "يجب على العامل الرد كتابةً خلال المهلة" : `من: ${user?.name ?? ""}`} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: S.xxxl }}>
        {!inquiry ? (
          <Card style={{ gap: S.sm }}>
            <T variant="label">نوع الطلب</T>
            {KINDS.map((k) => (
              <Pressable key={k.kind} testID={`kind-${k.kind}`} onPress={() => setKind(k.kind)} style={{ minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: kind === k.kind ? colors.brandPrimary : colors.border, backgroundColor: kind === k.kind ? colors.brandTertiary : colors.surface, paddingHorizontal: S.md, justifyContent: "center" }}>
                <Row style={{ gap: S.sm }}>
                  <Icon name={k.icon} size={22} color={colors.brandPrimary} />
                  <View style={{ flex: 1 }}>
                    <T variant="label">{k.label}</T>
                    <T variant="caption">{k.hint}</T>
                  </View>
                </Row>
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: S.md }}>
          {inquiry ? (
            <>
              <T variant="label">العامل المعني</T>
              <Row style={{ flexWrap: "wrap", gap: S.sm }}>
                {(emps.data ?? []).map((e) => <Chip key={e.id} testID={`inq-emp-${e.id}`} label={e.full_name} selected={empId === e.id} onPress={() => setEmpId(e.id)} />)}
              </Row>
              <Field testID="req-subject" label="موضوع الاستفسار" value={subject} onChangeText={setSubject} placeholder="مثال: تأخر متكرر عن الدوام" />
              <Field testID="req-body" label="نص الاستفسار" value={body} onChangeText={setBody} multiline style={{ minHeight: 110, textAlignVertical: "top", paddingTop: S.sm }} placeholder="اكتب الوقائع والتواريخ والسؤال المطلوب الرد عنه" />
              <Field testID="req-hours" label="مهلة الرد (بالساعات)" value={hours} onChangeText={setHours} keyboardType="number-pad" hint="المعتاد 48 ساعة" />
            </>
          ) : (
            <>
              {spec && spec.to.length > 1 ? (
                <>
                  <T variant="label">موجَّه إلى</T>
                  <Row style={{ gap: S.sm }}>
                    {spec.to.map((t) => <Chip key={t} testID={`to-${t}`} label={TO_LABEL[t]} selected={effTo === t} onPress={() => setTo(t)} />)}
                  </Row>
                </>
              ) : <T variant="caption">موجَّه إلى: {TO_LABEL[effTo]}</T>}

              {kind === "leave_exit" ? (
                <>
                  <Field testID="req-date" label="تاريخ الخروج (سنة-شهر-يوم)" value={date} onChangeText={setDate} />
                  <Row style={{ gap: S.sm }}>
                    <View style={{ flex: 1 }}><Field testID="req-from" label="من الساعة" value={from} onChangeText={setFrom} placeholder="10:00" /></View>
                    <View style={{ flex: 1 }}><Field testID="req-until" label="إلى الساعة" value={until} onChangeText={setUntil} placeholder="12:00" /></View>
                  </Row>
                </>
              ) : null}
              {kind === "absence_excuse" ? (
                <>
                  <Row style={{ gap: S.sm }}>
                    <View style={{ flex: 1 }}><Field testID="req-date" label="من تاريخ" value={date} onChangeText={setDate} /></View>
                    <View style={{ flex: 1 }}><Field testID="req-todate" label="إلى تاريخ" value={toDate} onChangeText={setToDate} placeholder="اختياري" /></View>
                  </Row>
                  <SwitchRow testID="req-doc" label="لديّ وثيقة تثبت العذر" hint="تُقدَّم للمسؤول في أجل أقصاه المحدّد قانونًا" value={hasDoc} onChange={setHasDoc} />
                </>
              ) : null}
              {kind === "materials" ? (
                <>
                  <Field testID="req-category" label="نوع المواد" value={category} onChangeText={setCategory} placeholder="مواد أولية / إكسسوارات / قطع غيار" />
                  <Field testID="req-machine" label="الآلة أو الورشة المعنية" value={machine} onChangeText={setMachine} placeholder="مثال: آلة الفور" />
                  <T variant="label">المواد المطلوبة</T>
                  {items.map((it, i) => (
                    <Card key={i} style={{ gap: S.sm, backgroundColor: colors.surfaceSecondary }}>
                      <Field testID={`item-name-${i}`} label={`المادة ${i + 1}`} value={it.name} onChangeText={(v) => setItem(i, "name", v)} />
                      <Row style={{ gap: S.sm }}>
                        <View style={{ flex: 1 }}><Field testID={`item-qty-${i}`} label="الكمية" value={it.qty} onChangeText={(v) => setItem(i, "qty", v)} keyboardType="decimal-pad" /></View>
                        <View style={{ flex: 1 }}><Field testID={`item-unit-${i}`} label="الوحدة" value={it.unit} onChangeText={(v) => setItem(i, "unit", v)} placeholder="قطعة / متر / لتر" /></View>
                        <View style={{ flex: 1 }}><Field label="المرجع" value={it.ref} onChangeText={(v) => setItem(i, "ref", v)} placeholder="اختياري" /></View>
                      </Row>
                      {items.length > 1 ? <Btn small variant="outline" title="حذف المادة" onPress={() => setItems((a) => a.filter((_, j) => j !== i))} /> : null}
                    </Card>
                  ))}
                  {items.length < 15 ? <Btn testID="item-add" variant="outline" icon="add" title="إضافة مادة" onPress={() => setItems((a) => [...a, { name: "", ref: "", unit: "", qty: "1" }])} /> : null}
                </>
              ) : null}
              {kind === "complaint" || kind === "question" ? <Field testID="req-subject" label="الموضوع" value={subject} onChangeText={setSubject} /> : null}
              <Field testID="req-body" label={kind === "leave_exit" || kind === "absence_excuse" ? "السبب" : kind === "materials" ? "ملاحظات" : "التفاصيل"} value={body} onChangeText={setBody} multiline style={{ minHeight: 110, textAlignVertical: "top", paddingTop: S.sm }} />
            </>
          )}
        </Card>
        <Btn testID="req-submit" title={inquiry ? "إرسال الاستفسار" : "إرسال الطلب"} icon="send-outline" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
