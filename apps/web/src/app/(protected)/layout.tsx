import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getMe } from "@/core/auth/api";
import { AuthProvider } from "@/core/auth/components/AuthProvider";
import { env } from "@/core/env";
import { AppShell } from "@/core/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Resolve the session before rendering the protected shell.
  let user = null;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;

  if (sessionId) {
    try {
      user = await getMe({
        baseUrl: env.API_INTERNAL_URL,
        headers: {
          Cookie: `session_id=${sessionId}`,
          // Server components cannot forward Set-Cookie to the browser.
          "X-Session-Refresh": "skip",
        },
      });
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code !== "AUTH_UNAUTHENTICATED" && code !== "AUTH_SESSION_NOT_FOUND") {
        throw error;
      }
    }
  }

  if (!user) {
    redirect("/login?error=unauthorized");
  }

  return (
    <AuthProvider initialUser={user}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
