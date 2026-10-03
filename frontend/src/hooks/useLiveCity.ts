import { useQuery } from "@tanstack/react-query";
import { fetchLiveCity } from "@/lib/api";
import type { LiveCityResult } from "@/types/aqi";

export function useLiveCity(city: string | null) {
  return useQuery<LiveCityResult, Error>({
    queryKey: ["liveCity", city],
    queryFn: ({ signal }) => {
      if (!city) throw new Error("City name required");
      return fetchLiveCity(city, signal);
    },
    enabled: Boolean(city && city.trim().length > 0),
    staleTime: 60_000, // 1 minute fresh live cache
    retry: (failureCount, error) => {
      // Do not retry 404 "Station not found"
      if (error?.message?.toLowerCase().includes("not found") || error?.message?.includes("404")) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}

