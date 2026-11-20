"use client";
import type { Row } from "@/modules/shared/records/types";
import type { GroupContext } from "../membership";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { FormActions } from "@/core/ui/forms/FormActions";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { StepProgress } from "@/core/ui/navigation/StepProgress";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { rowLabel } from "@/modules/shared/records/format";

import { useAutomaticGroupBuilder } from "../hooks/useAutomaticGroupBuilder";

export function AutomaticGroupBuilder({
  open,
  classes,
  specializations,
  studyFields,
  context,
  onClose,
  onBack,
  onCreated,
}: {
  open: boolean;
  classes: Row[];
  specializations: Row[];
  studyFields: Row[];
  context: GroupContext;
  onClose: () => void;
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const {
    scope,
    source,
    setSource,
    setClassId,
    setMethod,
    divisionName,
    setDivisionName,
    count,
    setCount,
    setNames,
    setMapping,
    day,
    setDay,
    review,
    setReview,
    confirmRecompute,
    setConfirmRecompute,
    prepared,
    createdGroups,
    queries,
    divisions,
    existing,
    classroom,
    selectedMethod,
    groupCount,
    title,
    groupKey,
    groupName,
    enrollments,
    specializationIds,
    groupIndex,
    counts,
    affected,
    uncovered,
    earliest,
    valid,
    generate,
    reset,
    locked,
  } = useAutomaticGroupBuilder({ open, classes, context, onCreated });
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!generate.isPending) onClose();
      }}
      title="Automatické vytvoření skupin"
      description="Rozdělte žáky jedné třídy abecedně nebo podle zaměření. Nejdřív zkontrolujte počty a pravidla, potom spusťte vytvoření členství."
      className="max-w-4xl"
    >
      <div className="mt-5 space-y-5">
        <StepProgress
          steps={["Nastavit dělení", "Zkontrolovat skupiny"]}
          current={review ? 1 : 0}
        />
        {queries.some((query) => query.isLoading) ? (
          <LoadingState>Načítám pravidla dělení…</LoadingState>
        ) : queries.some((query) => query.isError) ? (
          <ErrorState
            title="Pravidla dělení se nepodařilo načíst"
            action={
              <Button
                variant="outline"
                onClick={() => Promise.all(queries.map((query) => query.refetch()))}
              >
                Zkusit znovu
              </Button>
            }
          />
        ) : (
          <>
            {!review && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <Select
                    label="Připravit dělení"
                    fieldWidth="standard"
                    value={source}
                    disabled={locked}
                    onChange={(event) => {
                      setSource(event.target.value);
                      setConfirmRecompute(false);
                      setMapping({});
                      const division = divisions.find((row) => row.id === event.target.value);
                      if (division) setDay(String(division.effective_from));
                    }}
                  >
                    <option value="">Nové dělení třídy</option>
                    {divisions
                      .filter(
                        (row) =>
                          row.method !== "manual" &&
                          classes.some((classroom) => classroom.id === row.class_id),
                      )
                      .map((row) => (
                        <option key={String(row.id)} value={String(row.id)}>
                          {rowLabel(row)}
                        </option>
                      ))}
                  </Select>
                  {!prepared && (
                    <Button variant="outline" onClick={reset}>
                      Nová příprava
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Zdrojová třída"
                    value={String(classroom?.id ?? "")}
                    disabled={!!existing || locked}
                    onChange={(event) => {
                      setClassId(event.target.value);
                      setNames({});
                      setMapping({});
                    }}
                  >
                    <option value="">Vyberte třídu…</option>
                    {classes.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {rowLabel(row)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Způsob automatického dělení"
                    value={selectedMethod}
                    disabled={!!existing || locked}
                    onChange={(event) => setMethod(event.target.value)}
                  >
                    <option value="alphabetical">Abecedně · přibližně stejné počty</option>
                    <option value="specialization">Podle zaměření · vlastní pravidla</option>
                    <option value="study_field">Podle oboru studia · vlastní pravidla</option>
                  </Select>
                  <Input
                    label="Název dělení"
                    value={existing ? rowLabel(existing) : divisionName}
                    disabled={!!existing || locked}
                    placeholder={title}
                    onChange={(event) => setDivisionName(event.target.value)}
                  />
                  <Input
                    label="Dělení platí od"
                    type="date"
                    min={earliest}
                    max={scope?.interval.end}
                    value={day}
                    disabled={locked}
                    onChange={(event) => {
                      setDay(event.target.value);
                      setConfirmRecompute(false);
                    }}
                  />
                </div>
                {!existing && (
                  <Input
                    label="Počet výsledných skupin"
                    type="number"
                    min={2}
                    max={10}
                    fieldWidth="short"
                    value={count}
                    disabled={locked}
                    onChange={(event) =>
                      setCount(Math.max(2, Math.min(10, Number(event.target.value) || 2)))
                    }
                  />
                )}
                <div className="space-y-3">
                  <h3 className="font-semibold">Výsledné skupiny</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: groupCount }, (_, index) => (
                      <Input
                        key={groupKey(index)}
                        label={`Skupina ${index + 1}`}
                        value={groupName(index)}
                        disabled={!!existing || locked}
                        onChange={(event) =>
                          setNames((previous) => ({ ...previous, [index]: event.target.value }))
                        }
                      />
                    ))}
                  </div>
                  {existing && groupCount < 2 && (
                    <p className="text-sm text-(--color-warning)">
                      Toto dělení ještě nemá alespoň dvě cílové skupiny. Doplňte je v Evidenci
                      školy, nebo založte nové dělení.
                    </p>
                  )}
                </div>
                {["specialization", "study_field"].includes(selectedMethod) && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">
                      {selectedMethod === "study_field"
                        ? "Kam patří jednotlivé obory"
                        : "Kam patří jednotlivá zaměření"}
                    </h3>
                    {specializationIds.filter(Boolean).map((id) => (
                      <Select
                        key={id}
                        label={rowLabel(
                          (selectedMethod === "study_field" ? studyFields : specializations).find(
                            (row) => row.id === id,
                          ) ?? {
                            name: "Nedostupný obor nebo zaměření",
                          },
                        )}
                        value={groupIndex(id)}
                        disabled={!!existing || locked}
                        onChange={(event) =>
                          setMapping((previous) => ({
                            ...previous,
                            [id]: Number(event.target.value),
                          }))
                        }
                      >
                        {groupIndex(id) < 0 && <option value={-1}>Chybí pravidlo</option>}
                        {Array.from({ length: groupCount }, (_, index) => (
                          <option key={groupKey(index)} value={index}>
                            {groupName(index)}
                          </option>
                        ))}
                      </Select>
                    ))}
                    {uncovered && (
                      <p role="alert" className="text-sm text-(--color-warning)">
                        Některý žák nemá obor či zaměření nebo nemá pravidlo. Opravte zařazení žáků
                        či pravidla, nebo zvolte abecední dělení.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="ui-panel p-4">
              <h3 className="font-semibold">
                {review ? "Kontrola před vytvořením" : "Náhled počtů"}
              </h3>
              <p className="mt-1 text-sm text-(--color-muted-foreground)">
                {classroom ? rowLabel(classroom) : "Vyberte zdrojovou třídu"} · {enrollments.length}{" "}
                zařazených žáků k {day || "vybranému datu"}
              </p>
              <div className="mt-3 divide-y divide-(--color-border)">
                {counts.map((value, index) => (
                  <div
                    key={groupKey(index)}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span>{groupName(index)}</span>
                    <strong>{value} žáků</strong>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-(--color-muted-foreground)">
                {selectedMethod === "alphabetical"
                  ? "Konečné pořadí žáků určuje server podle příjmení, jména a uživatelského jména. Náhled ukazuje počty, nikoliv potvrzená členství."
                  : "Přiřazení se řídí zaměřením evidovaným u zařazení žáka. Zaměření není totéž co obor."}{" "}
                Platnost členství respektuje zařazení žáka do zdrojové třídy.
              </p>
            </div>
            {affected.length > 0 && (
              <label className="flex items-start gap-3 rounded-lg bg-(--color-warning)/10 p-4 text-sm">
                <Checkbox
                  className="mt-0.5 shrink-0"
                  checked={confirmRecompute}
                  disabled={generate.isPending}
                  onChange={(event) => setConfirmRecompute(event.target.checked)}
                />
                <span>
                  Potvrzuji přepočet {affected.length} existujících členství od {day}. Historie před
                  tímto datem zůstane zachovaná; budoucí přiřazení v tomto dělení se nahradí.
                </span>
              </label>
            )}
            {generate.isError && (
              <ErrorState
                title={
                  prepared
                    ? `Příprava dělení je uložená (${createdGroups.length} skupin). Pokračování neduplikuje hotové kroky.`
                    : "Dělení se nepodařilo vytvořit"
                }
                error={generate.error}
              />
            )}
            <FormActions
              onCancel={onClose}
              onBack={() => (review ? setReview(false) : onBack())}
              backLabel={review ? "Zpět k nastavení" : "Zpět k volbě způsobu"}
              backDisabled={!!prepared}
              pending={generate.isPending}
              disabled={!valid}
              onSubmit={() => (review ? generate.mutate() : setReview(true))}
              submitLabel={
                review
                  ? prepared
                    ? "Pokračovat ve vytvoření"
                    : "Vytvořit skupiny automaticky"
                  : "Zkontrolovat dělení"
              }
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
