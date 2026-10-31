import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "IP Africa Exchange" },
      { name: "description", content: "Intellectual property exchange for Kenya and Africa." },
      { name: "author", content: "IP Africa Exchange" },
      { property: "og:title", content: "IP Africa Exchange" },
      { property: "og:description", content: "Intellectual property exchange for Kenya and Africa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthSessionSync queryClient={queryClient} />
        <Outlet />
        <Toaster theme="light" position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthSessionSync({ queryClient }: { queryClient: QueryClient }) {
  const router = useRouter();
  const { syncSession, setRecoveryUserId } = useAuth();
  useEffect(() => {
    let active = true;
    // Capture recovery details before the auth client consumes and clears the URL hash.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recoveryToken = hash.get("type") === "recovery" && !hash.has("error")
      ? hash.get("access_token") : null;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) return;
      // Leave the auth callback before querying roles or revalidating protected routes.
      queueMicrotask(() => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY" || (event === "INITIAL_SESSION" && recoveryToken && session?.access_token === recoveryToken)) {
          setRecoveryUserId(session?.user.id ?? null);
        } else if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          setRecoveryUserId(null);
        }
        void syncSession(session);
        if (event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY") return;
        if (event === "SIGNED_OUT") queryClient.clear();
        void router.invalidate();
        if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
      });
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [queryClient, router, syncSession, setRecoveryUserId]);
  return null;
}
