/**
 * VRSTVA 4: APP ROUTER (Pages)
 * Zde se definují konkrétní URL cesty (např. `/timetable`).
 * Úkolem této vrstvy je fungovat jako "lepidlo".
 *
 * Pravidlo: Zde nesmí být složitý HTML/CSS kód ani byznys logika.
 * Page.tsx pouze importuje "hloupou" komponentu z modulu (vrstva 3)
 * a dodá jí potřebná data (např. z URL parametrů).
 */

import { TimetableGrid } from "@/modules/timetable/components/TimetableGrid";

export default function TimetablePage() {
  // Příklad: V produkci bychom classId získali z URL (props.params)
  // nebo z globálního stavu přihlášeného uživatele.
  const CLASS_ID = 1;

  return (
    <main className="p-8">
      <h1 className="text-3xl text-lime-400 font-bold mb-8">
        Rozvrh Třídy {CLASS_ID}
      </h1>

      {/* Vložení komponenty s předanými parametry */}
      <TimetableGrid classId={CLASS_ID} />
    </main>
  );
}
