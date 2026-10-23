"use client";

import type { ReactNode } from "react";

import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";

import { useAppearanceStore } from "@/core/store/appearance";

export function FramerMotionProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useAppearanceStore((state) => state.reduceMotion);

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
