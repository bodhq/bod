from typing import Any

from pydantic import BaseModel

from server.core.access.services import AccessContext
from server.core.domain.services import (
    DomainService,
    authorize,
    conflict,
    instant,
    require,
)
from server.core.users.models import utcnow
from server.modules.school.repository import active_on, group_students
from server.modules.timetable.repository import SCHOOL_ZONE, resolved_lessons

from .models import (
    AbsenceExcuseItems,
    AbsenceExcuseRequests,
    AttendanceRecords,
    ClassbookEntries,
    ClassbookParticipants,
)


class ClassbookDomainService(DomainService):
    def lock_mutation(self, data: dict[str, Any]) -> None:
        name = self.resource.name
        if name == "classbook_entries":
            if data.get("id"):
                self.repo.lock_records("entry:" + str(data["id"]))
            else:
                self.repo.lock_records(
                    "teacher:" + str(data["actual_teacher_id"]),
                    "group:" + str(data["group_id"]),
                )
        elif name in {"classbook_participants", "attendance_records"}:
            self.repo.lock_records("entry:" + str(data["classbook_entry_id"]))
        elif name == "absence_excuse_requests":
            self.repo.lock_records("student:" + str(data["student_id"]))
        elif name == "absence_excuse_items":
            request = self.repo.one("absence_excuse_requests", id=data["request_id"])
            self.repo.lock_records("student:" + str(request["student_id"]))

    def owns_student(self, actor: AccessContext, student_id: Any) -> bool:
        return (
            actor.school_role_code == "student" and actor.user.id == student_id
        ) or (
            actor.school_role_code == "parent"
            and bool(
                self.repo.rows(
                    "parent_students", parent_id=actor.user.id, student_id=student_id
                )
            )
        )

    def owns_lesson(self, actor: AccessContext, lesson: dict[str, Any]) -> None:
        authorize(
            "classbook.manage" in actor.permissions
            or (
                actor.school_role_code == "teacher"
                and lesson["actual_teacher_id"] == actor.user.id
            ),
            "Výuku může měnit pouze její učitel nebo správce třídnice.",
        )

    def signed_guard(self, actor: AccessContext, lesson: dict[str, Any]) -> None:
        self.owns_lesson(actor, lesson)
        if lesson["status"] == "signed":
            self.access.require(actor, "classbook.correct")

    def validate(
        self,
        data: dict[str, Any],
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        super().validate(data, old, actor)
        name = self.resource.name
        if name == "classbook_entries":
            self.owns_lesson(actor, data)
            if old:
                require(
                    data.get("expected_updated_at") is not None,
                    "Pošli expected_updated_at z načteného zápisu.",
                )
                conflict(
                    instant(data["expected_updated_at"]) != instant(old["updated_at"]),
                    "Zápis mezitím upravil jiný uživatel. Načti aktuální verzi.",
                )
                self.signed_guard(actor, old)
                if old["status"] == "signed":
                    require(
                        bool((data.get("correction_reason") or "").strip()),
                        "Oprava podepsaného zápisu vyžaduje důvod.",
                    )
                    self.access.repo.audit(
                        actor,
                        "classbook.corrected",
                        "classbook_entries",
                        str(old["id"]),
                        after={"reason": data["correction_reason"]},
                    )
                for key in (
                    "lesson_occurrence_id",
                    "group_id",
                    "subject_id",
                    "starts_at",
                    "ends_at",
                ):
                    require(
                        data[key] == old[key], "Identita a termín zápisu jsou neměnné."
                    )
                require(
                    data["status"] == old["status"], "Použij akci podepsání zápisu."
                )
            else:
                require(
                    data.get("status", "draft") == "draft",
                    "Nový zápis začíná jako návrh.",
                )
            if old is None or old["actual_teacher_id"] != data["actual_teacher_id"]:
                self.user_role(data["actual_teacher_id"], "teacher")
            group = self.repo.one("teaching_groups", id=data["group_id"])
            year = self.repo.one("school_years", id=group["school_year_id"])
            day = instant(data["starts_at"]).astimezone(SCHOOL_ZONE).date()
            require(
                year["starts_on"] <= day < year["ends_on"],
                "Výuka je mimo školní rok skupiny.",
            )
            require(
                instant(data["ends_at"]).astimezone(SCHOOL_ZONE).date() == day,
                "Výuka musí začít i skončit ve stejný školní den.",
            )
            if not old:
                from .repository import ClassbookRepository

                conflict(
                    ClassbookRepository(self.repo.db).has_lesson_conflict(data),
                    "Výuka koliduje s již uloženým zápisem učitele nebo skupiny.",
                )
                if not data.get("lesson_occurrence_id"):
                    authorize(
                        "classbook.manage" in actor.permissions
                        or bool(
                            self.repo.rows(
                                "teaching_assignments",
                                group_id=data["group_id"],
                                teacher_id=actor.user.id,
                                subject_id=data["subject_id"],
                            )
                        ),
                        "Mimořádnou výuku lze zapsat pouze "
                        "pro vlastní předmět a skupinu.",
                    )
            if not old and data.get("lesson_occurrence_id"):
                occurrence = self.repo.one(
                    "lesson_occurrences", id=data["lesson_occurrence_id"]
                )
                lesson = next(
                    (
                        r
                        for r in resolved_lessons(self.repo)
                        if r["lesson_occurrence_id"] == occurrence["id"]
                    ),
                    None,
                )
                require(
                    lesson is not None,
                    "Zrušená hodina nemůže mít zápis skutečné výuky.",
                )
                assert lesson is not None
                for key, expected in (
                    ("group_id", "group_id"),
                    ("subject_id", "subject_id"),
                    ("actual_teacher_id", "teacher_id"),
                    ("actual_room_id", "room_id"),
                ):
                    require(
                        data.get(key) == lesson[expected],
                        "Zápis neodpovídá konkrétní hodině a suplování.",
                    )
                require(
                    instant(data["starts_at"]) == lesson["starts_at"]
                    and instant(data["ends_at"]) == lesson["ends_at"],
                    "Termín zápisu neodpovídá výuce.",
                )
        elif name in {"classbook_participants", "attendance_records"}:
            lesson = self.repo.one("classbook_entries", id=data["classbook_entry_id"])
            self.signed_guard(actor, lesson)
            if old:
                require(
                    data["classbook_entry_id"] == old["classbook_entry_id"]
                    and data["student_id"] == old["student_id"],
                    "Identita docházky je neměnná.",
                )
            if name == "classbook_participants":
                self.user_role(data["student_id"], "student")
            else:
                self.repo.one(
                    "classbook_participants",
                    classbook_entry_id=lesson["id"],
                    student_id=data["student_id"],
                )
                if data["status"] == "absent" and data.get("missed_minutes") is None:
                    data["missed_minutes"] = int(
                        (
                            instant(lesson["ends_at"]) - instant(lesson["starts_at"])
                        ).total_seconds()
                        / 60
                    )
                self.validate_attendance(data, lesson)
                if old and old["is_excused"]:
                    require(
                        data["status"] == old["status"]
                        and data.get("missed_minutes") == old["missed_minutes"]
                        and data.get("late_minutes") == old["late_minutes"],
                        "Omluvenou absenci nelze přepsat běžnou změnou docházky.",
                    )
        elif name == "absence_excuse_requests":
            require(
                data.get("status", "open") == "open",
                "Použij akci uzavření nebo stažení žádosti.",
            )
            require(
                data["requested_by"] == actor.user.id,
                "Žadatel musí být přihlášený uživatel.",
            )
            require(
                self.owns_student(actor, data["student_id"])
                or "classbook.manage" in actor.permissions,
                "Žadatel nemá přístup k žákovi.",
            )
            if old:
                conflict(old["status"] != "open", "Žádost už je uzavřená.")
                conflict(
                    any(
                        item["decision"] != "pending"
                        for item in self.repo.rows(
                            "absence_excuse_items", request_id=old["id"]
                        )
                    ),
                    "Důvod žádosti s rozhodnutými položkami již nelze měnit.",
                )
                require(
                    old["student_id"] == data["student_id"]
                    and old["requested_by"] == data["requested_by"],
                    "Identita žádosti je neměnná.",
                )
        elif name == "absence_excuse_items":
            request = self.repo.one("absence_excuse_requests", id=data["request_id"])
            require(request["status"] == "open", "Žádost už je uzavřená.")
            attendance = self.repo.one(
                "attendance_records", id=data["attendance_record_id"]
            )
            require(
                attendance["student_id"] == request["student_id"]
                and attendance["status"] != "present",
                "Položka musí odkazovat na absenci žáka žádosti.",
            )
            if old:
                conflict(
                    old["decision"] != "pending",
                    "O rozhodnuté položce nelze měnit poznámku běžným PATCH.",
                )

    def validate_attendance(self, data: dict[str, Any], lesson: dict[str, Any]) -> None:
        duration = (
            instant(lesson["ends_at"]) - instant(lesson["starts_at"])
        ).total_seconds() / 60
        late, missed = data.get("late_minutes") or 0, data.get("missed_minutes") or 0
        require(
            0 <= late <= duration and 0 <= missed <= duration,
            "Neplatný počet minut docházky.",
        )
        require(
            (data["status"] == "late" and late > 0)
            or (data["status"] != "late" and late == 0),
            "Neplatný počet minut zpoždění.",
        )
        require(
            data["status"] != "present" or missed == 0,
            "Přítomný žák nemá zameškané minuty.",
        )
        require(
            data["status"] != "released_early" or missed > 0,
            "Předčasný odchod vyžaduje zameškané minuty.",
        )
        require(
            data["status"] != "absent" or missed == duration,
            "Celá absence musí odpovídat délce výuky.",
        )
        require(
            data["status"] != "late" or missed == 0,
            "Zpoždění eviduj pouze ve zpožděných minutách.",
        )

    def validate_delete(self, old: dict[str, Any], actor: AccessContext) -> None:
        if self.resource.name in {"absence_excuse_requests", "absence_excuse_items"}:
            conflict(
                True, "Žádosti a rozhodnutí tvoří historii; použij stažení žádosti."
            )
        if self.resource.name == "classbook_entries":
            self.signed_guard(actor, old)
            conflict(old["status"] == "signed", "Podepsaný zápis nelze odstranit.")
            conflict(
                bool(
                    self.repo.rows("attendance_records", classbook_entry_id=old["id"])
                ),
                "Zápis má docházku a nelze jej odstranit.",
            )
            for row in self.repo.rows(
                "classbook_participants", classbook_entry_id=old["id"]
            ):
                participant = self.repo.entity(
                    ClassbookParticipants,
                    {
                        "classbook_entry_id": old["id"],
                        "student_id": row["student_id"],
                    },
                )
                self.repo.remove(participant)
            self.repo.flush()
        else:
            lesson = self.repo.one("classbook_entries", id=old["classbook_entry_id"])
            self.signed_guard(actor, lesson)
            if self.resource.name == "attendance_records":
                conflict(old["is_excused"], "Omluvenou docházku nelze odstranit.")

    def after_write(
        self,
        data: dict[str, Any] | None,
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        if self.resource.name == "classbook_entries" and data and old is None:
            day = instant(data["starts_at"]).astimezone(SCHOOL_ZONE).date()
            for student in group_students(self.repo, data["group_id"], day):
                self.repo.add(
                    ClassbookParticipants(
                        classbook_entry_id=data["id"], student_id=student
                    )
                )
            self.repo.flush()

    def sign(self, actor: AccessContext, entry_id: Any) -> Any:
        def action(fresh: AccessContext) -> Any:
            self.repo.lock_records("entry:" + str(entry_id))
            entity = self.repo.entity(ClassbookEntries, {"id": entry_id})
            old = entity.model_dump()
            self.owns_lesson(fresh, old)
            require(
                old["status"] == "draft" and bool((old["topic"] or "").strip()),
                "Podpis vyžaduje návrh s tématem.",
            )
            entity.status, entity.signed_by, entity.signed_at = (
                "signed",
                fresh.user.id,
                utcnow(),
            )
            self.touch(entity, fresh)
            self.repo.flush()
            self.audit(fresh, entity, "updated", old)
            return entity

        return self.transaction(actor, "classbook.write", action)

    def mark(
        self,
        actor: AccessContext,
        entry_id: Any,
        payload: BaseModel,
        *,
        _actor: AccessContext | None = None,
    ) -> Any:
        from .resources import RESOURCES

        # The same audited CRUD path validates teacher ownership and roster membership.
        data = payload.model_dump()
        data["classbook_entry_id"] = entry_id
        resource = next(r for r in RESOURCES if r.name == "attendance_records")
        service = ClassbookDomainService(self.repo.db, resource)

        def action(fresh: AccessContext) -> Any:
            self.repo.lock_records("entry:" + str(entry_id))
            rows = self.repo.rows(
                "attendance_records",
                classbook_entry_id=entry_id,
                student_id=data["student_id"],
            )
            if rows:
                entity = self.repo.entity(AttendanceRecords, {"id": rows[0]["id"]})
                old = entity.model_dump()
                merged = old | data
                service.validate(merged, old, fresh)
                for key, value in merged.items():
                    setattr(entity, key, value)
                service.touch(entity, fresh)
                operation = "updated"
            else:
                service.validate(data, None, fresh)
                entity = AttendanceRecords.model_validate(
                    data | {"recorded_by": fresh.user.id}
                )
                self.repo.add(entity)
                old, operation = None, "created"
            self.repo.flush()
            service.audit(fresh, entity, operation, old)
            return entity

        if _actor is not None:
            return action(_actor)
        return self.transaction(actor, "attendance.mark", action)

    def mark_many(
        self,
        actor: AccessContext,
        entry_id: Any,
        payloads: list[BaseModel],
    ) -> list[Any]:
        students = [payload.model_dump()["student_id"] for payload in payloads]
        require(len(students) == len(set(students)), "Žák je v dávce vícekrát.")

        def action(fresh: AccessContext) -> list[Any]:
            return [
                self.mark(actor, entry_id, payload, _actor=fresh)
                for payload in payloads
            ]

        return self.transaction(actor, "attendance.mark", action)

    def request_excuse(
        self,
        actor: AccessContext,
        student_id: Any,
        reason: str,
        record_ids: list[Any],
    ) -> Any:
        def action(fresh: AccessContext) -> Any:
            self.repo.lock_records("student:" + str(student_id))
            require(
                self.owns_student(fresh, student_id),
                "Žádost může podat žák nebo jeho rodič.",
            )
            require(
                len(set(record_ids)) == len(record_ids) and bool(record_ids),
                "Seznam absencí je prázdný nebo duplicitní.",
            )
            entity = AbsenceExcuseRequests(
                student_id=student_id, requested_by=fresh.user.id, reason=reason
            )
            self.repo.add(entity)
            self.repo.flush()
            for record_id in record_ids:
                attendance = self.repo.one("attendance_records", id=record_id)
                lesson = self.repo.one(
                    "classbook_entries", id=attendance["classbook_entry_id"]
                )
                require(
                    lesson["status"] == "signed",
                    "Žádost vyžaduje docházku z podepsané hodiny.",
                )
                require(
                    attendance["student_id"] == student_id
                    and attendance["status"] != "present"
                    and not attendance["is_excused"],
                    "Požadována je neomluvená absence daného žáka.",
                )
                pending = self.repo.rows(
                    "absence_excuse_items", attendance_record_id=record_id
                )
                conflict(
                    any(
                        i["decision"] == "pending"
                        and self.repo.one(
                            "absence_excuse_requests", id=i["request_id"]
                        )["status"]
                        == "open"
                        for i in pending
                    ),
                    "Absence už má otevřenou žádost.",
                )
                self.repo.add(
                    AbsenceExcuseItems(
                        request_id=entity.id, attendance_record_id=record_id
                    )
                )
            self.repo.flush()
            self.audit(fresh, entity, "created", None)
            return entity

        return self.transaction(actor, "attendance.request", action)

    def decide(
        self,
        actor: AccessContext,
        request_id: Any,
        record_id: Any,
        decision: str,
        note: str | None,
    ) -> Any:
        def action(fresh: AccessContext) -> Any:
            request_data = self.repo.one("absence_excuse_requests", id=request_id)
            record_data = self.repo.one("attendance_records", id=record_id)
            self.repo.lock_records(
                "student:" + str(request_data["student_id"]),
                "entry:" + str(record_data["classbook_entry_id"]),
            )
            request = self.repo.entity(AbsenceExcuseRequests, {"id": request_id})
            require(request.status == "open", "Žádost už je uzavřená.")
            item = self.repo.entity(
                AbsenceExcuseItems,
                {"request_id": request_id, "attendance_record_id": record_id},
            )
            conflict(item.decision != "pending", "Položka už má rozhodnutí.")
            record = self.repo.entity(AttendanceRecords, {"id": record_id})
            lesson = self.repo.one("classbook_entries", id=record.classbook_entry_id)
            group = self.repo.one("teaching_groups", id=lesson["group_id"])
            day = instant(lesson["starts_at"]).astimezone(SCHOOL_ZONE).date()
            classes = {
                c["id"]
                for c in self.repo.rows("classes", class_teacher_id=fresh.user.id)
                if c["school_year_id"] == group["school_year_id"]
            }
            allowed = any(
                e["class_id"] in classes and active_on(e, day)
                for e in self.repo.rows(
                    "class_enrollments", student_id=record.student_id
                )
            )
            authorize(
                "classbook.manage" in fresh.permissions
                or (fresh.school_role_code == "teacher" and allowed),
                "Absenci může omluvit třídní učitel žáka.",
            )
            require(
                record.student_id == request.student_id and record.status != "present",
                "Absence nepatří žádosti.",
            )
            old_request = request.model_dump()
            old_record = record.model_dump()
            old_item = item.model_dump()
            item.decision, item.decision_note = decision, note
            item.decided_by, item.decided_at = fresh.user.id, utcnow()
            if decision == "approved":
                conflict(
                    record.is_excused, "Absence už byla omluvena jiným rozhodnutím."
                )
                record.is_excused, record.excuse_reason = True, request.reason
                record.excused_by, record.excused_at = fresh.user.id, utcnow()
                record.updated_at = utcnow()
            self.repo.flush()
            items = self.repo.rows("absence_excuse_items", request_id=request_id)
            if all(i["decision"] != "pending" for i in items):
                request.status, request.closed_at = "closed", utcnow()
                request.updated_at = utcnow()
            from .resources import RESOURCES

            for name, entity, before in (
                ("absence_excuse_items", item, old_item),
                ("attendance_records", record, old_record),
                ("absence_excuse_requests", request, old_request),
            ):
                service = ClassbookDomainService(
                    self.repo.db, next(r for r in RESOURCES if r.name == name)
                )
                service.audit(fresh, entity, "updated", before)
            self.repo.flush()
            return item

        return self.transaction(actor, "attendance.excuse", action)

    def withdraw(self, actor: AccessContext, request_id: Any) -> Any:
        def action(fresh: AccessContext) -> Any:
            request_data = self.repo.one("absence_excuse_requests", id=request_id)
            self.repo.lock_records("student:" + str(request_data["student_id"]))
            entity = self.repo.entity(AbsenceExcuseRequests, {"id": request_id})
            require(
                entity.requested_by == fresh.user.id,
                "Žádost může stáhnout její žadatel.",
            )
            require(entity.status == "open", "Žádost už není otevřená.")
            old = entity.model_dump()
            entity.status, entity.closed_at, entity.updated_at = (
                "withdrawn",
                utcnow(),
                utcnow(),
            )
            self.repo.flush()
            self.audit(fresh, entity, "updated", old)
            return entity

        return self.transaction(actor, "attendance.request", action)
