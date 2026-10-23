import { Calendar, LayoutDashboard, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { name: "Přehled", href: "/app", icon: LayoutDashboard },
  { name: "Rozvrh", href: "/app/timetable", icon: Calendar },
  { name: "Nastavení", href: "/app/settings", icon: Settings },
];
