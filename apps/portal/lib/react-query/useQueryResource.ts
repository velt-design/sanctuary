import { useQuery, useQueryClient, type QueryFunction, type QueryKey } from '@tanstack/react-query';

export function useQueryResource<TQueryFnData, TQueryKey extends QueryKey>(opts: {
  queryKey: TQueryKey;
  queryFn: QueryFunction<TQueryFnData, TQueryKey>;
  enabled?: boolean;
  initialData?: TQueryFnData;
}): {
  data: TQueryFnData | null;
  isRefreshing: boolean;
  error: string | null;
  setData: (next: TQueryFnData) => void;
  refresh: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: opts.queryKey,
    queryFn: opts.queryFn,
    enabled: opts.enabled,
    initialData: opts.initialData,
  });

  const setData = (next: TQueryFnData) => {
    // Override tag-based inference so callers can supply plain query keys.
    queryClient.setQueryData<TQueryFnData, TQueryKey, TQueryFnData>(opts.queryKey, next);
  };

  const refresh = async () => {
    await refetch();
  };

  return {
    data: (data ?? null) as TQueryFnData | null,
    isRefreshing: isFetching,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    setData,
    refresh,
  };
}
