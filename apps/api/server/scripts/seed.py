from sqlmodel import Session, select

from server.core.database import engine
from server.modules.timetable.models import Lesson


def seed_db() -> None:
    with Session(engine) as session:
        # Check if we already have some lessons
        lesson = session.exec(select(Lesson).limit(1)).first()
        if not lesson:
            print("Základám testovací hodiny do databáze...")
            l1 = Lesson(
                class_id=1,
                subject="Matematika",
                teacher_id=1,
                room="U2",
                day=1,
                start_time="08:00",
                end_time="08:45",
            )
            l2 = Lesson(
                class_id=1,
                subject="Český jazyk",
                teacher_id=2,
                room="U1",
                day=1,
                start_time="08:55",
                end_time="09:40",
            )
            session.add(l1)
            session.add(l2)
            session.commit()
            print("Testovací data úspěšně vytvořena.")
        else:
            print("Databáze již obsahuje data. Seedování přeskočeno.")

if __name__ == "__main__":
    seed_db()
