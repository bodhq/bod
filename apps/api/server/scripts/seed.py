from sqlmodel import Session, select

from server.core.database import engine
from server.modules.timetable.models import Lesson
from server.core.users.models import User, Role
from server.core.security import get_password_hash

def seed_db() -> None:
    with Session(engine) as session:
        # Create Admin User if doesn't exist
        admin = session.exec(select(User).where(User.username == "admin")).first()
        if not admin:
            print("Vytvářím výchozího administrátora (admin/admin)...")
            admin_user = User(
                username="admin", 
                hashed_password=get_password_hash("admin"), 
                role=Role.ADMIN
            )
            session.add(admin_user)
            session.commit()
            print("Administrátor úspěšně vytvořen.")
        else:
            print("Administrátor (admin) již existuje.")

        # Check if we already have some lessons
        lesson = session.exec(select(Lesson).limit(1)).first()
        if not lesson:
            print("Základám Prod-Grade testovací data (Seed)...")
            
            """
            ONBOARDING PRO VÝVOJÁŘE:
            Proč potřebujeme Seed data?
            V Enterprise aplikacích musí mít každý vývojář na svém notebooku 
            okamžitě dostupná stejná data jako kolega. Slouží to k rychlému 
            vývoji UI a plně izolovanému (deterministickému) End-to-End testování.
            Když se aplikace zapne v kontejneru poprvé, musí se naplnit fakovými daty.
            """
            
            lessons_data = [
                {
                    "class_id": 1, "subject": "Matematika", "teacher_id": 1, 
                    "room": "U2", "day": 1, "start_time": "08:00", "end_time": "08:45"
                },
                {
                    "class_id": 1, "subject": "Český jazyk", "teacher_id": 2, 
                    "room": "U1", "day": 1, "start_time": "08:55", "end_time": "09:40"
                },
                {
                    "class_id": 1, "subject": "Anglický jazyk", "teacher_id": 3, 
                    "room": "U3", "day": 1, "start_time": "09:55", "end_time": "10:40"
                },
                {
                    "class_id": 1, "subject": "Fyzika", "teacher_id": 4, 
                    "room": "LAB1", "day": 1, "start_time": "10:50", "end_time": "11:35"
                },
                {
                    "class_id": 1, "subject": "Tělesná výchova", "teacher_id": 5, 
                    "room": "TV1", "day": 1, "start_time": "11:45", "end_time": "12:30"
                },
                {
                    "class_id": 1, "subject": "Tělesná výchova", "teacher_id": 5, 
                    "room": "TV1", "day": 1, "start_time": "12:40", "end_time": "13:25"
                },
            ]
            
            for l_data in lessons_data:
                session.add(Lesson(**l_data))
                
            session.commit()
            print("Testovací rozvrh (6 hodin) úspěšně vytvořen.")
        else:
            print("Databáze již obsahuje rozvrh. Seedování přeskočeno.")


if __name__ == "__main__":
    seed_db()
