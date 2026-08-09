"use client";

import { domAnimation, LazyMotion, m } from "framer-motion";
import { useEffect } from "react";
import { useAuthStore } from "@/core/auth/store";

export default function ProtectedTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  // No longer needed: Transitioning is handled by Next.js top loader

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
