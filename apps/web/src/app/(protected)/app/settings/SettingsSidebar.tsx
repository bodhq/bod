"use client";

import { Bell, Palette, ShieldCheck, User } from "lucide-react";

import { SidebarNav, type NavItem } from "@/core/ui/navigation/SidebarNav";

const SETTINGS_NAV_ITEMS: NavItem[] = [
  { title: "Osobní údaje", icon: User, href: "/app/settings/profile" },
  { title: "Zabezpečení a relace", icon: ShieldCheck, href: "/app/settings/security" },
  { title: "Vzhled aplikace", icon: Palette, href: "/app/settings/appearance" },
  { title: "Oznámení", icon: Bell, href: "/app/settings/notifications" },
].map((item) => ({
  ...item,
  isActive: (activePath) =>
    activePath === item.href ||
    (activePath === "/app/settings" && item.href === "/app/settings/profile"),
}));

export function SettingsSidebar() {
  return (
    <SidebarNav
      ariaLabel="Navigace v nastavení"
      className="grid grid-cols-2 gap-2 lg:flex lg:flex-col"
      items={SETTINGS_NAV_ITEMS}
    />
  );
}
