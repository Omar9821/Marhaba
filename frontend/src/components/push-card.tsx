import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { disablePush, enablePush, pushState, PushState } from "@/src/push";
import { Btn, Card, T, useToast } from "@/src/ui";

const MSG: Partial<Record<PushState, string>> = {
  "needs-install": "على الآيفون: افتح الموقع في Safari ثم «مشاركة» ← «إضافة إلى الشاشة الرئيسية»، وافتح التطبيق من الشاشة الرئيسية ليمكن تفعيل الإشعارات.",
  denied: "الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (إعدادات الموقع ← الإشعارات) ثم أعد فتح الصفحة.",
  unavailable: "خدمة الإشعارات غير مفعّلة على الخادم بعد.",
};

/** بطاقة تفعيل إشعارات الهاتف (للويب): تُعرض في تبويب الطلبات. */
export function PushCard() {
  const toast = useToast();
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (Platform.OS === "web") pushState().then(setSt); }, []);
  if (Platform.OS !== "web" || !st || st === "unsupported") return null;
  if (st === "enabled") {
    return (
      <Card style={{ gap: 4 }} testID="push-card">
        <T variant="label">الإشعارات مفعّلة على هذا الجهاز ✓</T>
        <Btn small variant="outline" title="إيقاف الإشعارات" loading={busy} onPress={async () => { setBusy(true); setSt(await disablePush()); setBusy(false); }} />
      </Card>
    );
  }
  return (
    <Card style={{ gap: 8 }} testID="push-card">
      <T variant="label">فعّل إشعارات الهاتف</T>
      <T variant="caption">يصلك تنبيه بالرد على طلبك أو بالرسائل والإعلانات حتى والتطبيق مغلق.</T>
      {MSG[st] ? <T variant="caption" color="warning">{MSG[st]}</T> : null}
      {st === "disabled" ? (
        <Btn testID="push-enable" title="تفعيل الإشعارات" icon="notifications-outline" loading={busy}
          onPress={async () => { setBusy(true); try { const r = await enablePush(); setSt(r); if (r === "enabled") toast("تم تفعيل الإشعارات"); } catch (e: any) { toast(e?.message || "تعذر التفعيل", "error"); } finally { setBusy(false); } }} />
      ) : null}
    </Card>
  );
}
