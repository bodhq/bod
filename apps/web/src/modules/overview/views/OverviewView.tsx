"use client";

import { ArrowUpRight, Palette, ShieldCheck, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { roleLabel, schoolRole } from "@/core/auth/roles";
import { useAuthUser } from "@/core/auth/store";
import { NAV_ITEMS } from "@/core/shell/navigation";
import { ModuleLayout } from "@/core/ui/layout/Page";

import { PersonalDay } from "../components/PersonalDay";
import { SchoolLandscape } from "../components/SchoolLandscape";
import { SchoolTasks } from "../components/SchoolTasks";
import { TeacherDay } from "../components/TeacherDay";
import "../overview.css";

export default function OverviewView() {
  const user = useAuthUser();
  const personal = ["parent", "student"].includes(schoolRole(user) ?? "");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const teacher =
    user?.permissions?.includes("classbook.write") &&
    user.permissions.includes("classbook.read") &&
    user.permissions.includes("timetable.read") &&
    !user.permissions.includes("classbook.manage");
  const descriptions: Record<string, string> = {
    "/app/timetable": "Týdenní výuka, příprava rozvrhu a suplování.",
    "/app/classbook": "Zápisy výuky, docházka a omluvenky.",
    "/app/school": "Školní roky, třídy, předměty a skupiny.",
    "/app/rooms": "Učebny, kapacity a dostupnost.",
  };
  const modules = NAV_ITEMS.filter((item) =>
    item.permissions.some((permission) => user?.permissions?.includes(permission)),
  ).map((item) => ({ ...item, description: descriptions[item.href] }));
  const items = [
    {
      title: "Můj profil",
      description: "Osobní údaje a aktivní role.",
      href: "/app/settings/profile",
      icon: UserRound,
    },
    {
      title: "Zabezpečení",
      description: "Heslo a přihlášená zařízení.",
      href: "/app/settings/security",
      icon: ShieldCheck,
    },
    {
      title: "Vzhled prostředí",
      description: "Rozložení, barvy a přístupnost.",
      href: "/app/settings/appearance",
      icon: Palette,
    },
    ...(user?.permissions?.some((permission) =>
      ["users.manage", "roles.manage", "audit.read"].includes(permission),
    )
      ? [
          {
            title: "Správa přístupů",
            description: "Účty, role a historie změn.",
            href: "/app/settings/access",
            icon: Users,
          },
        ]
      : []),
  ];
  return (
    <ModuleLayout
      title={
        teacher
          ? "Můj den"
          : personal
            ? schoolRole(user) === "parent"
              ? "Přehled dítěte"
              : "Můj den"
            : "Přehled školy"
      }
      description={
        teacher
          ? "Vaše výuka a zápisy na jednom místě."
          : personal
            ? "Výuka, docházka a omluvenky."
            : "Aktuální úkoly a správa školy."
      }
    >
      <div className="workspace-identity">
        {user?.display_name || user?.username}
        <span>·</span>
        {roleLabel(user?.active_role)}
      </div>
      {personal ? <PersonalDay /> : teacher ? <TeacherDay /> : <SchoolTasks />}
      <div className="workspace-links">
        {(personal ? [] : modules).map(({ title, description, href, icon: Icon }) => (
          <Link href={href} key={href} className="workspace-link">
            <span className="workspace-icon">
              <Icon size={21} aria-hidden="true" />
            </span>
            <span>
              <strong>{title}</strong>
              <span>{description}</span>
            </span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        ))}
      </div>
      {!teacher && !personal && modules.length > 0 && (
        <details onToggle={(event) => setSummaryOpen(event.currentTarget.open)}>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">Souhrn školy</summary>
          {summaryOpen && <SchoolLandscape />}
        </details>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">Nastavení účtu</summary>
        <div className="workspace-links">
          {items.map(({ title, description, href }) => (
            <Link href={href} key={href} className="workspace-link">
              <div>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </details>
    </ModuleLayout>
  );
}
