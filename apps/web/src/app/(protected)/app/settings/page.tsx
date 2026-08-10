"use client";

import { useAuthStore } from "@/core/auth/store";
import Link from "next/link";
import { Text } from "@/core/ui/Text";
import { m, Variants } from "framer-motion";
import { Bell, Palette, ShieldCheck, User } from "lucide-react";
import React from "react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0, duration: 0.5 } },
};

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <m.div variants={itemVariants} className="flex flex-col gap-3">
      <Text variant="caption" className="pl-4 uppercase tracking-wider font-extrabold text-(--color-muted-foreground)">
        {title}
      </Text>
      <div className="flex flex-col gap-1 p-2 rounded-3xl bg-(--color-surface-100) border border-(--color-border-subtle) shadow-sm shadow-black/5 dark:shadow-black/20">
        {children}
      </div>
    </m.div>
  );
}

function SettingsItem({
  icon,
  iconColor,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  desc?: string;
  href: string;
}) {
  return (
    <Link href={href} className="block outline-none">
      <m.div
        initial={{ scale: 1 }}
        whileHover={{ backgroundColor: "var(--color-surface-200)" }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
        className="flex items-center justify-between p-3 sm:p-4 rounded-[1.25rem] cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-[0.8rem] flex items-center justify-center text-white shadow-sm shrink-0 ${iconColor}`}
          >
            {icon}
          </div>
          <div className="flex flex-col">
            <Text variant="body-large" className="font-bold">
              {title}
            </Text>
            {desc && <Text variant="muted">{desc}</Text>}
          </div>
        </div>
        <div className="text-(--color-muted-foreground) group-hover:text-(--color-foreground) transition-colors mr-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </m.div>
    </Link>
  );
}

export default function SettingsPage() {
  const _user = useAuthStore((s) => s.user);

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-10 pb-32 max-w-4xl mx-auto px-4 sm:px-8 pt-8"
    >
      <header className="flex flex-col gap-1 pl-2">
        <m.div variants={itemVariants}>
          <Text variant="h1">Nastavení</Text>
        </m.div>
        <m.div variants={itemVariants}>
          <Text variant="muted-lg">
            Spravujte svůj účet a předvolby aplikace.
          </Text>
        </m.div>
      </header>

      <div className="flex flex-col gap-8">
        <SettingsSection title="Účet">
          <SettingsItem
            icon={<User size={20} />}
            iconColor="bg-[#007AFF]"
            title="Osobní údaje"
            desc="Spravujte svůj profil, avatar a email."
            href="/app/settings/profile"
          />
          <SettingsItem
            icon={<ShieldCheck size={20} />}
            iconColor="bg-[#34C759]"
            title="Zabezpečení a relace"
            desc="Aktivní přihlášení a správa hesel."
            href="/app/settings/security"
          />
        </SettingsSection>

        <SettingsSection title="Předvolby">
          <SettingsItem
            icon={<Palette size={20} />}
            iconColor="bg-[#5856D6]"
            title="Vzhled aplikace"
            desc="Světlý/tmavý režim a motivy."
            href="/app/settings/appearance"
          />
          <SettingsItem
            icon={<Bell size={20} />}
            iconColor="bg-[#FF2D55]"
            title="Oznámení"
            desc="Upozornění a e-mailové notifikace."
            href="/app/settings/notifications"
          />
        </SettingsSection>
      </div>
    </m.div>
  );
}
