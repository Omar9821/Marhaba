import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Position } from "@/src/types";
import { EmptyState, ErrorView, Header, Icon, Loading, Pill, R, Row, S, T } from "@/src/ui";

export default function Positions() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = useApi<Position[]>("/positions");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header
        back
        title="المناصب والمؤشرات"
        right={
          <Pressable testID="add-position-button" onPress={() => router.push("/settings/position-form" as any)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
            <Icon name="add" size={24} color={colors.onBrandPrimary} />
          </Pressable>
        }
      />
      {q.loading ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorView message={q.error} onRetry={q.refresh} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: insets.bottom + S.xl }}
          ListEmptyComponent={<EmptyState icon="briefcase-outline" title="لم يتم إعداد المناصب بعد" />}
          renderItem={({ item, index }) => {
            const sum = item.kpis.reduce((a, k) => a + k.weight, 0);
            return (
              <Pressable
                testID={`position-row-${index}`}
                onPress={() => router.push({ pathname: "/settings/position-form", params: { id: item.id } } as any)}
                style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: R.lg, borderWidth: 1, borderColor: colors.border, padding: S.lg, gap: S.sm, opacity: pressed ? 0.7 : 1 })}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <T variant="h3">{item.name}</T>
                  <Pill label={`${item.kpis.length} مؤشرات`} />
                </Row>
                {item.kpis.map((k) => (
                  <Row key={k.id} style={{ justifyContent: "space-between" }}>
                    <T variant="caption" color="onSurfaceSecondary" style={{ flex: 1 }}>{k.name}</T>
                    <T variant="caption">{num(k.weight)}% • هدف {num(k.target)} {k.unit}</T>
                  </Row>
                ))}
                {Math.abs(sum - 100) > 0.01 && item.kpis.length ? <Pill label={`مجموع الأوزان ${num(sum)}% (يجب 100%)`} tone="error" /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
