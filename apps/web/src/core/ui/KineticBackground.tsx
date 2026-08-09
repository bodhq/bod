"use client";

import { useId } from "react";
import { Logo } from "@/core/ui/Logo";
import { cn } from "@/core/utils";

const MarqueeRow = ({ dir }: { dir: "left" | "right" }) => {
  const rowId = useId();
  const items = Array.from({ length: 20 }, (_, i) => `${rowId}-item-${i}`);

  return (
    <div className="flex shrink-0 opacity-10 overflow-hidden py-1 h-[60px] w-max -ml-[50vw]">
      <div
        className={cn(
          "flex h-full w-max shrink-0 will-change-transform",
          dir === "left" ? "animate-marquee-left" : "animate-marquee-right",
        )}
      >
        {/* Render twice for seamless looping */}
        {[1, 2].map((set) => (
          <div key={set} className="flex shrink-0 items-center">
            {items.map((id) => (
              <Logo
                key={id}
                className="w-[100px] h-auto mx-5 shrink-0 text-black/50"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const KineticBackground = () => {
  const bgId = useId();
  const rows = Array.from({ length: 11 }, (_, i) => `${bgId}-row-${i}`);

  return (
    <div
      className="absolute inset-0 z-0 flex flex-col justify-center gap-3 pointer-events-none select-none"
      style={{
        maskImage:
          "radial-gradient(circle at center, black 30%, transparent 80%)",
        WebkitMaskImage:
          "radial-gradient(circle at center, black 30%, transparent 80%)",
        transform: "rotate(-12deg) scale(1.5)",
      }}
    >
      {rows.map((id, i) => (
        <MarqueeRow key={id} dir={i % 2 === 0 ? "left" : "right"} />
      ))}
    </div>
  );
};
