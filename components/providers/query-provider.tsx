"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

// Reidrata modelo/parâmetros do localStorage só no cliente, depois do primeiro
// paint, para o HTML do servidor e o do cliente baterem.
function SettingsHydrator() {
  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
  }, []);
  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              if (failureCount > 3) return false;
              if (error instanceof Error && error.message.includes("404")) {
                return false;
              }
              return true;
            },
          },
          mutations: {
            retry: 1,
            onError: (error) => {
              console.error("Mutation error:", error);
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsHydrator />
      {children}
    </QueryClientProvider>
  );
}
