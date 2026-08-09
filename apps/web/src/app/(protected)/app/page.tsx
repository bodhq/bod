"use client";

import { motion } from "framer-motion";
import { useAuthStore } from "@/core/auth/store";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.6 }}
      className="flex flex-col gap-10 pb-32 max-w-5xl mx-auto px-4 sm:px-8 pt-8"
    >
      {/* Header */}
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-(--color-foreground)">
          Dobrý den, {user?.email?.split("@")[0] || "Učiteli"} 👋
        </h1>
        <p className="text-lg font-medium text-(--color-muted-foreground)">
          Vítejte zpět v přehledu.
        </p>
      </header>
    </motion.div>
  );
}
