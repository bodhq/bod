"use client";

import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";

import { accentOptions } from "@/core/appearance/accents";
import { useAppearanceStore } from "@/core/appearance/preferences";
import { Button } from "@/core/ui/actions/Button";
import { Select } from "@/core/ui/forms/Select";
import { SwitchField } from "@/core/ui/forms/Switch";
import { PageHeader, Section } from "@/core/ui/layout/Page";

import "../account.css";

const themes = [
  { value: "light", label: "Světlý", icon: Sun },
  { value: "dark", label: "Tmavý", icon: Moon },
  { value: "system", label: "Podle systému", icon: Monitor },
];

export default function AppearanceView() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useAppearanceStore();
  const id = useId();
  return (
    <section className="account-settings">
      <PageHeader
        title="Vzhled a přístupnost"
        description="Nastavte si prostředí, ve kterém se vám dobře pracuje. Volby se ukládají v tomto prohlížeči."
        actions={
          <Button
            variant="ghost"
            onClick={() => {
              state.reset();
              setTheme("system");
            }}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Obnovit výchozí
          </Button>
        }
      />
      <div>
        <Section
          title="Barevný motiv"
          description="Vyberte si světlé, tmavé nebo automatické prostředí."
        >
          <div className="theme-options">
            {themes.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant="choice"
                aria-pressed={mounted ? theme === value : undefined}
                disabled={!mounted}
                onClick={() => setTheme(value)}
                className="theme-option"
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
                {mounted && theme === value && <Check size={15} aria-hidden="true" />}
              </Button>
            ))}
          </div>
        </Section>
        <Section
          title="Akcentní barva"
          description="Zvýrazní hlavní akce a aktivní ovládací prvky."
        >
          <div className="accent-options">
            {accentOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="accent-option"
                aria-label={`Vybrat barvu: ${label}`}
                aria-pressed={state.accentColor === value}
                onClick={() => state.setAccentColor(value)}
              >
                <span style={{ backgroundColor: `var(--swatch-${value})` }}>
                  {state.accentColor === value && <Check size={16} aria-hidden="true" />}
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section
          title="Rozložení"
          description="Hustota upraví rozestupy, výšku formulářů i navigaci."
        >
          <div className="account-form-grid">
            <Select
              label="Hustota rozhraní"
              value={state.density}
              onChange={(event) => state.setDensity(event.target.value)}
            >
              <option value="compact">Kompaktní</option>
              <option value="standard">Standardní</option>
              <option value="relaxed">Prostorné</option>
            </Select>
            <Select
              label="Šířka obsahu"
              value={state.contentWidth}
              onChange={(event) => state.setContentWidth(event.target.value)}
            >
              <option value="wide">Celá pracovní plocha</option>
              <option value="focused">Soustředěné zobrazení</option>
            </Select>
          </div>
          <SwitchField
            id={`${id}-sidebar`}
            label="Zúžená navigace"
            description="Na větší obrazovce zobrazí jen ikony agend."
            checked={state.sidebarCollapsed}
            onChange={state.setSidebarCollapsed}
          />
          <SwitchField
            id={`${id}-rows`}
            label="Vodicí pruhy v tabulkách"
            description="Usnadní sledování delších řádků."
            checked={state.stripedRows}
            onChange={state.setStripedRows}
          />
        </Section>
        <Section title="Písmo" description="Přizpůsobte čitelnost textu a podobu písma.">
          <div className="account-form-grid">
            <Select
              label="Velikost textu"
              value={state.textSize}
              onChange={(event) => state.setTextSize(event.target.value)}
            >
              <option value="sm">Menší</option>
              <option value="md">Výchozí</option>
              <option value="lg">Větší</option>
            </Select>
            <Select
              label="Rodina písma"
              value={state.fontFamily}
              onChange={(event) => state.setFontFamily(event.target.value)}
            >
              <option value="brand">Jakarta</option>
              <option value="system">Systémové písmo</option>
            </Select>
          </div>
        </Section>
        <Section
          title="Tvar prvků"
          description="Stejné zaoblení použijí tlačítka, formuláře i panely."
        >
          <Select
            label="Zaoblení"
            fieldWidth="standard"
            value={state.corners}
            onChange={(event) => state.setCorners(event.target.value)}
          >
            <option value="subtle">Jemné</option>
            <option value="soft">Standardní</option>
            <option value="round">Výrazné</option>
          </Select>
        </Section>
        <Section
          title="Přístupnost"
          description="Upravte pohyb a zvýraznění rozhraní podle svých potřeb."
        >
          <SwitchField
            id={`${id}-motion`}
            label="Omezit animace"
            description="Zkrátí pohybové přechody. Respektuje se také nastavení vašeho systému."
            checked={state.reduceMotion}
            onChange={state.setReduceMotion}
          />
          <SwitchField
            id={`${id}-contrast`}
            label="Vyšší kontrast"
            description="Zvýrazní text a hranice ovládacích prvků."
            checked={state.highContrast}
            onChange={state.setHighContrast}
          />
        </Section>
      </div>
    </section>
  );
}
