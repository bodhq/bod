"use client";

import { ArrowUpRight, Palette, ShieldCheck, UserRound, Users } from "lucide-react";
import Link from "next/link";

import { roleLabel } from "@/core/auth/roles";
import { useAuthUser } from "@/core/auth/store";
import { Page, PageHeader } from "@/core/ui/layout/Page";

import "../overview.css";

export default function OverviewView() {
  const user = useAuthUser();
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
    <Page>
      <PageHeader
        title="Váš pracovní prostor"
        description="Účet, zabezpečení a pracovní prostředí na jednom místě."
      />
      <div className="workspace-identity">
        {user?.display_name || user?.username}
        <span>·</span>
        {roleLabel(user?.active_role)}
      </div>
      <div className="workspace-links">
        {items.map(({ title, description, href, icon: Icon }) => (
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
    </Page>
  );
}
