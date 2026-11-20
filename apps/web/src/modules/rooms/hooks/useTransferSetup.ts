"use client";

import type { RoomDistanceModelsRead } from "@bod/api-client/types.gen";
import type { ConnectionEdit } from "../connections";
import type { useRoomTransfers } from "./useRoomTransfers";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuthStore } from "@/core/auth/store";
import { useUnsavedChanges } from "@/core/hooks/useUnsavedChanges";

import { planConnectionEdits } from "../connections";
import {
  compileSchoolPlan,
  emptySchoolPlan,
  mergeSchoolPlans,
  planLocations,
  pruneSchoolPlan,
  type SchoolPlan,
  type SchoolPlanDocument,
  schoolPlanDocumentSchema,
  schoolPlanFromLayouts,
  schoolPlanStorageKey,
} from "../school-plan";
import { assignTransferCost, projectTransfers, transferCoverage } from "../transfer-draft";

export function useTransferSetup(
  editor: ReturnType<typeof useRoomTransfers>,
  initial: RoomDistanceModelsRead | undefined,
  onComplete: () => void,
  startRoomId?: string,
) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Přesuny ve škole");
  const [originId, setOriginId] = useState(startRoomId ?? editor.rooms[0]?.id ?? "");
  const [both, setBoth] = useState(true);
  const [edits, setEdits] = useState<ConnectionEdit[]>([]);
  const [plan, setPlan] = useState<SchoolPlan>(() => schoolPlanFromLayouts(editor.buildingLayouts));
  const [baseline, setBaseline] = useState<SchoolPlan>(emptySchoolPlan);
  const [applyExisting, setApplyExisting] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [localNotice, setLocalNotice] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const writingSource = useRef(editor.connections);
  const [history, setHistory] = useState<
    {
      edits: ConnectionEdit[];
      originId: string;
      plan: SchoolPlan;
      applyExisting: boolean;
      baseline: SchoolPlan;
    }[]
  >([]);
  const savedModel = useRef(initial);
  const context = useRef({
    userId: useAuthStore.getState().user?.id,
    version: useAuthStore.getState().sessionVersion,
  });
  const initialDocument = useRef(
    JSON.stringify({ plan: emptySchoolPlan(), overrides: [], applyExisting: false }),
  );
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const userId = context.current.userId;
      const shared = schoolPlanFromLayouts(editor.buildingLayouts);
      setPlan(shared);
      initialDocument.current = JSON.stringify({
        plan: shared,
        overrides: [],
        applyExisting: false,
      });
      const raw =
        userId && initial?.id
          ? localStorage.getItem(schoolPlanStorageKey(userId, initial.id))
          : null;
      if (raw) {
        const loaded = schoolPlanDocumentSchema.parse(JSON.parse(raw));
        const parsed = pruneSchoolPlan(loaded, new Set(editor.rooms.map((room) => room.id)));
        const mergedPlan = mergeSchoolPlans(shared, parsed.plan, parsed.sharedLayout !== true);
        setPlan(mergedPlan);
        setEdits(parsed.overrides);
        setApplyExisting(parsed.applyExisting);
        const mergedBaseline = parsed.baseline
          ? mergeSchoolPlans(shared, parsed.baseline, parsed.sharedLayout !== true)
          : emptySchoolPlan();
        setBaseline(mergedBaseline);
        initialDocument.current = JSON.stringify({
          plan: mergedPlan,
          overrides: parsed.overrides,
          applyExisting: parsed.applyExisting,
        });
        if (JSON.stringify(loaded) !== JSON.stringify(parsed))
          setLocalNotice("Z místního plánu byly odebrané učebny, které už ve škole nejsou.");
      }
    } catch {
      setLocalNotice(
        "Místní rozložení se nepodařilo načíst. Přesuny ve škole zůstaly zachované; rozložení můžete vytvořit nebo načíst ze souboru.",
      );
    }
    setLocalReady(true);
  }, [initial?.id, editor.buildingLayouts, editor.rooms]);
  const modelId = savedModel.current?.id ?? "draft";
  const stages = initial ? ["Plán školy", "Kontrola"] : ["Název", "Plán školy", "Kontrola"];
  const stage = initial ? step + 1 : step;
  const origin = editor.rooms.find((room) => room.id === originId) ?? editor.rooms[0];
  const source = isWriting ? writingSource.current : editor.connections;
  const compiled = useMemo(
    () => compileSchoolPlan(plan, modelId, source, applyExisting, baseline),
    [plan, modelId, source, applyExisting, baseline],
  );
  const derived = useMemo(
    () => projectTransfers(modelId, source, compiled),
    [modelId, source, compiled],
  );
  const locations = useMemo(() => planLocations(plan), [plan]);
  const combined = useMemo(() => [...compiled, ...edits], [compiled, edits]);
  const effective = useMemo(
    () => projectTransfers(modelId, source, combined),
    [modelId, source, combined],
  );
  const coverage = useMemo(
    () => transferCoverage(editor.rooms, effective),
    [editor.rooms, effective],
  );
  const missing = coverage.reduce((sum, item) => sum + item.counts.missing, 0);
  const operations = useMemo(
    () => planConnectionEdits(modelId, combined, source),
    [modelId, combined, source],
  );
  const document = useMemo(
    () => ({ plan, overrides: edits, applyExisting }),
    [plan, edits, applyExisting],
  );
  const layoutChanged = useMemo(
    () => JSON.stringify(document) !== initialDocument.current,
    [document],
  );
  const save = useMutation({
    mutationFn: async () => {
      writingSource.current = editor.connections;
      setIsWriting(true);
      try {
        const version = useAuthStore.getState().sessionVersion;
        if (version !== context.current.version)
          throw new DOMException("Relace se změnila. Otevřete přípravu znovu.", "AbortError");
        if (!name.trim() || (!combined.length && !plan.buildings.length))
          throw new Error("Doplňte název a připravte plán nebo zařaďte přesuny.");
        const ids = new Set(editor.rooms.map((room) => room.id));
        if (
          combined.some((edit) => !ids.has(edit.from_room_id) || !ids.has(edit.to_room_id)) ||
          [...planLocations(plan).keys()].some((id) => !ids.has(id))
        )
          throw new Error("Některá upravovaná učebna už není k dispozici.");
        planConnectionEdits(modelId, combined, editor.connections);
        if (!savedModel.current)
          savedModel.current = await editor.saveModel(undefined, { name: name.trim() });
        if (version !== useAuthStore.getState().sessionVersion)
          throw new DOMException("Ukládání bylo přerušeno.", "AbortError");
        let stored = false;
        try {
          if (context.current.userId) {
            localStorage.setItem(
              schoolPlanStorageKey(context.current.userId, savedModel.current.id),
              JSON.stringify(schoolPlanDocumentSchema.parse({ ...document, baseline })),
            );
            stored = true;
          }
        } catch {
          /* A later write may succeed after the shared layout is saved. */
        }
        const ensureCurrent = () => {
          if (version !== useAuthStore.getState().sessionVersion)
            throw new DOMException("Ukládání bylo přerušeno.", "AbortError");
        };
        const savedPlan = await editor.persistSchoolPlan(plan, ensureCurrent);
        const savedBaseline = baseline.buildings.length
          ? mergeSchoolPlans(savedPlan, baseline, false)
          : baseline;
        try {
          if (context.current.userId) {
            localStorage.setItem(
              schoolPlanStorageKey(context.current.userId, savedModel.current.id),
              JSON.stringify(
                schoolPlanDocumentSchema.parse({
                  ...document,
                  plan: savedPlan,
                  baseline: savedBaseline,
                  sharedLayout: true,
                }),
              ),
            );
            stored = true;
          }
        } catch {
          /* The review keeps an export available when browser storage is unavailable. */
        }
        await editor.apply({
          modelId: savedModel.current.id,
          edits: combined,
          sessionVersion: version,
        });
        try {
          if (context.current.userId) {
            localStorage.setItem(
              schoolPlanStorageKey(context.current.userId, savedModel.current.id),
              JSON.stringify(
                schoolPlanDocumentSchema.parse({
                  ...document,
                  plan: savedPlan,
                  baseline: savedPlan,
                  sharedLayout: true,
                }),
              ),
            );
            stored = true;
          }
        } catch {
          stored = false;
        }
        return { stored, plan: savedPlan };
      } finally {
        setIsWriting(false);
      }
    },
    onSuccess: ({ stored, plan: savedPlan }) => {
      setPlan(savedPlan);
      setBaseline(savedPlan);
      if (stored) onComplete();
      else setStorageFailed(true);
    },
  });
  const started = step > 0 || name !== "Přesuny ve škole" || layoutChanged;
  useUnsavedChanges((started && !save.isSuccess) || save.isPending);
  const assign = (targets: string[], cost: string | null) => {
    if (!origin || save.submittedAt > 0) return;
    const next = assignTransferCost(modelId, edits, origin.id, targets, cost, both, derived);
    if (JSON.stringify(next) === JSON.stringify(edits)) return;
    setHistory((previous) => [
      ...previous.slice(-49),
      { edits, originId: origin.id, plan, applyExisting, baseline },
    ]);
    setEdits(next);
  };
  const nextMissing = () => {
    const index = coverage.findIndex((item) => item.room.id === origin?.id);
    const next = [...coverage.slice(index + 1), ...coverage.slice(0, index + 1)].find(
      (item) => item.counts.missing > 0,
    );
    if (next) setOriginId(next.room.id);
  };
  return {
    step,
    stage,
    stages,
    setStep,
    name,
    setName,
    origin,
    setOriginId,
    both,
    setBoth,
    edits,
    plan,
    localReady,
    localNotice,
    storageFailed,
    applyExisting,
    hasBaseline: baseline.buildings.length > 0,
    unplaced: editor.rooms.filter((room) => !locations.has(room.id)),
    changePlan: (next: SchoolPlan) => {
      if (save.submittedAt > 0) return;
      const parsed = schoolPlanDocumentSchema.shape.plan.parse(next);
      setHistory((previous) => [
        ...previous.slice(-49),
        { edits, originId, plan, applyExisting, baseline },
      ]);
      setPlan(parsed);
    },
    changeApplyExisting: (value: boolean) => {
      if (save.submittedAt > 0) return;
      setHistory((previous) => [
        ...previous.slice(-49),
        { edits, originId, plan, applyExisting, baseline },
      ]);
      setApplyExisting(value);
    },
    exportPlan: () => {
      const blob = new Blob([JSON.stringify({ ...document, baseline }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "bod-plan-skoly.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    importPlan: (raw: string) => {
      if (raw.length > 2_000_000) throw new Error("Soubor rozložení je příliš velký.");
      const parsed: SchoolPlanDocument = schoolPlanDocumentSchema.parse(JSON.parse(raw));
      const ids = new Set(editor.rooms.map((room) => room.id));
      if (
        [
          ...planLocations(parsed.plan).keys(),
          ...(parsed.baseline ? [...planLocations(parsed.baseline).keys()] : []),
          ...parsed.overrides.flatMap((edit) => [edit.from_room_id, edit.to_room_id]),
        ].some((id) => !ids.has(id))
      )
        throw new Error("Soubor obsahuje učebny, které v této škole nejsou.");
      setHistory((previous) => [
        ...previous.slice(-49),
        { edits, originId, plan, applyExisting, baseline },
      ]);
      setPlan(parsed.plan);
      setEdits(parsed.overrides);
      setApplyExisting(parsed.applyExisting);
      setBaseline(parsed.baseline ?? emptySchoolPlan());
    },
    effective,
    coverage,
    missing,
    operations,
    save,
    started,
    assign,
    nextMissing,
    canUndo: history.length > 0 && save.submittedAt === 0,
    undo: () => {
      const previous = history.at(-1);
      if (!previous || save.submittedAt > 0) return;
      setEdits(previous.edits);
      setPlan(previous.plan);
      setBaseline(previous.baseline);
      setApplyExisting(previous.applyExisting);
      setOriginId(previous.originId);
      setHistory((items) => items.slice(0, -1));
    },
    persisted: !initial && !!savedModel.current,
    canContinue:
      localReady &&
      (stage === 0 ? !!name.trim() : operations.length > 0 || layoutChanged || save.isError),
  };
}
