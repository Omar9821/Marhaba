import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { useTheme } from "@/src/theme";
import { F, R, S, T } from "@/src/ui";

export const parseNum = (s: string): number | null => {
  const v = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() === "" || !Number.isFinite(v) ? null : v;
};

/** حقل رقمي: يعرض القيمة الحالية ويحفظ عند مغادرة الحقل (onCommit) فقط إذا تغيّرت. */
export function CellInput({ label, value, onCommit, editable = true, unit, scale = 1, testID, highlight }: {
  label: string; value: number | null; onCommit: (v: number | null) => void; editable?: boolean; unit?: string; scale?: number; testID?: string; highlight?: boolean;
}) {
  const { colors } = useTheme();
  const show = (v: number | null) => (v === null || v === undefined ? "" : String(Math.round(v * scale * 1e6) / 1e6));
  const [text, setText] = useState(show(value));
  useEffect(() => setText(show(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ flex: 1, minWidth: 130, gap: S.xs }}>
      <T variant="caption">{label}{unit ? ` (${unit})` : ""}</T>
      <TextInput
        testID={testID}
        editable={editable}
        value={text}
        onChangeText={setText}
        onBlur={() => {
          const n = parseNum(text);
          const next = n === null ? null : n / scale;
          if (next !== value) onCommit(next);
        }}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.muted}
        style={{
          minHeight: 46, borderRadius: R.md, borderWidth: 1, borderColor: highlight ? colors.brandSecondary : colors.border,
          backgroundColor: !editable ? colors.surfaceTertiary : highlight ? colors.brandTertiary : colors.surfaceSecondary,
          paddingHorizontal: S.md, fontFamily: F.display, fontSize: 17, color: colors.onSurface, textAlign: "center",
        }}
      />
    </View>
  );
}

/** خلية نتيجة محسوبة (رمادية في Excel). */
export function CalcCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 110, backgroundColor: colors.surfaceTertiary, borderRadius: R.md, padding: S.sm, gap: 2 }}>
      <T variant="caption">{label}</T>
      <T variant={strong ? "h3" : "label"}>{value}</T>
    </View>
  );
}
