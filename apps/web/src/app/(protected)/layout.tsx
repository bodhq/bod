import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getMe } from "@/core/auth/api";
import { AuthProvider } from "@/core/auth/components/AuthProvider";
import { env } from "@/core/env";
import { AppSidebar } from "@/core/ui/navigation/AppSidebar";

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
      <div className="flex h-dvh w-full overflow-hidden bg-(--color-background) text-(--color-foreground)">
        <AppSidebar />
        <main className="min-h-0 min-w-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto bg-(--color-background)">
          <div className="min-h-full w-full">{children}</div>
        </main>
      </div>
    </AuthProvider>
  );
}
