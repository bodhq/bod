import { redirect } from "next/navigation";
import { getMe } from "@/core/auth/api"; // TODO: @bod/api-client
import { AuthProvider } from "@/core/auth/components/AuthProvider";
import { AppSidebar } from "@/core/ui/app-shell/AppSidebar";
import { Dock } from "@/core/ui/app-shell/Dock";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Získání uživatele na straně serveru
  let user = null;
  try {
    user = await getMe();
  } catch (_error) {
    // Pokud API vrátí 401
  }

  // 2. Pokud se ověření nezdaří, okamžitý redirect (Zero Layout Shift)
  if (!user) {
    redirect("/login");
  }

  // 3. Render responzivního App Shellu (Sidebar na Desktopu, Dock na Mobilu)
  return (
    <AuthProvider initialUser={user}>
      <div className="flex h-screen w-screen bg-(--color-surface) text-(--color-foreground) overflow-hidden">
        {/* Desktop Sidebar (skrytý na mobilu) */}
        <AppSidebar />

        {/* Hlavní obsahová část s mírně světlejším povrchem než Sidebar pro Discord efekt */}
        <main className="flex-1 h-full overflow-auto relative z-10 bg-(--color-surface-raised) rounded-tl-none md:rounded-tl-3xl md:m-2 md:ml-0 shadow-sm border border-transparent md:border-(--color-border)">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 pb-32 md:pb-8">
            {children}
          </div>
        </main>

        {/* Mobilní Dock (skrytý na desktopu) */}
        <div className="md:hidden block">
          <Dock />
        </div>
      </div>
    </AuthProvider>
  );
}
