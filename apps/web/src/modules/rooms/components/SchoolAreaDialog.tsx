"use client";

import type { SchoolPlan } from "../school-plan";

import { ArrowLeftRight, Building2, DoorOpen, Layers } from "lucide-react";
import { useState } from "react";

import { useUnsavedChanges } from "@/core/hooks/useUnsavedChanges";
import { Button } from "@/core/ui/actions/Button";
import { Input } from "@/core/ui/forms/Input";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { Dialog } from "@/core/ui/overlays/Dialog";

import { relativeCost } from "../connections";
import { TransferCostField } from "./TransferCostField";

export type SchoolAreaTarget =
  | { kind: "building"; id?: string }
  | { kind: "floor"; buildingId: string; id?: string }
  | { kind: "betweenBuildings" }
  | { kind: "link"; from: string; to: string };

export function SchoolAreaDialog({
  plan,
  target,
  onSave,
  onClose,
}: {
  plan: SchoolPlan;
  target: SchoolAreaTarget;
  onSave: (plan: SchoolPlan) => void;
  onClose: () => void;
}) {
  const building =
    "buildingId" in target
      ? plan.buildings.find((item) => item.id === target.buildingId)
      : target.kind === "building"
        ? plan.buildings.find((item) => item.id === target.id)
        : undefined;
  const floor =
    target.kind === "floor" ? building?.floors.find((item) => item.id === target.id) : undefined;
  const link =
    target.kind === "link"
      ? plan.links.find(
          (item) =>
            [item.from, item.to].sort().join("/") === [target.from, target.to].sort().join("/"),
        )
      : undefined;
  const initialName = target.kind === "floor" ? (floor?.name ?? "") : (building?.name ?? "");
  const initialCost =
    target.kind === "floor"
      ? (floor?.cost ?? "1")
      : target.kind === "building"
        ? (building?.betweenFloors ?? "3")
        : (link?.cost ?? plan.betweenBuildings);
  const [name, setName] = useState(initialName);
  const [value, setValue] = useState(initialCost);
  const confirm = useConfirm();
  const dirty = name !== initialName || value !== initialCost;
  useUnsavedChanges(dirty);
  const close = () =>
    dirty
      ? confirm({
          title: "Zahodit úpravu oblasti?",
          description: "Změna ještě není použitá v plánu.",
          confirmLabel: "Zahodit úpravu",
          onConfirm: onClose,
        })
      : onClose();
  const named = target.kind === "building" || target.kind === "floor";
  let valid = true;
  try {
    relativeCost(value);
  } catch {
    valid = false;
  }
  const title =
    target.kind === "building"
      ? target.id
        ? "Upravit budovu"
        : "Přidat budovu"
      : target.kind === "floor"
        ? target.id
          ? "Upravit patro"
          : "Přidat patro"
        : "Přesun mezi budovami";
  return (
    <Dialog open title={title} onClose={close} className="school-area-dialog">
      <form
        className="ui-stack mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!valid || (named && !name.trim())) return;
          const cost = relativeCost(value);
          let next = plan;
          if (target.kind === "building") {
            const id = target.id ?? crypto.randomUUID();
            const created = {
              id,
              name: name.trim(),
              x: 24 + plan.buildings.length * 350,
              y: 140,
              betweenFloors: cost,
              floors: [
                { id: crypto.randomUUID(), name: "Přízemí", cost: "1", roomIds: [] as string[] },
              ],
            };
            next = {
              ...plan,
              buildings: target.id
                ? plan.buildings.map((item) =>
                    item.id === id ? { ...item, name: name.trim(), betweenFloors: cost } : item,
                  )
                : [...plan.buildings, created],
            };
          } else if (target.kind === "floor") {
            const id = target.id ?? crypto.randomUUID();
            next = {
              ...plan,
              buildings: plan.buildings.map((item) =>
                item.id === target.buildingId
                  ? {
                      ...item,
                      floors: target.id
                        ? item.floors.map((floor) =>
                            floor.id === id ? { ...floor, name: name.trim(), cost } : floor,
                          )
                        : [...item.floors, { id, name: name.trim(), cost, roomIds: [] }],
                    }
                  : item,
              ),
            };
          } else if (target.kind === "betweenBuildings") next = { ...plan, betweenBuildings: cost };
          else
            next = {
              ...plan,
              links: [
                ...plan.links.filter(
                  (item) =>
                    [item.from, item.to].sort().join("/") !==
                    [target.from, target.to].sort().join("/"),
                ),
                { from: target.from, to: target.to, cost },
              ],
            };
          onSave(next);
          onClose();
        }}
      >
        {named && (
          <Input
            label={target.kind === "building" ? "Název budovy" : "Název patra"}
            placeholder={target.kind === "building" ? "Např. Hlavní budova" : "Např. 1. patro"}
            value={name}
            required
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        )}
        {target.kind === "link" && (
          <p className="font-semibold">
            {plan.buildings.find((item) => item.id === target.from)?.name} ↔{" "}
            {plan.buildings.find((item) => item.id === target.to)?.name}
          </p>
        )}
        <p className="ui-eyebrow">
          {target.kind === "floor"
            ? `Škola / ${building?.name} / ${name.trim() || "Nové patro"}`
            : target.kind === "building"
              ? `Škola / ${name.trim() || "Nová budova"}`
              : target.kind === "link"
                ? "Výjimka mezi dvěma budovami"
                : "Celá škola · výchozí pravidlo"}
        </p>
        <div className="school-rule-example" aria-hidden="true">
          <span>
            {target.kind === "floor" ? (
              <DoorOpen size={24} />
            ) : target.kind === "building" ? (
              <Layers size={24} />
            ) : (
              <Building2 size={24} />
            )}
            {target.kind === "floor" ? "Učebna" : target.kind === "building" ? "Patro" : "Budova"}
          </span>
          <ArrowLeftRight size={20} />
          <span>
            {target.kind === "floor" ? (
              <DoorOpen size={24} />
            ) : target.kind === "building" ? (
              <Layers size={24} />
            ) : (
              <Building2 size={24} />
            )}
            {target.kind === "floor" ? "Učebna" : target.kind === "building" ? "Patro" : "Budova"}
          </span>
        </div>
        <TransferCostField
          label={
            target.kind === "floor"
              ? "Mezi učebnami na tomto patře"
              : target.kind === "building"
                ? "Mezi patry této budovy"
                : target.kind === "link"
                  ? "Mezi těmito dvěma budovami"
                  : "Mezi budovami školy"
          }
          description={
            target.kind === "floor"
              ? "Platí pro přesun mezi kterýmikoli dvěma učebnami na tomto patře."
              : target.kind === "building"
                ? "Platí pro přesun mezi učebnami na různých patrech této budovy."
                : target.kind === "link"
                  ? "Platí v obou směrech pro učebny těchto dvou budov. Má přednost před školním pravidlem."
                  : "Platí v obou směrech mezi všemi budovami. Konkrétní spojení budov nebo jednotlivých učeben můžete upravit jako výjimku."
          }
          value={value}
          onChange={setValue}
        />
        <div className="page-actions justify-end">
          <Button variant="outline" onClick={close}>
            Zrušit
          </Button>
          <Button type="submit" disabled={!valid || (named && !name.trim())}>
            {named && !("id" in target && target.id) ? "Přidat do plánu" : "Použít pravidlo"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
