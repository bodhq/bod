import { BookOpen, CalendarDays, DoorOpen, GraduationCap, LayoutDashboard } from "lucide-react";

export const NAV_ITEMS = [
  { title: "Přehled", href: "/app", icon: LayoutDashboard, permissions: [] },
  {
    title: "Rozvrh",
    href: "/app/timetable",
    icon: CalendarDays,
    permissions: ["timetable.read", "timetable.edit", "timetable.substitute"],
  },
  {
    title: "Třídnice",
    href: "/app/classbook",
    icon: BookOpen,
    permissions: [
      "classbook.read",
      "classbook.write",
      "classbook.manage",
      "attendance.mark",
      "attendance.excuse",
      "attendance.request",
    ],
  },
  {
    title: "Škola",
    href: "/app/school",
    icon: GraduationCap,
    permissions: ["school.manage"],
  },
  {
    title: "Učebny",
    href: "/app/rooms",
    icon: DoorOpen,
    permissions: ["rooms.manage"],
  },
];

export const pageNames: Record<string, string> = {
  "/app": "Přehled",
  "/app/timetable": "Rozvrh",
  "/app/classbook": "Třídnice",
  "/app/school": "Škola",
  "/app/rooms": "Učebny",
  "/app/settings": "Můj účet",
  "/app/settings/profile": "Osobní údaje",
  "/app/settings/security": "Zabezpečení",
  "/app/settings/appearance": "Vzhled a přístupnost",
  "/app/settings/access": "Správa přístupů",
};

export interface BreadcrumbItem {
  title: string;
  href?: string;
}

export function pageBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/app") return [{ title: "Přehled" }];
  return [
    { title: "Přehled", href: "/app" },
    ...Object.entries(pageNames)
      .filter(([path]) => path !== "/app" && (pathname === path || pathname.startsWith(`${path}/`)))
      .sort(([a], [b]) => a.length - b.length)
      .map(([href, title]) => ({ title, href })),
  ];
}
