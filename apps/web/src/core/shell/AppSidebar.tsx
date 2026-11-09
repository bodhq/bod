"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import Link from "next/link";

import { useAppearanceStore } from "@/core/appearance/preferences";
import { LogoutButton } from "@/core/auth/components/LogoutButton";
import { roleLabel } from "@/core/auth/roles";
import { useAuthUser } from "@/core/auth/store";
import { Button } from "@/core/ui/actions/Button";
import { Logo } from "@/core/ui/brand/Logo";
import { NavList } from "@/core/ui/navigation/NavList";

import { NAV_ITEMS } from "./navigation";

export function AppSidebar({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const user = useAuthUser();
  const sidebarCollapsed = useAppearanceStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useAppearanceStore((state) => state.setSidebarCollapsed);
  const collapsed = sidebarCollapsed && !mobile;
  const items = user?.must_change_password
    ? []
    : NAV_ITEMS.filter(
        (item) =>
          !item.permissions.length ||
          item.permissions.some((permission) => user?.permissions?.includes(permission)),
      );
  const displayName = user?.display_name || user?.first_name || user?.username || "Můj účet";
  return (
    <aside
      className={`app-sidebar${mobile ? " app-sidebar-mobile" : ""}`}
      data-collapsed={collapsed}
      aria-label="Hlavní panel"
    >
      <div className="sidebar-brand">
        <Link
          href="/app"
          className="sidebar-home"
          aria-label="bod — přehled"
          aria-hidden={collapsed || undefined}
          inert={collapsed || undefined}
          tabIndex={collapsed ? -1 : undefined}
          onClick={onNavigate}
        >
          <Logo className="sidebar-mark" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={mobile ? onNavigate : () => setSidebarCollapsed(!sidebarCollapsed)}
          aria-expanded={mobile ? undefined : !collapsed}
          aria-label={
            mobile ? "Zavřít navigaci" : collapsed ? "Rozbalit navigaci" : "Zúžit navigaci"
          }
        >
          {mobile ? (
            <X size={17} />
          ) : (
            <span className="sidebar-toggle-icon" aria-hidden="true">
              <PanelLeftClose className="sidebar-collapse-icon" size={17} />
              <PanelLeftOpen className="sidebar-expand-icon" size={17} />
            </span>
          )}
        </Button>
      </div>
      <p className="sidebar-caption" aria-hidden={collapsed || undefined}>
        Pracovní prostor
      </p>
      <NavList
        items={items}
        isMinimized={collapsed}
        ariaLabel="Hlavní navigace"
        onNavigate={onNavigate}
      />
      <div className="sidebar-bottom">
        <NavList
          items={[{ title: "Můj účet", href: "/app/settings", icon: Settings }]}
          isMinimized={collapsed}
          ariaLabel="Účet"
          onNavigate={onNavigate}
        />
        <div className="sidebar-user">
          <Link
            href="/app/settings/profile"
            aria-label={`Můj profil: ${displayName}`}
            onClick={onNavigate}
            className="sidebar-profile"
          >
            <span className="sidebar-avatar" aria-hidden="true">
              {displayName.slice(0, 1).toLocaleUpperCase("cs")}
            </span>
            <span className="sidebar-identity" aria-hidden={collapsed || undefined}>
              <strong className="sidebar-name">{displayName}</strong>
              <span className="sidebar-role">{roleLabel(user?.active_role)}</span>
            </span>
          </Link>
          <LogoutButton
            className="sidebar-logout"
            variant="ghost"
            aria-label="Odhlásit se"
            title={collapsed ? "Odhlásit se" : undefined}
          >
            <LogOut size={17} aria-hidden="true" />
            <span className="sidebar-logout-label" aria-hidden={collapsed || undefined}>
              Odhlásit se
            </span>
          </LogoutButton>
        </div>
      </div>
    </aside>
  );
}
