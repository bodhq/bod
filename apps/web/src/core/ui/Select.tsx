"use client";

import { AnimatePresence, m } from "framer-motion";
import { Check, ChevronDown, type LucideIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/core/ui/Button";
import { cn } from "@/core/utils";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  icon?: LucideIcon;
  className?: string;
  allowClear?: boolean;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Vybrat...",
  icon: Icon,
  className,
  allowClear = true,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div
      className={cn("relative shrink-0", isOpen ? "z-50" : "z-30", className)}
      ref={containerRef}
    >
      <Button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        variant="secondary"
        className={cn(
          "h-11 w-full justify-start gap-2 px-3 text-left font-medium",
          value && allowClear && "pr-10",
          value ? "text-(--color-foreground)" : "text-(--color-muted-foreground)",
        )}
      >
        {Icon && <Icon size={16} className={cn(!value && "opacity-70", "shrink-0")} />}
        <span className="truncate flex-1 text-left">{selectedOption?.label ?? placeholder}</span>
        {!(value && allowClear) && (
          <ChevronDown
            size={16}
            className={cn("shrink-0 opacity-70 transition-transform", isOpen && "rotate-180")}
          />
        )}
      </Button>
      {value && allowClear && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Vymazat výběr"
          className="absolute right-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-(--color-muted-foreground) hover:bg-(--color-surface-200) hover:text-(--color-foreground)"
        >
          <X size={14} />
        </button>
      )}

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <div className="absolute top-full left-0 mt-3 min-w-52 w-max max-w-xs z-50">
            {/* 1. Independent Background Wrapper */}
            <m.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: {
                  opacity: 0,
                  scale: 0.96,
                  y: -5,
                  transition: {
                    type: "tween",
                    ease: "easeInOut",
                    duration: 0.25,
                  },
                },
                visible: {
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: { type: "spring", bounce: 0, duration: 0.3 },
                },
              }}
              className="absolute inset-0 rounded-xl border border-(--color-border) bg-(--color-surface-100)"
            />

            {/* 2. Independent List Stagger Container */}
            <m.ul
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: {
                  transition: { staggerChildren: 0.04, staggerDirection: -1 },
                },
                visible: {
                  transition: { staggerChildren: 0.05, delayChildren: 0.05 },
                },
              }}
              className="relative z-10 flex flex-col gap-1 p-1.5 max-h-72 overflow-y-auto"
            >
              {options.length === 0 ? (
                <div className="p-3 text-center text-sm text-(--color-muted-foreground)">
                  Žádné možnosti
                </div>
              ) : (
                options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <m.li
                      key={opt.value}
                      variants={{
                        hidden: {
                          opacity: 0,
                          y: -4,
                          filter: "blur(4px)",
                          transition: {
                            type: "tween",
                            ease: "easeIn",
                            duration: 0.15,
                          },
                        },
                        visible: {
                          opacity: 1,
                          y: 0,
                          filter: "blur(0px)",
                          transition: {
                            type: "tween",
                            ease: "easeOut",
                            duration: 0.25,
                          },
                        },
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onChange(opt.value);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-[calc(var(--radius)-4px)] text-sm font-medium transition-colors flex items-center justify-between",
                          isSelected
                            ? "bg-(--color-surface-200) text-(--color-foreground)"
                            : "hover:bg-(--color-surface-200) text-(--color-muted-foreground) hover:text-(--color-foreground)",
                        )}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && (
                          <Check
                            size={16}
                            className="text-(--color-primary-accessible) shrink-0 ml-2"
                          />
                        )}
                      </button>
                    </m.li>
                  );
                })
              )}
            </m.ul>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
