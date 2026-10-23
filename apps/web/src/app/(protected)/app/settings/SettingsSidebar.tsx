"use client";

import { Palette, ShieldCheck, User } from "lucide-react";

import { useAuthUser } from "@/core/auth/store";
import { type NavItem, SidebarNav } from "@/core/ui/navigation/SidebarNav";

const SETTINGS_NAV_ITEMS: NavItem[] = [
  { title: "Osobní údaje", icon: User, href: "/app/settings/profile" },
  { title: "Zabezpečení", icon: ShieldCheck, href: "/app/settings/security" },
  { title: "Vzhled a přístupnost", icon: Palette, href: "/app/settings/appearance" },
];

export function SettingsSidebar() {
  const user = useAuthUser();
  const canManageAccess = user?.permissions?.some((permission) =>
    ["users.manage", "roles.manage", "audit.read"].includes(permission),
  );
  const availableItems = user?.must_change_password
    ? SETTINGS_NAV_ITEMS.filter((item) => item.href === "/app/settings/security")
    : [
        ...SETTINGS_NAV_ITEMS,
        ...(canManageAccess
          ? [{ title: "Správa přístupů", icon: ShieldCheck, href: "/app/settings/access" }]
          : []),
      ];
  const items: NavItem[] = availableItems.map(
    (item): NavItem => ({
      ...item,
      isActive: (activePath) =>
        activePath === item.href ||
        (activePath === "/app/settings" && item.href === "/app/settings/profile"),
    }),
  );

  return (
    <SidebarNav
      ariaLabel="Navigace v nastavení"
      className="grid grid-cols-2 gap-2 lg:flex lg:flex-col"
      items={items}
    />
  );
}
