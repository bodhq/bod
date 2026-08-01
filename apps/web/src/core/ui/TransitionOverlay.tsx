"use client";

import { AnimatePresence, domAnimation, LazyMotion, m } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuthTransition } from "@/core/auth/store";
import { KineticBackground } from "@/core/ui/KineticBackground";
import { LogoLoader } from "./LogoLoader";

export function TransitionOverlay() {
  const isTransitioningStore = useAuthTransition();
  const [isVisible, setIsVisible] = useState(false);
  const [exitRequested, setExitRequested] = useState(false);

  useEffect(() => {
    if (isTransitioningStore) {
      setIsVisible(true);
      setExitRequested(false);
    } else if (isVisible) {
      setExitRequested(true);
    }
  }, [isTransitioningStore, isVisible]);

  const handleCycleComplete = () => {
    if (exitRequested) {
      setIsVisible(false);
    }
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isVisible && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-(--color-primary) pointer-events-none overflow-hidden"
          >
            <KineticBackground />
            <m.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
              className="relative z-10 drop-shadow-2xl"
            >
              <LogoLoader
                state="loading"
                onCycleComplete={handleCycleComplete}
                className="h-24 w-auto text-black"
              />
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
