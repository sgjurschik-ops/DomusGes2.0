"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider
      // Defaults to refetching on every window focus, which on a desktop app
      // used all day means a DB round-trip every few seconds. The session
      // already lasts 8h (see authOptions.session.maxAge), so checking every
      // 5 minutes is still responsive to admin actions like disabling a user
      // while keeping the request volume sane.
      refetchInterval={5 * 60}
      refetchOnWindowFocus={false}
    >
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
