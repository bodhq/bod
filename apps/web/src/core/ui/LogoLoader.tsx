"use client";

import {
  domAnimation,
  LazyMotion,
  m,
  useAnimationControls,
} from "framer-motion";
import type React from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/core/utils";

interface LogoLoaderProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  state?: "idle" | "loading";
  progress?: number; // 0 až 100 pro manuální ovládání
  onCycleComplete?: () => void;
}

export function LogoLoader({
  className,
  state = "loading",
  progress,
  onCycleComplete,
  ...props
}: LogoLoaderProps) {
  const p =
    progress !== undefined ? Math.max(0, Math.min(100, progress)) / 100 : null;

  const bControls = useAnimationControls();
  const dControls = useAnimationControls();
  const clipControls = useAnimationControls();
  const oControls = useAnimationControls();

  const isMounted = useRef(true);
  const onCycleCompleteRef = useRef(onCycleComplete);

  useEffect(() => {
    onCycleCompleteRef.current = onCycleComplete;
  }, [onCycleComplete]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const idleTransition = { duration: 0.6, ease: "easeOut" as const };
    const manualTransition = {
      type: "spring" as const,
      bounce: 0,
      duration: 0.8,
    };
    const loopTransition = { duration: 1.2, ease: [0.76, 0, 0.24, 1] as const };

    if (p !== null) {
      bControls.start({ x: 80.5 * (1 - p), transition: manualTransition });
      dControls.start({ x: -80.5 * (1 - p), transition: manualTransition });
      clipControls.start({ y: 53.143 * (1 - p), transition: manualTransition });
      oControls.start({ pathLength: p / 2, transition: manualTransition });
      return;
    }

    if (state === "idle") {
      bControls.start({ x: 0, transition: idleTransition });
      dControls.start({ x: 0, transition: idleTransition });
      clipControls.start({ y: 0, transition: idleTransition });
      oControls.start({ pathLength: 0.5, transition: idleTransition });
      return;
    }

    let active = true;
    const runLoop = async () => {
      while (active && isMounted.current) {
        // Nadechnutí (rozpojení loga)
        await Promise.all([
          bControls.start({ x: 80.5, transition: loopTransition }),
          dControls.start({ x: -80.5, transition: loopTransition }),
          clipControls.start({ y: 53.143, transition: loopTransition }),
          oControls.start({ pathLength: 0, transition: loopTransition }),
        ]);

        if (!active || !isMounted.current) break;

        // Vydechnutí (spojení loga)
        await Promise.all([
          bControls.start({ x: 0, transition: loopTransition }),
          dControls.start({ x: 0, transition: loopTransition }),
          clipControls.start({ y: 0, transition: loopTransition }),
          oControls.start({ pathLength: 0.5, transition: loopTransition }),
        ]);
        if (active && isMounted.current) onCycleCompleteRef.current?.();
      }
    };

    runLoop();

    return () => {
      active = false;
    };
  }, [state, p, bControls, dControls, clipControls, oControls]);

  return (
    <LazyMotion features={domAnimation}>
      <svg
        width="269"
        height="160"
        viewBox="0 0 269 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Načítám..."
        className={cn("text-(--color-primary)", className)}
        {...props}
      >
        <title>Načítám...</title>

        <defs>
          <mask id="o-gap-mask">
            <rect width="100%" height="100%" fill="white" />
            <circle cx="134.167" cy="106.286" fill="black" r="80.5" />
          </mask>
          <clipPath id="stem-clip">
            <m.rect
              x="-100"
              width="500"
              height="200"
              animate={clipControls}
              initial={{ y: state === "loading" ? 0 : 53.143 }}
            />
          </clipPath>
        </defs>

        <g mask="url(#o-gap-mask)" clipPath="url(#stem-clip)">
          <m.g
            animate={bControls}
            initial={{ x: state === "loading" ? 0 : 80.5 }}
          >
            <path
              d="M53.6667 159.429C24.0274 159.429 0 135.636 0 106.286V46.8692V0H26.8333V31.1073V60.2524C34.727 55.7308 43.8916 53.1429 53.6667 53.1429C59.9418 53.1429 65.9653 54.2093 71.5626 56.1693C65.7823 63.2408 61.1991 71.3112 58.1184 80.0783C56.6704 79.8389 55.1832 79.7143 53.6667 79.7143C38.847 79.7143 26.8333 91.6107 26.8333 106.286C26.8333 120.961 38.847 132.857 53.6667 132.857C55.1832 132.857 56.6704 132.733 58.1184 132.493C61.1991 141.26 65.7824 149.331 71.5626 156.402C65.9653 158.362 59.9418 159.429 53.6667 159.429Z"
              fill="currentColor"
            />
          </m.g>

          <m.g
            animate={dControls}
            initial={{ x: state === "loading" ? 0 : -80.5 }}
          >
            <path
              d="M214.667 159.429C244.306 159.429 268.333 135.636 268.333 106.286V46.8692V0H241.5V31.1073V60.2524C233.606 55.7308 224.442 53.1429 214.667 53.1429C208.392 53.1429 202.368 54.2094 196.771 56.1693C202.551 63.2408 207.134 71.3112 210.215 80.0783C211.663 79.8389 213.15 79.7143 214.667 79.7143C229.486 79.7143 241.5 91.6107 241.5 106.286C241.5 120.961 229.486 132.857 214.667 132.857C213.15 132.857 211.663 132.733 210.215 132.493C207.134 141.26 202.551 149.331 196.771 156.402C202.368 158.362 208.392 159.429 214.667 159.429Z"
              fill="currentColor"
            />
          </m.g>
        </g>

        <g stroke="currentColor" strokeWidth="26.833" strokeLinecap="butt">
          <g transform="rotate(-90 134.167 106.286)">
            <m.circle
              cx="134.167"
              cy="106.286"
              r="40.25"
              animate={oControls}
              initial={{ pathLength: state === "loading" ? 0.5 : 0 }}
            />
          </g>

          <g transform="translate(268.334 0) scale(-1 1)">
            <g transform="rotate(-90 134.167 106.286)">
              <m.circle
                cx="134.167"
                cy="106.286"
                r="40.25"
                animate={oControls}
                initial={{ pathLength: state === "loading" ? 0.5 : 0 }}
              />
            </g>
          </g>
        </g>
      </svg>
    </LazyMotion>
  );
}
