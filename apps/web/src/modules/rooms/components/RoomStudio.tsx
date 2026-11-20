"use client";
import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { PanelHeader } from "@/core/ui/layout/Panel";
import { StepProgress } from "@/core/ui/navigation/StepProgress";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { Distribution } from "@/core/ui/visuals/Quantity";
import { request, resourcePath } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { rowLabel } from "@/modules/shared/records/format";

import { useRoomStudio } from "../hooks/useRoomStudio";
import { RoomDetails } from "./RoomDetails";
import { RoomEditor } from "./RoomEditor";
import { RoomList } from "./RoomList";
import { RoomTypes } from "./RoomTypes";

export function RoomStudio() {
  const studio = useRoomStudio();
  const [typesOpen, setTypesOpen] = useState(false);
  const {
    getResource,
    refresh,
    queries,
    rooms,
    types,
    search,
    setSearch,
    type,
    setType,
    capacity,
    setCapacity,
    setSelectedId,
    editor,
    setEditor,
    typeOpen,
    setTypeOpen,
    selected,
    visible,
  } = studio;
  if (queries.some((query) => query.isLoading))
    return <LoadingState>Připravuji přehled učeben…</LoadingState>;
  if (queries.some((query) => query.isError))
    return (
      <ErrorState
        title="Učebny se nepodařilo načíst"
        error={queries.find((query) => query.isError)?.error}
        action={
          <Button
            variant="outline"
            onClick={() => Promise.all(queries.map((query) => query.refetch()))}
          >
            Zkusit znovu
          </Button>
        }
      />
    );
  return (
    <section className="ui-stack">
      {selected ? (
        <>
          <Button variant="outline" className="self-start" onClick={() => setSelectedId("")}>
            ← Zpět na učebny
          </Button>
          <RoomDetails model={studio} />
        </>
      ) : (
        <>
          <PanelHeader
            title="Přehled učeben"
            actions={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setTypesOpen(true)}>
                  Typy učeben
                </Button>
                {types.length > 0 && <Button onClick={() => setEditor({})}>Nová učebna</Button>}
              </div>
            }
          />
          {rooms.length > 0 && (
            <details className="visual-room-summary">
              <summary className="cursor-pointer text-sm">
                <strong>{rooms.length} učeben</strong> ·{" "}
                {rooms.filter((row) => row.is_active !== false).length} aktivních ·{" "}
                {rooms.reduce((sum, row) => sum + Number(row.capacity ?? 0), 0)} míst celkem{" "}
                <span className="text-(--color-muted-foreground)"> · Rozložení prostorů</span>
              </summary>
              <div className="mt-4">
                <Distribution
                  label="Počet učeben podle typu"
                  items={types.map((row) => ({
                    id: String(row.code),
                    label: rowLabel(row),
                    value: rooms.filter((room) => room.room_type_code === row.code).length,
                  }))}
                />
              </div>
            </details>
          )}
          {rooms.length > 0 && (
            <div className="visual-room-filters">
              <Input
                label="Najít učebnu"
                placeholder="Název nebo číslo…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                label="Typ prostoru"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">Všechny typy</option>
                {types.map((row) => (
                  <option key={String(row.code)} value={String(row.code)}>
                    {rowLabel(row)}
                  </option>
                ))}
              </Select>
              <Select
                label="Kapacita alespoň"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              >
                {[0, 12, 16, 24, 30, 40].map((size) => (
                  <option key={size} value={String(size)}>
                    {size ? `${size} míst` : "Libovolná"}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <RoomList model={studio} />
          {!rooms.length && (
            <div className="ui-stack">
              <StepProgress
                steps={["Typ prostoru", "První učebna", "Přesuny"]}
                current={types.length ? 1 : 0}
              />
              <EmptyState
                title={types.length ? "Přidejte první učebnu" : "Začněte typem prostoru"}
                description={
                  types.length
                    ? "Zadejte konkrétní místnost, její typ a počet míst."
                    : "Typ popisuje využití, například běžná učebna nebo laboratoř. Pak do něj zařadíte konkrétní místnosti."
                }
                action={
                  <Button onClick={() => (types.length ? setEditor({}) : setTypeOpen({}))}>
                    {types.length ? "Přidat učebnu" : "Přidat první typ"}
                  </Button>
                }
              />
            </div>
          )}
          {rooms.length > 0 && !visible.length && (
            <EmptyState title="Tomuto výběru neodpovídá žádná učebna">
              Upravte typ nebo požadovanou kapacitu.
            </EmptyState>
          )}
        </>
      )}
      <Dialog
        open={typesOpen}
        title="Typy učeben"
        description="Společné označení pro místnosti se stejným využitím. Úprava typu se projeví u všech jeho učeben."
        onClose={() => setTypesOpen(false)}
      >
        <div className="ui-stack mt-5">
          <Button className="self-start" onClick={() => setTypeOpen({})}>
            Nový typ učebny
          </Button>
          <RoomTypes model={studio} />
          <Button variant="outline" className="self-end" onClick={() => setTypesOpen(false)}>
            Hotovo
          </Button>
        </div>
      </Dialog>
      {editor && (
        <RoomEditor
          key={String(editor.row?.id ?? "new")}
          initial={editor.row}
          types={types}
          onClose={() => setEditor(null)}
          onSave={async (values) => {
            const resource = getResource("rooms");
            if (editor.row && resource.parsePatch)
              await request("PATCH", resourcePath(resource, editor.row), {
                body: resource.parsePatch(values),
              });
            else await request("POST", resource.path, { body: resource.parseCreate(values) });
            await refresh();
            setEditor(null);
          }}
        />
      )}
      {typeOpen && (
        <RecordDialog
          title={typeOpen.row ? "Upravit typ učebny" : "Nový typ učebny"}
          editing={!!typeOpen.row}
          initial={typeOpen.row ?? {}}
          fields={getResource("room_types").fields.filter(
            (field) => !typeOpen.row || field.name !== "code",
          )}
          onClose={() => setTypeOpen(null)}
          onSave={async (body) => {
            const resource = getResource("room_types");
            if (typeOpen.row && resource.parsePatch)
              await request("PATCH", resourcePath(resource, typeOpen.row), {
                body: resource.parsePatch(body),
              });
            else await request("POST", resource.path, { body: resource.parseCreate(body) });
            await refresh();
            setTypeOpen(null);
          }}
        />
      )}
    </section>
  );
}
