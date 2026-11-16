"use client";

import type { ClassbookEntriesRead, LessonDetail, ScheduleLesson } from "@bod/api-client/types.gen";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuthUser } from "@/core/auth/store";
import { useUnsavedChanges } from "@/core/hooks/useUnsavedChanges";
import { request, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { usePermissions, useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { getLessonDetail, recordScheduledLesson, saveAttendance, updateLesson } from "../api";
import { useAttendanceDrafts } from "./useAttendanceDrafts";

export function useLessonPage({
  entry,
  lesson,
  onDirtyChange,
}: {
  entry?: ClassbookEntriesRead;
  lesson?: ScheduleLesson;
  onDirtyChange: (key: string, dirty: boolean) => void;
}) {
  const { getResource } = useRecordCatalog();
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminEditor, setAdminEditor] = useState(false);
  const user = useAuthUser();
  const can = usePermissions();
  const refresh = useWorkspaceRefresh();
  const client = useQueryClient();
  const [persisted, setPersisted] = useState<ClassbookEntriesRead | null>(null);
  const current = persisted ?? entry;
  const [topic, setTopic] = useState(entry?.topic ?? "");
  const [noteOpen, setNoteOpen] = useState(!!entry?.note);
  const [note, setNote] = useState(entry?.note ?? "");
  const [correctionReason, setCorrectionReason] = useState("");
  const [open, setOpen] = useState(!entry || entry.status === "draft");
  const teacher = current?.actual_teacher_id ?? lesson?.teacher_id;
  const own = teacher === user?.id;
  const writable =
    can("classbook.write") && own && (current?.status !== "signed" || can("classbook.correct"));
  const showAttendance = own && can("attendance.mark") && can("classbook.read");
  const attendanceWritable =
    showAttendance && (current?.status !== "signed" || can("classbook.correct"));
  const attendanceQuery = useQuery({
    queryKey: [...workspaceKey, "lesson-detail", current?.id],
    queryFn: ({ signal }) => getLessonDetail(current?.id ?? "", signal),
    enabled: !!current && showAttendance,
  });
  const participants = attendanceQuery.data?.participants ?? [];
  const attendance = useAttendanceDrafts(participants);
  const dirty =
    (writable &&
      (topic !== (current?.topic ?? "") || note !== (current?.note ?? "") || !!correctionReason)) ||
    (attendanceWritable && attendance.dirty);
  useUnsavedChanges(dirty);
  const draftKey = entry?.id ?? `${lesson?.timetable_entry_id}:${lesson?.scheduled_date}`;
  useEffect(() => {
    onDirtyChange(draftKey, dirty);
    return () => onDirtyChange(draftKey, false);
  }, [draftKey, dirty, onDirtyChange]);
  const save = useMutation({
    mutationFn: async (sign: boolean) => {
      if (sign && !topic.trim()) throw new Error("Napište probranou látku.");
      if (current && showAttendance && !attendanceQuery.isSuccess)
        throw new Error("Nejdřív načtěte seznam žáků.");
      let saved: ClassbookEntriesRead;
      if (current)
        saved = writable
          ? await updateLesson(current, {
              topic: topic.trim(),
              note,
              correction_reason: correctionReason,
            })
          : current;
      else if (lesson) saved = await recordScheduledLesson(lesson, topic.trim(), note);
      else throw new Error("Hodinu se nepodařilo určit.");
      setPersisted(saved);
      if (attendanceWritable && participants.length && (attendance.dirty || attendance.missing)) {
        const stored = await saveAttendance(saved.id, attendance.records);
        const byStudent = new Map(stored.map((record) => [record.student_id, record]));
        client.setQueryData<LessonDetail>(
          [...workspaceKey, "lesson-detail", saved.id],
          (previous) =>
            previous
              ? {
                  ...previous,
                  lesson: saved,
                  participants: previous.participants.map((person) => ({
                    ...person,
                    attendance: byStudent.get(person.student_id) ?? person.attendance,
                  })),
                }
              : previous,
        );
        attendance.reset();
      }
      setTopic(saved.topic ?? "");
      setNote(saved.note ?? "");
      setCorrectionReason("");
      if (sign) {
        const signed = await request<ClassbookEntriesRead>(
          "POST",
          `/api/v1/classbook/classbook-entries/${saved.id}/sign`,
        );
        setPersisted(signed);
      }
      await refresh();
    },
  });
  const prepareAttendance = useMutation({
    mutationFn: async () => {
      let saved = current;
      if (!saved && lesson) saved = await recordScheduledLesson(lesson, topic, note);
      else if (saved && dirty)
        saved = await updateLesson(saved, { topic, note, correction_reason: correctionReason });
      if (!saved) throw new Error("Hodinu se nepodařilo otevřít.");
      setPersisted(saved);
      setTopic(saved.topic ?? "");
      setNote(saved.note ?? "");
      await refresh();
    },
  });
  const busy = save.isPending || prepareAttendance.isPending;
  const starts = current?.starts_at ?? lesson?.starts_at ?? "";
  const ends = current?.ends_at ?? lesson?.ends_at ?? "";
  const hour = (value: string) =>
    new Date(value).toLocaleTimeString("cs-CZ", {
      timeZone: "Europe/Prague",
      hour: "2-digit",
      minute: "2-digit",
    });
  const subject = current?.subject_id ?? lesson?.subject_id ?? "";
  const group = current?.group_id ?? lesson?.group_id ?? "";
  const room = current?.actual_room_id ?? lesson?.room_id;
  const status =
    current?.status === "signed" ? "Podepsáno" : current ? "Rozepsáno" : "Čeká na zápis";
  return {
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
  };
}
