"use client";

import type { ReactNode } from "react";

import { domAnimation, LazyMotion } from "framer-motion";

export function FramerMotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
