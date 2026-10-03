// hooks/useHistory.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHistory } from "@/lib/api";

export function useHistory(limit = 50) {
  return useQuery({
    queryKey: ["history", limit],
    queryFn: () => fetchHistory(limit),
    refetchInterval: 30_000, // auto-refresh every 30 seconds
    staleTime: 10_000,
    retry: 2,
  });
}
