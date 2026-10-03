// hooks/usePredict.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPredict } from "@/lib/api";
import type { PredictionInput } from "@/types/aqi";

export function usePredict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PredictionInput) => fetchPredict(input),
    onSuccess: () => {
      // Invalidate history so the table refreshes after a new prediction
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}
