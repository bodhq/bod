"use client";

import { Eye, Monitor, Moon, Palette, Sun, Type, ZoomIn } from "lucide-react";
import { useTheme } from "next-themes";
import { useId } from "react";

import { useAppearanceStore } from "@/core/store/appearance";
import { Button } from "@/core/ui/Button";
import { cn } from "@/core/utils";

import { SettingsGroup } from "../components/SettingsGroup";
import { SettingsPageHeading } from "../components/SettingsPageHeading";
import { SettingsToggleRow } from "../components/SettingsToggleRow";

const ACCENT_COLORS = [
  { id: "lime", label: "Limetková" },
  { id: "cyan", label: "Azurová" },
  { id: "purple", label: "Fialová" },
  { id: "pink", label: "Růžová" },
  { id: "orange", label: "Oranžová" },
  { id: "mint", label: "Mátová" },
  { id: "yellow", label: "Žlutá" },
  { id: "neutral", label: "Neutrální" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Světlý", icon: Sun },
  { value: "dark", label: "Tmavý", icon: Moon },
  { value: "system", label: "Systém", icon: Monitor },
] as const;

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
  const formId = useId();
  const {
    accentColor,
    setAccentColor,
    textSize,
    setTextSize,
    density,
    setDensity,
    reduceMotion,
    setReduceMotion,
    highContrast,
    setHighContrast,
  } = useAppearanceStore();

  return (
    <section className="w-full max-w-2xl">
      <SettingsPageHeading
        title="Vzhled aplikace"
        description="Upravte motiv, barvy, hustotu a přístupnost aplikace."
      />

      <div className="divide-y divide-(--color-border)">
        <SettingsGroup icon={<Sun />} title="Barevný motiv">
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "secondary"}
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                className="h-auto min-h-16 flex-1 [&>.button-content]:flex-col [&>.button-content]:gap-2"
              >
                <Icon size={18} aria-hidden="true" />
                <span className="text-xs font-medium">{label}</span>
              </Button>
            ))}
          </div>
        </SettingsGroup>

        <SettingsGroup icon={<Palette />} title="Akcentní barva">
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                onClick={() => setAccentColor(color.id)}
                aria-label={`Vybrat barvu: ${color.label}`}
                aria-pressed={accentColor === color.id}
                style={{
                  backgroundColor: `var(--swatch-${color.id})`,
                  borderColor: `var(--swatch-border-${color.id})`,
                }}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:ring-offset-2",
                  accentColor === color.id
                    ? "scale-110 ring-2 ring-(--color-ring) ring-offset-2"
                    : "hover:scale-105",
                )}
              />
            ))}
          </div>
        </SettingsGroup>

        <SettingsGroup icon={<Type />} title="Velikost textu">
          <PreferenceChoices
            options={[
              ["sm", "Menší"],
              ["md", "Výchozí"],
              ["lg", "Větší"],
            ]}
            value={textSize}
            onChange={setTextSize}
          />
        </SettingsGroup>

        <SettingsGroup icon={<ZoomIn />} title="Hustota prvků">
          <PreferenceChoices
            options={[
              ["compact", "Kompaktní"],
              ["standard", "Standardní"],
              ["relaxed", "Prostorné"],
            ]}
            value={density}
            onChange={setDensity}
          />
        </SettingsGroup>

        <SettingsGroup icon={<Eye />} title="Přístupnost">
          <div className="space-y-5">
            <SettingsToggleRow
              id={`${formId}-motion`}
              label="Omezit animace"
              description="Omezí pohybové animace rozhraní."
              checked={reduceMotion}
              onChange={setReduceMotion}
            />
            <SettingsToggleRow
              id={`${formId}-contrast`}
              label="Vysoký kontrast"
              description="Zvýrazní text, hranice prvků a indikátory fokusu."
              checked={highContrast}
              onChange={setHighContrast}
            />
          </div>
        </SettingsGroup>
      </div>
    </section>
  );
}

function PreferenceChoices({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(([option, label]) => (
        <Button
          key={option}
          size="sm"
          variant={value === option ? "default" : "secondary"}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className="min-w-0 px-2"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
