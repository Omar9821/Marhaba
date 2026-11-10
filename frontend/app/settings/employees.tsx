import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { money } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Employee } from "@/src/types";
import { Chip, ChipRow, EmptyState, ErrorView, Header, Icon, Loading, Pill, R, S, T } from "@/src/ui";

export default function Employees() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const q = useApi<Employee[]>("/employees");
  const list = useMemo(() => (q.data ?? []).filter((e) => filter === "all" || e.status === filter), [q.data, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header
        back
        title="إدارة الموظفين"
        subtitle={`${q.data?.length ?? 0} موظف`}
        right={
          <Pressable testID="add-employee-button" onPress={() => router.push("/settings/employee-form" as any)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
            <Icon name="add" size={24} color={colors.onBrandPrimary} />
          </Pressable>
        }
      />
      <View style={{ backgroundColor: colors.surface }}>
        <ChipRow>
          <Chip testID="filter-active-chip" label="النشطون" selected={filter === "active"} onPress={() => setFilter("active")} />
          <Chip testID="filter-inactive-chip" label="المؤرشفون" selected={filter === "inactive"} onPress={() => setFilter("inactive")} />
          <Chip testID="filter-all-chip" label="الكل" selected={filter === "all"} onPress={() => setFilter("all")} />
        </ChipRow>
      </View>
      {q.loading ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(e) => e.id}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ padding: S.lg, gap: S.sm, paddingBottom: insets.bottom + S.xl }}
          ListEmptyComponent={<EmptyState icon="people-outline" title="لا يوجد موظفون" subtitle="اضغط على + لإضافة موظف جديد" />}
          renderItem={({ item, index }) => (
            <Pressable
              testID={`employee-row-${index}`}
              onPress={() => router.push({ pathname: "/settings/employee-form", params: { id: item.id } } as any)}
              style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                <T variant="h3" color="brand">{item.full_name.charAt(0)}</T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="label">{item.full_name}</T>
                <T variant="caption">{item.position_name} • {money(item.base_salary)}</T>
              </View>
              <Pill label={item.status === "active" ? "نشط" : "معطل"} tone={item.status === "active" ? "success" : "muted"} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row-reverse", alignItems: "center", gap: S.md, padding: S.md, borderRadius: R.md, borderWidth: 1 },
});
