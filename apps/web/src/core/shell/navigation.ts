import { CalendarDays, LayoutDashboard } from "lucide-react";

export const NAV_ITEMS = [
  { title: "Přehled", href: "/app", icon: LayoutDashboard, permissions: [] },
  {
    title: "Rozvrh",
    href: "/app/timetable",
    icon: CalendarDays,
    permissions: ["timetable.read", "timetable.edit", "timetable.substitute"],
  },
];

export const pageNames: Record<string, string> = {
  "/app": "Přehled",
  "/app/timetable": "Rozvrh",
  "/app/settings": "Můj účet",
  "/app/settings/profile": "Osobní údaje",
  "/app/settings/security": "Zabezpečení",
  "/app/settings/appearance": "Vzhled a přístupnost",
  "/app/settings/access": "Správa přístupů",
};
