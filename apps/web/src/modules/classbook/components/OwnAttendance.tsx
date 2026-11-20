"use client";

import { dateLabel } from "@/core/time/school";
import { Button } from "@/core/ui/actions/Button";
import { Badge } from "@/core/ui/feedback/Badge";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { FormActions } from "@/core/ui/forms/FormActions";
import { Input } from "@/core/ui/forms/Input";
import { Textarea } from "@/core/ui/forms/Textarea";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { valueLabels } from "@/modules/shared/records/format";

import { excuseStates } from "../attendance";
import { useOwnAttendance } from "../hooks/useOwnAttendance";
import { ChildPicker } from "./ChildPicker";

const lessonTime = (value: string) =>
  new Date(value).toLocaleTimeString("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  });

export function OwnAttendance() {
  const attendance = useOwnAttendance();
  const {
    can,
    parent,
    student,
    studentName,
    setStudent,
    children,
    period,
    rangeError,
    changePeriod,
    selected,
    setSelected,
    reason,
    setReason,
    query,
    records,
    visible,
    eligible,
    chosen,
    invalidSelection,
    send,
    summary,
    onlyAbsences,
    setOnlyAbsences,
    sentCount,
  } = attendance;
  const canRequest = can("attendance.request");
  return (
    <section className="ui-stack">
      <h2 className="text-xl font-semibold">Docházka a omlouvání</h2>
      <fieldset className="personal-attendance-filters" disabled={send.isPending}>
        <legend className="sr-only">Dítě a období docházky</legend>
        {parent && <ChildPicker value={student} query={children} onChange={setStudent} />}
        <Input
          type="date"
          label="Docházka od"
          value={period.from}
          onChange={(event) => changePeriod("from", event.target.value)}
          aria-invalid={!!rangeError}
        />
        <Input
          type="date"
          label="Docházka do"
          value={period.to}
          onChange={(event) => changePeriod("to", event.target.value)}
          aria-invalid={!!rangeError}
        />
      </fieldset>
      {sentCount > 0 && (
        <p role="status">
          Žádost byla odeslána. Počet vybraných záznamů: {sentCount}. Stav vyřízení najdete u
          jednotlivých hodin.
        </p>
      )}
      {rangeError ? (
        <p role="alert">{rangeError}</p>
      ) : !student ? null : query.isLoading ? (
        <LoadingState>Načítám docházku…</LoadingState>
      ) : query.isError ? (
        <ErrorState
          title="Docházku se nepodařilo načíst"
          error={query.error}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Zkusit znovu
            </Button>
          }
        />
      ) : !records.length ? (
        <EmptyState
          title="V tomto období není zapsaná docházka"
          description="Zobrazují se pouze hodiny s podepsaným zápisem. Můžete zvolit jiné období."
        />
      ) : (
        <>
          <dl className="personal-attendance-summary">
            <div>
              <dt>Záznamů docházky</dt>
              <dd>{summary.records}</dd>
            </div>
            <div>
              <dt>Nepřítomnost</dt>
              <dd>{summary.minutes} min</dd>
            </div>
            <div>
              <dt>Čeká ve vašich žádostech</dt>
              <dd>{summary.pending}</dd>
            </div>
          </dl>
          <p className="text-sm text-(--color-muted-foreground)">
            Stav žádostí se vztahuje k vašim podáním. Duplicitní žádost jiného rodiče se při
            odeslání odmítne.
          </p>
          {summary.unknownMinutes > 0 && (
            <p>
              U {summary.unknownMinutes} záznamů není délka nepřítomnosti uvedena. Součet minut je
              nezahrnuje.
            </p>
          )}
          <div className="personal-attendance-tools">
            <Checkbox
              label="Jen nepřítomnost"
              checked={onlyAbsences}
              onChange={(event) => setOnlyAbsences(event.target.checked)}
            />
            {canRequest && eligible.length > 0 && (
              <Button
                variant="outline"
                disabled={send.isPending}
                onClick={() => setSelected(eligible.slice(0, 100).map((record) => record.id))}
              >
                {eligible.length > 100 ? "Vybrat prvních 100 k omluvení" : "Vybrat vše k omluvení"}
              </Button>
            )}
          </div>
          {!visible.length ? (
            <EmptyState title="Ve zvoleném období není zapsaná nepřítomnost" />
          ) : (
            <ul className="personal-attendance-list" aria-label="Hodiny a stav docházky">
              {visible.map((record) => {
                const checked = selected.includes(record.id);
                const state = excuseStates[record.excuse_state];
                const timing =
                  record.starts_at && record.ends_at
                    ? `${dateLabel(record.starts_at)}, ${lessonTime(record.starts_at)}–${lessonTime(record.ends_at)}`
                    : "Termín neuveden";
                const lesson = `${record.subject_name}, ${timing}`;
                return (
                  <li
                    key={record.id}
                    className="personal-attendance-row"
                    data-selectable={canRequest}
                  >
                    {canRequest && (
                      <Checkbox
                        checked={checked}
                        disabled={
                          send.isPending ||
                          (!checked && (!record.can_request_excuse || selected.length >= 100))
                        }
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? [...selected, record.id]
                              : selected.filter((id) => id !== record.id),
                          )
                        }
                        label={<span className="sr-only">{`Vybrat: ${lesson}`}</span>}
                      />
                    )}
                    <div className="personal-attendance-lesson">
                      <p className="font-semibold">{record.subject_name}</p>
                      <p>
                        <time dateTime={record.starts_at ?? undefined}>{timing}</time>
                      </p>
                      <p className="text-sm text-(--color-muted-foreground)">{record.group_name}</p>
                    </div>
                    <div className="personal-attendance-state">
                      <p>{valueLabels[record.status]}</p>
                      <p className="text-sm text-(--color-muted-foreground)">
                        {record.absence_minutes == null
                          ? "Délka neuvedena"
                          : `${record.absence_minutes} min nepřítomnosti`}
                      </p>
                      <Badge tone={state.tone}>{state.label}</Badge>
                      {record.excuse_reason && record.is_excused && (
                        <details>
                          <summary>Důvod omluvení</summary>
                          <p>{record.excuse_reason}</p>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {canRequest && selected.length > 0 && (
            <div className="personal-attendance-selection">
              <p>
                Vybráno: <strong>{selected.length}</strong> (nejvýše 100)
              </p>
              <Button variant="ghost" disabled={send.isPending} onClick={() => setSelected([])}>
                Zrušit výběr
              </Button>
              <Button
                disabled={
                  send.isPending || invalidSelection || selected.length > 100 || query.isFetching
                }
                onClick={attendance.openDialog}
              >
                Omluvit vybrané
              </Button>
              {invalidSelection && (
                <p role="alert">Stav některých vybraných absencí se změnil. Zkontrolujte výběr.</p>
              )}
            </div>
          )}
        </>
      )}
      <Dialog
        open={attendance.dialogOpen}
        onClose={attendance.closeDialog}
        busy={send.isPending}
        title="Omluvit vybrané absence"
        description={`${studentName ? `${studentName} · ` : ""}Počet vybraných záznamů: ${chosen.length}. Žádost posoudí škola.`}
      >
        <form
          className="ui-stack"
          onSubmit={(event) => {
            event.preventDefault();
            attendance.submit();
          }}
        >
          <Textarea
            label="Důvod omluvení"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={10000}
            disabled={send.isPending}
          />
          {send.isError && <ErrorState title="Žádost se nepodařilo odeslat" error={send.error} />}
          {invalidSelection && (
            <p role="alert">
              Stav některých vybraných absencí se změnil. Vraťte se k výběru a zkontrolujte je.
              Rozepsaný důvod zůstane zachovaný.
            </p>
          )}
          <FormActions
            submitLabel="Odeslat žádost"
            cancelLabel="Zpět k výběru"
            onCancel={attendance.closeDialog}
            pending={send.isPending}
            disabled={invalidSelection || query.isFetching || !reason.trim() || chosen.length > 100}
          />
        </form>
      </Dialog>
    </section>
  );
}
