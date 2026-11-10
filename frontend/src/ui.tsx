import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput,
  TextInputProps, TextProps, View, ViewProps, ViewStyle,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { subscribeOnline, subscribeOutbox } from "@/src/api";
import { monthLabel, num, shiftMonth } from "@/src/format";
import { ThemeColors, useTheme } from "@/src/theme";

export const Icon = Ionicons;
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export const F = { display: "Cairo", body: "Tajawal", medium: "Tajawal-Medium", bold: "Tajawal-Bold" };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const R = { sm: 6, md: 12, lg: 20, pill: 999 };
const native = Platform.OS !== "web";

type Variant = "h1" | "h2" | "h3" | "body" | "label" | "caption" | "num";
const VARIANTS: Record<Variant, { fontFamily: string; fontSize: number; lineHeight: number }> = {
  h1: { fontFamily: F.display, fontSize: 24, lineHeight: 38 },
  h2: { fontFamily: F.display, fontSize: 20, lineHeight: 32 },
  h3: { fontFamily: F.medium, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: F.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  num: { fontFamily: F.display, fontSize: 34, lineHeight: 50 },
};

export function T({ variant = "body", color, style, ...p }: TextProps & { variant?: Variant; color?: keyof ThemeColors }) {
  const { colors } = useTheme();
  return (
    <Text
      {...p}
      style={[VARIANTS[variant], { color: colors[color ?? (variant === "caption" ? "muted" : "onSurface")], textAlign: "right", writingDirection: "rtl" }, style]}
    />
  );
}

export function Row({ style, ...p }: ViewProps) {
  return <View {...p} style={[{ flexDirection: "row-reverse", alignItems: "center" }, style]} />;
}

export function Card({ style, ...p }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...p}
      style={[
        {
          backgroundColor: colors.surface, borderRadius: R.lg, borderWidth: 1, borderColor: colors.border, padding: S.lg,
          shadowColor: colors.onSurface, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
        },
        style,
      ]}
    />
  );
}

type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
export function Btn({
  title, onPress, variant = "primary", icon, loading, disabled, testID, style, small,
}: {
  title: string; onPress?: () => void; variant?: BtnVariant; icon?: IconName; loading?: boolean; disabled?: boolean;
  testID?: string; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.brandPrimary, secondary: colors.brandTertiary, danger: colors.error, ghost: colors.surface, outline: colors.surface }[variant];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onBrandTertiary, danger: colors.onError, ghost: colors.brandPrimary, outline: colors.onSurface }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: small ? 40 : 52, borderRadius: R.md, backgroundColor: bg, flexDirection: "row-reverse", alignItems: "center",
          justifyContent: "center", gap: S.sm, paddingHorizontal: S.lg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }], borderWidth: variant === "outline" ? 1 : 0, borderColor: colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <T variant="label" style={{ color: fg }}>{title}</T>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, style, ...p }: TextInputProps & { label: string; hint?: string }) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: S.xs }}>
      <T variant="label" color="onSurfaceSecondary">{label}</T>
      <TextInput
        placeholderTextColor={colors.muted}
        {...p}
        onFocus={(e) => { setFocus(true); p.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
        style={[
          {
            minHeight: 48, borderRadius: R.md, borderWidth: 1, borderColor: focus ? colors.brandPrimary : colors.border,
            backgroundColor: colors.surfaceSecondary, paddingHorizontal: S.md, fontFamily: F.body, fontSize: 16,
            color: colors.onSurface, textAlign: "right",
          },
          style,
        ]}
      />
      {hint ? <T variant="caption">{hint}</T> : null}
    </View>
  );
}

export function SwitchRow({ label, value, onChange, testID, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", minHeight: 48, gap: S.md }}>
      <View style={{ flex: 1 }}>
        <T variant="label">{label}</T>
        {hint ? <T variant="caption">{hint}</T> : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onChange} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surface} />
    </Row>
  );
}

export function Segmented<K extends string>({ options, value, onChange, testID }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Row testID={testID} style={{ backgroundColor: colors.surfaceTertiary, borderRadius: R.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={`${testID}-${o.key}`}
            onPress={() => onChange(o.key)}
            style={{ flex: 1, minHeight: 38, borderRadius: R.md - 2, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.surface : colors.surfaceTertiary }}
          >
            <T variant="label" style={{ textAlign: "center", color: active ? colors.brand : colors.muted }}>{o.label}</T>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Chip({ label, selected, onPress, testID, badge }: { label: string; selected?: boolean; onPress?: () => void; testID?: string; badge?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        height: 36, flexShrink: 0, paddingHorizontal: S.md, borderRadius: R.pill, borderWidth: 1, flexDirection: "row-reverse", alignItems: "center", gap: S.xs,
        borderColor: selected ? colors.brandPrimary : colors.border, backgroundColor: selected ? colors.brandPrimary : colors.surface,
      }}
    >
      <T variant="label" style={{ color: selected ? colors.onBrandPrimary : colors.onSurface }}>{label}</T>
      {badge ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
          <Text style={{ color: colors.onError, fontSize: 11, fontFamily: F.bold }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ height: 56 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: S.sm, paddingHorizontal: S.lg, alignItems: "center", flexDirection: "row-reverse", flexGrow: 1 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Pill({ label, tone = "brand", testID }: { label: string; tone?: "brand" | "success" | "warning" | "error" | "muted"; testID?: string }) {
  const { colors } = useTheme();
  const map = {
    brand: [colors.brandTertiary, colors.brand], success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning],
    error: [colors.errorSoft, colors.error], muted: [colors.surfaceTertiary, colors.muted],
  }[tone];
  return (
    <View testID={testID} style={{ backgroundColor: map[0], borderRadius: R.pill, paddingHorizontal: S.sm + 2, paddingVertical: 2, alignSelf: "flex-end" }}>
      <T variant="caption" style={{ color: map[1], fontFamily: F.medium }}>{label}</T>
    </View>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: keyof ThemeColors }) {
  const { colors } = useTheme();
  const v = Math.max(0, Math.min(1, value));
  const color = colors[tone ?? (value >= 1 ? "success" : value >= 0.7 ? "brandPrimary" : value >= 0.5 ? "warning" : "error")];
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden", flexDirection: "row-reverse" }}>
      <View style={{ width: `${v * 100}%`, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

export function BarChart({ data, max, unit = "%", testID }: { data: { key: string; label: string; value: number }[]; max?: number; unit?: string; testID?: string }) {
  const { colors } = useTheme();
  const [sel, setSel] = useState<string | null>(null);
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  const selected = data.find((d) => d.key === sel);
  return (
    <View testID={testID}>
      <View style={{ height: 22, marginBottom: S.xs }}>
        <T variant="caption" color={selected ? "brand" : "muted"}>
          {selected ? `${selected.label}: ${num(selected.value, 1)}${unit}` : "اضغط على عمود لعرض القيمة"}
        </T>
      </View>
      <View style={{ height: 140, flexDirection: "row-reverse", alignItems: "flex-end", gap: 6 }}>
        {data.map((d) => {
          const active = sel === d.key;
          return (
            <Pressable
              key={d.key}
              testID={`${testID}-bar-${d.key}`}
              onPress={() => setSel(active ? null : d.key)}
              style={{ flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" }}
            >
              <View
                style={{
                  width: "72%", maxWidth: 34, height: `${Math.max(3, Math.min(100, (d.value / m) * 100))}%`,
                  backgroundColor: active ? colors.brand : colors.brandSecondary, borderTopLeftRadius: 6, borderTopRightRadius: 6,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: S.xs, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: S.xs }}>
        {data.map((d) => (
          <Text key={d.key} numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: F.body, fontSize: 10, color: colors.muted }}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

export function Loading({ label = "جاري التحميل..." }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View testID="loading-state" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: S.xl, gap: S.md }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
      <T color="muted" style={{ textAlign: "center" }}>{label}</T>
    </View>
  );
}

export function EmptyState({ icon = "file-tray-outline", title, subtitle, action, testID = "empty-state" }: { icon?: IconName; title: string; subtitle?: string; action?: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", padding: S.xl, gap: S.sm }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={32} color={colors.brand} />
      </View>
      <T variant="h3" style={{ textAlign: "center" }}>{title}</T>
      {subtitle ? <T color="muted" style={{ textAlign: "center" }}>{subtitle}</T> : null}
      {action}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      testID="error-state"
      icon="alert-circle-outline"
      title="تعذر تحميل البيانات"
      subtitle={message}
      action={onRetry ? <Btn testID="retry-button" title="إعادة المحاولة" variant="secondary" onPress={onRetry} style={{ marginTop: S.sm }} /> : undefined}
    />
  );
}

export function Header({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.lg, paddingBottom: S.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
      <Row style={{ gap: S.sm }}>
        {back ? (
          <Pressable
            testID="header-back-button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.surfaceSecondary }}
          >
            <Icon name="chevron-forward" size={24} color={colors.onSurface} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <T variant="h1" numberOfLines={1}>{title}</T>
          {subtitle ? <T variant="caption" numberOfLines={1}>{subtitle}</T> : null}
        </View>
        {right}
      </Row>
    </View>
  );
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const { colors } = useTheme();
  const btn = { width: 40, height: 40, borderRadius: 20, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.surfaceSecondary };
  return (
    <Row style={{ gap: S.sm, justifyContent: "space-between" }}>
      <Pressable testID="month-prev-button" style={btn} onPress={() => onChange(shiftMonth(month, -1))}>
        <Icon name="chevron-forward" size={20} color={colors.onSurface} />
      </Pressable>
      <T testID="month-label" variant="h3" style={{ textAlign: "center", flex: 1 }}>{monthLabel(month)}</T>
      <Pressable testID="month-next-button" style={btn} onPress={() => onChange(shiftMonth(month, 1))}>
        <Icon name="chevron-back" size={20} color={colors.onSurface} />
      </Pressable>
    </Row>
  );
}

export function SettingsRow({ icon, title, subtitle, onPress, testID, last }: { icon: IconName; title: string; subtitle?: string; onPress?: () => void; testID?: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row-reverse", alignItems: "center", gap: S.md, paddingVertical: S.md, minHeight: 60,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.divider, opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: R.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="h3">{title}</T>
        {subtitle ? <T variant="caption">{subtitle}</T> : null}
      </View>
      <Icon name="chevron-back" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined} />
        <View testID={testID} style={{ backgroundColor: colors.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: insets.bottom + S.lg, maxHeight: "88%" }}>
          <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginBottom: S.md }} />
          <Row style={{ justifyContent: "space-between", marginBottom: S.md }}>
            <T variant="h2">{title}</T>
            <Pressable testID="sheet-close-button" onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Icon name="close" size={24} color={colors.muted} />
            </Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.md }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ConfirmSheet({ visible, title, message, confirmLabel = "تأكيد", onConfirm, onClose, loading }: { visible: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID="confirm-sheet">
      <T color="muted">{message}</T>
      <Btn testID="confirm-sheet-confirm-button" title={confirmLabel} variant="danger" onPress={onConfirm} loading={loading} />
      <Btn testID="confirm-sheet-cancel-button" title="إلغاء" variant="outline" onPress={onClose} />
    </Sheet>
  );
}

// ---- Toast ----
type ToastType = "success" | "error" | "info";
const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ msg: string; type: ToastType } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const show = useCallback(
    (msg: string, type: ToastType = "success") => {
      setT({ msg, type });
      Animated.spring(anim, { toValue: 1, useNativeDriver: native }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: native }).start(() => setT(null)), 2800);
    },
    [anim],
  );
  const bg = t?.type === "error" ? colors.error : t?.type === "info" ? colors.warning : colors.surfaceInverse;
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t ? (
        <Animated.View
          pointerEvents="none"
          testID="toast-message"
          style={{
            position: "absolute", top: insets.top + S.sm, left: S.lg, right: S.lg, opacity: anim, backgroundColor: bg, borderRadius: R.md, padding: S.md,
            flexDirection: "row-reverse", gap: S.sm, alignItems: "center", transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          }}
        >
          <Icon name={t.type === "error" ? "alert-circle" : t.type === "info" ? "cloud-offline" : "checkmark-circle"} size={20} color={colors.onSurfaceInverse} />
          <T style={{ color: colors.onSurfaceInverse, flex: 1 }}>{t.msg}</T>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function SyncBadge() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  useEffect(() => subscribeOutbox(setPending), []);
  useEffect(() => subscribeOnline(setOnline), []);
  if (!online) return <Pill testID="sync-status-badge" label="غير متصل" tone="warning" />;
  if (pending) return <Pill testID="sync-status-badge" label={`${pending} بانتظار المزامنة`} tone="warning" />;
  return <Pill testID="sync-status-badge" label="متزامن" tone="success" />;
}

export function StatTile({ label, value, icon, testID }: { label: string; value: string; icon: IconName; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: R.md, padding: S.md, gap: S.xs }}>
      <Icon name={icon} size={18} color={colors.brandPrimary} style={{ alignSelf: "flex-end" }} />
      <T variant="h2" numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      <T variant="caption" numberOfLines={1}>{label}</T>
    </View>
  );
}

export function LineItem({ label, value, tone, strong, testID }: { label: string; value: string; tone?: keyof ThemeColors; strong?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", paddingVertical: S.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, gap: S.md }}>
      <T variant={strong ? "h3" : "body"} color={strong ? "onSurface" : "onSurfaceSecondary"} style={{ flex: 1 }}>{label}</T>
      <T testID={testID} variant={strong ? "h3" : "label"} style={{ color: colors[tone ?? "onSurface"] }}>{value}</T>
    </Row>
  );
}
