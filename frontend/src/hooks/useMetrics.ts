// hooks/useMetrics.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMetrics } from "@/lib/api";

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes — metrics are static between retrains
    retry: 2,
  });
}
