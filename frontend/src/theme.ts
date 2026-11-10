// Design tokens for this app (light theme). Keys match the "color" block of /app/design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#ffffff",
  onSurface: "#111814",
  surfaceSecondary: "#f5f7f6",
  onSurfaceSecondary: "#1a201d",
  surfaceTertiary: "#eaeeec",
  onSurfaceTertiary: "#1a201d",
  surfaceInverse: "#1a201d",
  onSurfaceInverse: "#ffffff",
  muted: "#687670",

  brand: "#2d4a3e",
  onBrand: "#ffffff",
  brandPrimary: "#3e6b57",
  onBrandPrimary: "#ffffff",
  brandSecondary: "#8ba396",
  onBrandSecondary: "#ffffff",
  brandTertiary: "#e2efe8",
  onBrandTertiary: "#1a201d",

  success: "#107c41",
  onSuccess: "#ffffff",
  warning: "#b87400",
  onWarning: "#ffffff",
  error: "#c50f1f",
  onError: "#ffffff",
  info: "#2d4a3e",
  onInfo: "#ffffff",

  border: "#e0e5e3",
  borderStrong: "#a4b5ac",
  divider: "#e8ecea",

  successSoft: "#e3f3ea",
  warningSoft: "#fbf0dc",
  errorSoft: "#fbe5e7",
  scrim: "rgba(17,24,20,0.45)",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
