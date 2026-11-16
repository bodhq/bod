"use client";
import type { ClassbookEntriesRead, ScheduleLesson } from "@bod/api-client/types.gen";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { useAuthStore } from "@/core/auth/store";
import { useMediaQuery } from "@/core/hooks/useMediaQuery";
import { Button } from "@/core/ui/actions/Button";
import { Badge } from "@/core/ui/feedback/Badge";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { SaveStatus } from "@/core/ui/feedback/SaveStatus";
import { Textarea } from "@/core/ui/forms/Textarea";
import { Panel } from "@/core/ui/layout/Panel";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { ResourceManager } from "@/modules/shared/records/components/ResourceManager";

import { deleteEmptyLesson, updateLesson } from "../api";
import { useLessonPage } from "../hooks/useLessonPage";
import { AttendanceRoster } from "./AttendanceRoster";

export function LessonPage({
  entry,
  lesson,
  onDirtyChange,
  names,
}: {
  entry?: ClassbookEntriesRead;
  lesson?: ScheduleLesson;
  onDirtyChange: (key: string, dirty: boolean) => void;
  names: Record<string, Record<string, string>>;
}) {
  const {
    getResource,
    adminOpen,
    setAdminOpen,
    adminEditor,
    setAdminEditor,
    can,
    refresh,
    setPersisted,
    current,
    topic,
    setTopic,
    noteOpen,
    setNoteOpen,
    note,
    setNote,
    correctionReason,
    setCorrectionReason,
    open,
    setOpen,
    own,
    writable,
    dirty,
    save,
    prepareAttendance,
    busy,
    starts,
    ends,
    hour,
    subject,
    group,
    room,
    status,
    showAttendance,
    attendanceWritable,
    attendanceQuery,
    participants,
    attendance,
  } = useLessonPage({ entry, lesson, onDirtyChange });
  const confirm = useConfirm();
  const discard = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: deleteEmptyLesson,
    onSuccess: async (_data, _id, version) => {
      if (version === useAuthStore.getState().sessionVersion) await refresh();
    },
  });
  const canDiscard =
    own &&
    writable &&
    current?.status === "draft" &&
    !current.topic?.trim() &&
    !current.note?.trim() &&
    attendanceQuery.isSuccess &&
    participants.every((person) => !person.attendance) &&
    !dirty;
  const mobile = useMediaQuery("(max-width: 767px)");
  const [topicOpen, setTopicOpen] = useState(false);
  const roster =
    showAttendance &&
    current &&
    (attendanceQuery.isPending ? (
      <LoadingState>Načítám žáky…</LoadingState>
    ) : attendanceQuery.isError ? (
      <ErrorState
        title="Seznam žáků se nepodařilo načíst"
        error={attendanceQuery.error}
        action={
          <Button variant="outline" onClick={() => attendanceQuery.refetch()}>
            Zkusit znovu
          </Button>
        }
      />
    ) : participants.length ? (
      <AttendanceRoster
        participants={participants}
        records={attendance.records}
        onChange={attendance.change}
        disabled={busy || !attendanceWritable || (writable && !open)}
      />
    ) : (
      <p className="attendance-hint">Tato hodina nemá žádné účastníky.</p>
    ));
  return (
    <Panel padded={false} as="article" className="lesson-sheet">
      <div className="min-w-0">
        <div className="lesson-sheet-content">
          <div className="lesson-heading flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-(--color-muted-foreground)">
                <span className="font-medium tabular-nums text-(--color-foreground)">
                  {hour(starts)}–{hour(ends)}
                </span>{" "}
                · {names.teaching_groups?.[group] ?? "Skupina žáků"}
                {room ? ` · ${names.rooms?.[room] ?? "Učebna"}` : ""}
              </p>
              <h4 className="mt-1 text-xl font-semibold">
                {names.subjects?.[subject] ?? "Výuka podle rozvrhu"}
              </h4>
            </div>
            <Badge tone={current?.status === "signed" ? "success" : "neutral"}>{status}</Badge>
          </div>
          {prepareAttendance.isError && <ErrorState error={prepareAttendance.error} />}
          {writable && open ? (
            <form
              className="lesson-form"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(false);
              }}
            >
              <details
                className="lesson-topic"
                open={!mobile || topicOpen}
                onToggle={(event) => {
                  if (mobile) setTopicOpen(event.currentTarget.open);
                }}
              >
                <summary>
                  Probraná látka <span>{topic.trim() ? "Zobrazit / upravit" : "Doplnit téma"}</span>
                </summary>
                <Textarea
                  label="Probraná látka"
                  rows={2}
                  placeholder="Co jste dnes se třídou probrali?"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  required={false}
                  maxLength={10000}
                  disabled={busy}
                />
              </details>
              <details
                className="lesson-note"
                open={noteOpen}
                onToggle={(event) => setNoteOpen(event.currentTarget.open)}
              >
                <summary className="cursor-pointer rounded py-2 text-sm font-medium text-(--color-muted-foreground) focus-visible:outline-2 focus-visible:outline-(--color-ring)">
                  Poznámka k hodině
                </summary>
                <div className="mt-2">
                  {" "}
                  <Textarea
                    label="Poznámka k hodině"
                    placeholder="Nepovinná poznámka…"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    disabled={busy}
                    maxLength={10000}
                  />
                </div>
              </details>
              {roster}
              {current?.status === "signed" && (
                <Textarea
                  label="Důvod opravy"
                  value={correctionReason}
                  onChange={(event) => setCorrectionReason(event.target.value)}
                  required
                  maxLength={10000}
                  disabled={busy}
                />
              )}
              {save.isError && <ErrorState error={save.error} />}
              <div className="lesson-save-bar">
                <SaveStatus
                  pending={busy}
                  dirty={dirty}
                  saved={save.isSuccess}
                  error={save.isError}
                  idle={current ? "" : "Otevřete hodinu pro načtení žáků."}
                />
                {!current && showAttendance ? (
                  <Button isLoading={busy} onClick={() => prepareAttendance.mutate()}>
                    Otevřít hodinu a žáky
                  </Button>
                ) : (
                  <>
                    <Button
                      type="submit"
                      variant="outline"
                      isLoading={busy}
                      disabled={showAttendance && !attendanceQuery.isSuccess}
                    >
                      {current?.status === "signed" ? "Uložit opravu" : "Uložit zápis"}
                    </Button>
                    {can("classbook.write") && current?.status !== "signed" && (
                      <Button
                        disabled={
                          busy || !topic.trim() || (showAttendance && !attendanceQuery.isSuccess)
                        }
                        onClick={(event) => {
                          if (event.currentTarget.form?.reportValidity()) save.mutate(true);
                        }}
                      >
                        Uložit a podepsat
                      </Button>
                    )}
                  </>
                )}
              </div>
            </form>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="whitespace-pre-wrap leading-7">
                {current?.topic || "Probraná látka zatím není zapsaná."}
              </p>
              {current?.note && (
                <p className="whitespace-pre-wrap text-sm text-(--color-muted-foreground)">
                  {current.note}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {writable && (
                  <Button variant="outline" onClick={() => setOpen(true)}>
                    Upravit zápis
                  </Button>
                )}
              </div>
              {current?.signed_at && (
                <p className="text-xs text-(--color-muted-foreground)">
                  Podepsáno{" "}
                  {new Date(current.signed_at).toLocaleString("cs-CZ", {
                    timeZone: "Europe/Prague",
                  })}
                </p>
              )}
              {attendanceWritable && !writable ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    save.mutate(false);
                  }}
                >
                  {roster}
                  {save.isError && <ErrorState error={save.error} />}
                  <div className="lesson-save-bar">
                    <SaveStatus
                      pending={busy}
                      dirty={dirty}
                      saved={save.isSuccess}
                      error={save.isError}
                      idle="Docházka hodiny"
                    />
                    <Button type="submit" isLoading={busy} disabled={!attendanceQuery.isSuccess}>
                      Uložit docházku
                    </Button>
                  </div>
                </form>
              ) : (
                roster
              )}
            </div>
          )}
        </div>
      </div>
      {current && (canDiscard || can("audit.read")) && (
        <details className="px-3 pb-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm">Další úkony hodiny</summary>
          <div className="flex flex-wrap gap-2">
            {canDiscard && (
              <Button
                variant="outline"
                disabled={busy || discard.isPending}
                onClick={() =>
                  confirm({
                    title: "Odstranit prázdný návrh?",
                    description:
                      "Odstraní se pouze otevřený návrh zápisu bez tématu a docházky. Výuka v rozvrhu zůstane dostupná.",
                    confirmLabel: "Odstranit návrh",
                    destructive: true,
                    onConfirm: () => discard.mutateAsync(current.id),
                  })
                }
              >
                Odstranit prázdný návrh
              </Button>
            )}
            {can("audit.read") && (
              <Link
                className="inline-flex min-h-11 items-center font-semibold text-(--color-primary-accessible)"
                href={`/app/settings/access?section=audit&entity=classbook_entries&record=${current.id}`}
              >
                Historie změn této hodiny →
              </Link>
            )}
          </div>
        </details>
      )}
      {current && can("classbook.manage") && (
        <details
          className="px-5 pb-5 sm:px-6"
          onToggle={(event) => setAdminOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer py-2 text-sm font-medium text-(--color-muted-foreground)">
            Správa této hodiny
          </summary>
          <div className="mt-4 space-y-4">
            {!writable && (
              <Button variant="outline" onClick={() => setAdminEditor(true)}>
                Opravit zápis hodiny
              </Button>
            )}
            {adminOpen && (
              <ResourceManager
                resource={getResource("classbook_participants")}
                bound={{ classbook_entry_id: current.id }}
                createLabel="Přidat účastníka hodiny"
              />
            )}
          </div>
        </details>
      )}
      {current && adminEditor && (
        <RecordDialog
          title="Opravit zápis hodiny"
          editing
          initial={current}
          fields={getResource("classbook_entries")
            .fields.filter((field) =>
              [
                "topic",
                "note",
                ...(current.status === "signed" ? ["correction_reason"] : []),
              ].includes(field.name),
            )
            .map((field) => ({
              ...field,
              required: field.name === "correction_reason" || field.required,
            }))}
          onClose={() => setAdminEditor(false)}
          onSave={async (body) => {
            const saved = await updateLesson(current, body, true);
            setPersisted(saved);
            setTopic(saved.topic ?? "");
            setNote(saved.note ?? "");
            await refresh();
            setAdminEditor(false);
          }}
        />
      )}
    </Panel>
  );
}
