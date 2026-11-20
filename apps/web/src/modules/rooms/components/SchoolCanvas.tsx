"use client";

import type { RoomsRead } from "@bod/api-client/types.gen";
import type { SchoolPlan } from "../school-plan";
import type { SchoolAreaTarget } from "./SchoolAreaDialog";

import {
  Building2,
  GripHorizontal,
  LayoutGrid,
  Maximize2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/core/ui/actions/Button";

import { displayCost, roomCount } from "../connections";
import { SchoolRoomChip } from "./SchoolRoomChip";

export function SchoolCanvas({
  plan,
  rooms,
  selected,
  search,
  disabled,
  onSelect,
  onMove,
  onChange,
  onEdit,
  onRemove,
}: {
  plan: SchoolPlan;
  rooms: RoomsRead[];
  selected: string[];
  search: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onMove: (floorId: string | null, draggedId?: string) => void;
  onChange: (plan: SchoolPlan) => void;
  onEdit: (target: SchoolAreaTarget) => void;
  onRemove: (buildingId: string, floorId?: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{
    pointer: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const hintId = useId();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const viewport = useRef<HTMLElement>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const drag = useRef<{ id: string; x: number; y: number; startX: number; startY: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const measure = () => {
      const next = Object.fromEntries(
        [...elements.current].map(([id, element]) => [
          id,
          element.getBoundingClientRect().height / zoom,
        ]),
      );
      setHeights((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    const observer = new ResizeObserver(measure);
    for (const building of plan.buildings) {
      const node = elements.current.get(building.id);
      if (node) observer.observe(node);
    }
    measure();
    return () => observer.disconnect();
  }, [plan.buildings, zoom]);
  useEffect(() => {
    if (!search.trim()) return;
    const matched = rooms.filter((room) =>
      `${room.code} ${room.name ?? ""}`
        .toLocaleLowerCase("cs")
        .includes(search.toLocaleLowerCase("cs")),
    );
    if (matched.length !== 1) return;
    const building = plan.buildings.find((item) =>
      item.floors.some((floor) => floor.roomIds.includes(matched[0]?.id ?? "")),
    );
    if (building && viewport.current)
      setPan({
        x: viewport.current.clientWidth / 2 - (building.x + 140) * zoom,
        y:
          viewport.current.clientHeight / 2 -
          (building.y + (heights[building.id] ?? 250) / 2) * zoom,
      });
  }, [search, rooms, plan.buildings, zoom, heights]);
  const buildings = plan.buildings.map((item) =>
    preview?.id === item.id ? { ...item, x: preview.x, y: preview.y } : item,
  );
  const width = Math.max(700, ...buildings.map((item) => item.x + 320));
  const height = Math.max(
    430,
    ...buildings.map((item) => {
      const measured = heights[item.id];
      return item.y + (typeof measured === "number" ? measured : 300) + 40;
    }),
  );
  const byId = new Map(rooms.map((room) => [room.id, room]));
  return (
    <div className="school-canvas-shell">
      <div className="school-canvas-controls page-actions">
        <span>Schéma školy</span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Oddálit plán"
          disabled={zoom <= 0.5}
          onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
        >
          −
        </Button>
        <span>{Math.round(zoom * 100)} %</span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Přiblížit plán"
          disabled={zoom >= 1.5}
          onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const scale = Math.max(
              0.1,
              Math.min(
                1,
                (viewport.current?.clientWidth ?? width) / width,
                (viewport.current?.clientHeight ?? height) / height,
              ),
            );
            setZoom(scale);
            viewport.current?.scrollTo({ top: 0, left: 0 });
            setPan({
              x: ((viewport.current?.clientWidth ?? width) - width * scale) / 2,
              y: ((viewport.current?.clientHeight ?? height) - height * scale) / 2,
            });
          }}
        >
          <Maximize2 size={14} /> Celý plán
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || !plan.buildings.length}
          aria-label="Uspořádat budovy"
          title="Uspořádat budovy"
          onClick={() =>
            onChange({
              ...plan,
              buildings: plan.buildings.map((item, index) => ({
                ...item,
                x: 24 + (index % 3) * 350,
                y: Math.min(
                  20000,
                  100 + Math.floor(index / 3) * (Math.max(250, ...Object.values(heights)) + 160),
                ),
              })),
            })
          }
        >
          <LayoutGrid size={16} />
        </Button>
      </div>
      <section
        className="school-canvas-viewport"
        ref={viewport}
        aria-label="Posouvatelný plán školy"
        aria-describedby={hintId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Arrow keys pan the canvas without a mouse.
        tabIndex={0}
        data-panning={panning}
        onPointerDown={(event) => {
          if (event.button !== 0 && event.button !== 1) return;
          if (
            event.button === 0 &&
            (event.target as Element).closest(".school-building, button, input")
          )
            return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          panStart.current = {
            pointer: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: pan.x,
            top: pan.y,
          };
          setPanning(true);
        }}
        onPointerMove={(event) => {
          const start = panStart.current;
          if (start?.pointer === event.pointerId)
            setPan({
              x: start.left + event.clientX - start.x,
              y: start.top + event.clientY - start.y,
            });
        }}
        onLostPointerCapture={() => {
          panStart.current = null;
          setPanning(false);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const delta: Record<string, [number, number]> = {
            ArrowLeft: [60, 0],
            ArrowRight: [-60, 0],
            ArrowUp: [0, 60],
            ArrowDown: [0, -60],
          };
          const movement = delta[event.key];
          if (!movement) return;
          event.preventDefault();
          setPan((previous) => ({ x: previous.x + movement[0], y: previous.y + movement[1] }));
        }}
      >
        <div
          className="school-canvas-world"
          style={{ width, height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg
            className="school-canvas-lines"
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
          >
            {buildings.flatMap((from, index) =>
              buildings.slice(index + 1).map((to) => {
                const x1 = from.x + 140,
                  x2 = to.x + 140,
                  top = Math.min(from.y, to.y) - 60;
                return (
                  <path
                    key={`${from.id}/${to.id}`}
                    d={`M ${x1} ${from.y} C ${x1} ${top}, ${x2} ${top}, ${x2} ${to.y}`}
                  />
                );
              }),
            )}
          </svg>
          {buildings.flatMap((from, index) =>
            buildings.slice(index + 1).map((to) => {
              const link = plan.links.find(
                (item) =>
                  [item.from, item.to].sort().join("/") === [from.id, to.id].sort().join("/"),
              );
              const cost = link?.cost ?? plan.betweenBuildings;
              return (
                <Button
                  key={`${from.id}/${to.id}`}
                  size="sm"
                  variant="choice"
                  className="school-canvas-link"
                  style={{
                    left: (from.x + to.x) / 2 + 140,
                    top: 0.125 * (from.y + to.y) + 0.75 * (Math.min(from.y, to.y) - 60),
                  }}
                  disabled={disabled}
                  aria-label={`Přesun ${from.name} ↔ ${to.name}, náročnost ${displayCost(cost)}`}
                  onClick={() => onEdit({ kind: "link", from: from.id, to: to.id })}
                >
                  ↔ {displayCost(cost)} <Pencil size={12} />
                </Button>
              );
            }),
          )}
          {buildings.map((building) => (
            <section
              key={building.id}
              ref={(element) => {
                if (element) elements.current.set(building.id, element);
                else elements.current.delete(building.id);
              }}
              className="school-building"
              style={{ left: building.x, top: building.y }}
              aria-label={`Budova ${building.name}`}
            >
              <header>
                <Button
                  variant="ghost"
                  size="sm"
                  className="school-building-handle"
                  disabled={disabled}
                  aria-label={`Přesunout budovu ${building.name}`}
                  onKeyDown={(event) => {
                    const delta: Record<string, [number, number]> = {
                      ArrowLeft: [-20, 0],
                      ArrowRight: [20, 0],
                      ArrowUp: [0, -20],
                      ArrowDown: [0, 20],
                    };
                    const movement = delta[event.key];
                    if (!movement) return;
                    event.preventDefault();
                    onChange({
                      ...plan,
                      buildings: plan.buildings.map((item) =>
                        item.id === building.id
                          ? {
                              ...item,
                              x: Math.max(24, item.x + movement[0]),
                              y: Math.max(100, item.y + movement[1]),
                            }
                          : item,
                      ),
                    });
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drag.current = {
                      id: building.id,
                      x: building.x,
                      y: building.y,
                      startX: event.clientX,
                      startY: event.clientY,
                    };
                  }}
                  onPointerMove={(event) => {
                    const item = drag.current;
                    if (item?.id === building.id)
                      setPreview({
                        id: item.id,
                        x: Math.max(24, item.x + (event.clientX - item.startX) / zoom),
                        y: Math.max(100, item.y + (event.clientY - item.startY) / zoom),
                      });
                  }}
                  onPointerUp={() => {
                    const item = preview;
                    if (item?.id === building.id)
                      onChange({
                        ...plan,
                        buildings: plan.buildings.map((building) =>
                          building.id === item.id
                            ? { ...building, x: item.x, y: item.y }
                            : building,
                        ),
                      });
                    drag.current = null;
                    setPreview(null);
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                    setPreview(null);
                  }}
                >
                  <GripHorizontal size={16} />
                </Button>
                <Building2 size={18} aria-hidden="true" />
                <h4>{building.name}</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Upravit budovu ${building.name}`}
                  onClick={() => onEdit({ kind: "building", id: building.id })}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Odstranit budovu ${building.name}`}
                  onClick={() => onRemove(building.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </header>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onEdit({ kind: "building", id: building.id })}
              >
                Mezi patry v budově{" "}
                <strong className="school-cost-value">{displayCost(building.betweenFloors)}</strong>
              </Button>
              <div className="school-floors">
                {[...building.floors].reverse().map((floor) => (
                  <section
                    key={floor.id}
                    className="school-floor"
                    aria-label={`${building.name} · ${floor.name}`}
                    onDragOver={(event) => {
                      if (
                        !disabled &&
                        event.dataTransfer.types.includes("application/x-bod-school-room")
                      ) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const id = event.dataTransfer.getData("application/x-bod-school-room");
                      if (byId.has(id)) onMove(floor.id, id);
                    }}
                  >
                    <div className="school-floor-heading">
                      <Button
                        variant="ghost"
                        size="sm"
                        contentClassName="school-floor-title"
                        disabled={disabled}
                        onClick={() =>
                          onEdit({ kind: "floor", buildingId: building.id, id: floor.id })
                        }
                      >
                        <span>{floor.name}</span>
                        <small>Mezi učebnami · {displayCost(floor.cost)}</small>
                      </Button>
                      <span className="school-floor-count">
                        <span aria-hidden="true">{floor.roomIds.length} uč.</span>
                        <span className="sr-only">{roomCount(floor.roomIds.length)}</span>
                      </span>
                      {building.floors.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          aria-label={`Odstranit patro ${floor.name} v budově ${building.name}`}
                          onClick={() => onRemove(building.id, floor.id)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>
                    <div className="school-room-chips">
                      {(search
                        ? floor.roomIds.filter((id) => {
                            const room = byId.get(id);
                            return (
                              room &&
                              `${room.code} ${room.name ?? ""}`
                                .toLocaleLowerCase("cs")
                                .includes(search.toLocaleLowerCase("cs"))
                            );
                          })
                        : expanded.has(floor.id)
                          ? floor.roomIds
                          : floor.roomIds.slice(0, 12)
                      ).map((id) => {
                        const room = byId.get(id);
                        return room ? (
                          <SchoolRoomChip
                            key={id}
                            room={room}
                            selected={selected.includes(id)}
                            muted={
                              !!search &&
                              !`${room.code} ${room.name ?? ""}`
                                .toLocaleLowerCase("cs")
                                .includes(search.toLocaleLowerCase("cs"))
                            }
                            disabled={disabled}
                            onSelect={() => onSelect(id)}
                          />
                        ) : null;
                      })}
                    </div>
                    {!search && floor.roomIds.length > 12 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpanded((previous) => {
                            const next = new Set(previous);
                            if (next.has(floor.id)) next.delete(floor.id);
                            else next.add(floor.id);
                            return next;
                          })
                        }
                      >
                        {expanded.has(floor.id)
                          ? "Zobrazit méně"
                          : `Dalších ${floor.roomIds.length - 12} učeben`}
                      </Button>
                    )}
                    {!floor.roomIds.length && <p>Sem přetáhněte učebny</p>}
                    {selected.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={disabled || !selected.length}
                        onClick={() => onMove(floor.id)}
                      >
                        Umístit vybrané ({selected.length})
                      </Button>
                    )}
                  </section>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="school-add-floor"
                disabled={disabled || building.floors.length >= 25}
                onClick={() => onEdit({ kind: "floor", buildingId: building.id })}
              >
                <Plus size={14} /> Přidat patro
              </Button>
            </section>
          ))}
        </div>
        {!buildings.length && (
          <div className="school-canvas-empty">
            <div className="school-canvas-empty-icon">
              <Building2 size={40} />
            </div>
            <h4>Začněte jednou budovou</h4>
            <p>Potom přidejte patra a rozmístěte do nich učebny.</p>
            <Button disabled={disabled} onClick={() => onEdit({ kind: "building" })}>
              <Plus size={16} /> Přidat první budovu
            </Button>
          </div>
        )}
      </section>
      <p id={hintId} className="text-xs text-(--color-muted-foreground)">
        Tažením posunete plán. Budovu přesunete za úchyt.
      </p>
    </div>
  );
}
