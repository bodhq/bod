"use client";

import { Palette, ShieldCheck, UserRound } from "lucide-react";

import { useAuthUser } from "@/core/auth/store";
import { type NavItem, NavList } from "@/core/ui/navigation/NavList";

import "../account.css";

const accountItems: NavItem[] = [
  { title: "Osobní údaje", href: "/app/settings/profile", icon: UserRound },
  { title: "Zabezpečení", href: "/app/settings/security", icon: ShieldCheck },
  { title: "Vzhled a přístupnost", href: "/app/settings/appearance", icon: Palette },
];
export function AccountNavigation() {
  const user = useAuthUser();
  const canManageAccess = user?.permissions?.some((permission) =>
    ["users.manage", "roles.manage", "audit.read"].includes(permission),
  );
  const items = user?.must_change_password
    ? accountItems.filter((item) => item.href.endsWith("/security"))
    : [
        ...accountItems,
        ...(canManageAccess
          ? [{ title: "Správa přístupů", href: "/app/settings/access", icon: ShieldCheck }]
          : []),
      ];
  return <NavList items={items} orientation="horizontal" ariaLabel="Navigace v nastavení" />;
}
