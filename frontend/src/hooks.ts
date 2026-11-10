import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { getCached } from "@/src/api";

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!path) return;
      if (isRefresh) setRefreshing(true);
      try {
        const r = await getCached<T>(path);
        setData(r.data);
        setOffline(r.offline);
        setError(null);
      } catch (e: any) {
        setError(e?.message || "حدث خطأ");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [path],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, setData, loading: loading && data === undefined, error, offline, refreshing, refresh: () => load(true), reload: load };
}
