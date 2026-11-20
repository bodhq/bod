// Language for people working at school. API resource names stay internal.
export const resourceCopy: Record<
  string,
  { createLabel: string; description?: string; emptyTitle?: string }
> = {
  school_years: {
    createLabel: "Nový školní rok",
    description: "Nastavte začátek a konec výuky pro jednotlivé školní roky.",
  },
  specializations: { createLabel: "Nové zaměření" },
  study_fields: { createLabel: "Nový obor studia" },
  group_study_field_rules: { createLabel: "Přidat obor" },
  buildings: { createLabel: "Nová budova", description: "Sdílené budovy a patra školy." },
  building_floors: { createLabel: "Nové patro" },
  classes: { createLabel: "Nová třída", description: "Otevřete třídu a přidejte do ní žáky." },
  class_enrollments: { createLabel: "Přidat žáka", emptyTitle: "Ve třídě zatím nejsou žádní žáci" },
  parent_students: { createLabel: "Přiřadit rodiče" },
  subjects: { createLabel: "Nový předmět", description: "Předměty, které se ve škole vyučují." },
  group_divisions: {
    createLabel: "Rozdělit třídu",
    description: "Rozdělte žáky třídy pro výuku v menších skupinách.",
  },
  teaching_groups: {
    createLabel: "Nová skupina",
    description: "Skupiny žáků, které mají společnou výuku.",
  },
  teaching_group_memberships: { createLabel: "Přidat žáka do skupiny" },
  group_specialization_rules: { createLabel: "Přidat zaměření" },
  rooms: {
    createLabel: "Nová učebna",
    description: "Vyberte učebnu a upravte její dostupnost nebo kmenové skupiny.",
  },
  room_types: {
    createLabel: "Nový typ učebny",
    description: "Rozlište například běžné učebny, laboratoře a tělocvičny.",
  },
  group_home_rooms: { createLabel: "Přiřadit skupinu" },
  room_distance_models: { createLabel: "Nový model přesunů" },
  room_connections: { createLabel: "Propojit učebny" },
  room_unavailability: {
    createLabel: "Přidat nedostupnost",
    emptyTitle: "Učebna nemá žádná omezení dostupnosti",
  },
  teaching_plans: {
    createLabel: "Nový plán výuky",
    description: "Připravte výuku pro školní rok. Jeden plán může mít více návrhů rozvrhu.",
  },
  teaching_assignments: { createLabel: "Přiřadit výuku" },
  teaching_cycle_weeks: {
    createLabel: "Nový typ týdne",
    description:
      "Pojmenujte týdny, které se při výuce střídají. Pro běžný rozvrh stačí jeden týden.",
  },
  teaching_cycle_steps: {
    createLabel: "Přidat krok cyklu",
    description: "Určete, v jakém pořadí se týdny opakují.",
  },
  teaching_plan_calendar_days: { createLabel: "Upravit den výuky" },
  teaching_plan_calendar_weeks: { createLabel: "Nastavit týden výuky" },
  teaching_assignment_weeks: { createLabel: "Nastavit počet hodin" },
  teaching_blocks: { createLabel: "Nový společný blok" },
  teaching_block_members: { createLabel: "Přidat výuku do bloku" },
  teacher_unavailability: {
    createLabel: "Přidat nepřítomnost",
    description: "Časy, kdy vyučující nemůže mít naplánovanou hodinu.",
  },
  time_grids: { createLabel: "Nové zvonění" },
  time_slots: { createLabel: "Přidat vyučovací hodinu" },
  timetable_versions: { createLabel: "Nový návrh rozvrhu" },
  timetable_entries: { createLabel: "Umístit hodinu" },
  timetable_preferences: { createLabel: "Přidat požadavek na rozvrh" },
  lesson_occurrences: { createLabel: "Přidat konkrétní hodinu" },
  lesson_changes: { createLabel: "Změnit hodinu" },
  classbook_entries: { createLabel: "Zapsat výuku" },
  classbook_participants: { createLabel: "Přidat žáka do hodiny" },
  attendance_records: {
    createLabel: "Zapsat docházku",
    description: "Zkontrolujte přítomnost, zpoždění a absence žáků.",
  },
  absence_excuse_requests: {
    createLabel: "Nová omluvenka",
    description: "Otevřete omluvenku a vyřiďte jednotlivé absence.",
  },
  absence_excuse_items: { createLabel: "Přidat absenci do omluvenky" },
};
