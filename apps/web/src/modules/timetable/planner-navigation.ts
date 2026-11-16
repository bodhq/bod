import { CalendarDays, Check, Copy, Layers, Settings, Users } from "lucide-react";

export const defaultPlannerStep = "plans";
export const phases = [
  { title: "Skupiny a úvazky", ids: [defaultPlannerStep, "groups", "teaching"] },
  { title: "Čas a pravidla", ids: ["cycle", "setup", "calendar"] },
  { title: "Sestavení", ids: ["versions", "preferences"] },
  { title: "Kontrola", ids: ["review"] },
];
export const preparationOrder = phases.flatMap((phase) => phase.ids);

export function plannerPhase(step: string) {
  return phases.findIndex((phase) => phase.ids.includes(step));
}

export const steps = [
  { id: "plans", title: "Pracovní plán", icon: CalendarDays },
  { id: "groups", title: "Skupiny", icon: Users },
  { id: "teaching", title: "Úvazky", icon: Users },
  { id: "versions", title: "Plátno", icon: Layers },
  { id: "cycle", title: "Cyklus a bloky", icon: Copy },
  { id: "setup", title: "Zvonění", icon: Settings },
  { id: "preferences", title: "Priority", icon: Settings },
  { id: "calendar", title: "Kalendář", icon: CalendarDays },
  { id: "review", title: "Kontrola", icon: Check },
  { id: "changes", title: "Suplování", icon: Copy },
];
export const sections: Record<string, { hint: string; ids: string[] }> = {
  groups: { hint: "Složení skupin a jejich vzájemné překryvy.", ids: [] },
  plans: {
    hint: "Založte plán pro školní rok. Potom ho vyberte a pokračujte nastavením cyklu a výuky.",
    ids: ["teaching_plans"],
  },
  cycle: {
    hint: "Nejprve pojmenujte týdny cyklu (například A a B), poté nastavte jejich pořadí a délku v krocích cyklu.",
    ids: ["teaching_cycle_weeks", "teaching_cycle_steps"],
  },
  teaching: {
    hint: "Připravte úvazky podle ŠVP: skupina, předmět a vyučující. U každého přiřazení nastavte týdenní počet hodin a případný typ učebny.",
    ids: ["teaching_assignments"],
  },
  versions: {
    hint: "Založte návrh se zvoněním a modelem vzdáleností. Vyberte návrh pro rozmístění hodin. Publikace zpřístupní rozvrh; pro další změny publikovanou verzi zkopírujte.",
    ids: ["timetable_entries"],
  },
  review: {
    hint: "Ověřte umístění hodin, překryvy skupin a učebny. Před zveřejněním server zkontroluje celý návrh.",
    ids: ["timetable_entries"],
  },
  preferences: { hint: "Priority pracovního návrhu", ids: ["timetable_preferences"] },
  setup: {
    hint: "Připravte zvonění a časová omezení. Učebny a vzdálenosti mezi nimi se spravují v modulu Učebny.",
    ids: ["time_grids", "teacher_unavailability"],
  },
  calendar: {
    hint: "Výjimky a skutečné týdny školního roku pro vybraný plán.",
    ids: ["teaching_plan_calendar_days", "teaching_plan_calendar_weeks"],
  },
  changes: {
    hint: "Otevřete konkrétní výskyt hodiny a zadejte změnu vyučujícího, učebny nebo termínu.",
    ids: ["lesson_occurrences"],
  },
};
