import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { num } from "@/src/format";
import { useApi } from "@/src/hooks";
import { useTheme } from "@/src/theme";
import { Position, SheetParams, typeLabel } from "@/src/types";
import { EmptyState, ErrorView, Header, Icon, Loading, Pill, R, Row, S, T } from "@/src/ui";

export default function Positions() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = useApi<Position[]>("/positions");
  const params = useApi<SheetParams>("/sheet/params");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header
        back
        title="المناصب"
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
            return (
              <Pressable
                testID={`position-row-${index}`}
                onPress={() => router.push({ pathname: "/settings/position-form", params: { id: item.id } } as any)}
                style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: R.lg, borderWidth: 1, borderColor: colors.border, padding: S.lg, gap: S.sm, opacity: pressed ? 0.7 : 1 })}
              >
                <Row style={{ justifyContent: "space-between", gap: S.sm }}>
                  <T variant="h3" style={{ flex: 1 }}>{item.name}</T>
                  <Pill label={typeLabel(params.data?.commission_types, item.perf_type)} />
                </Row>
                <T variant="caption">وزن المنصب الافتراضي: {item.post_weight == null ? "—" : num(item.post_weight, 2)}</T>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
