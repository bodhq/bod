PERMISSIONS = {
    "profile.self.read": "Číst vlastní profil",
    "profile.self.update": "Upravit vlastní osobní údaje",
    "timetable.read": "Zobrazovat rozvrh",
    "timetable.edit": "Upravovat návrhy rozvrhu",
    "timetable.generate": "Generovat varianty rozvrhu",
    "timetable.publish": "Publikovat rozvrh",
    "timetable.substitute": "Spravovat suplování",
    "users.manage": "Vytvářet, upravovat a spravovat účty",
    "roles.manage": "Spravovat role a jejich oprávnění",
    "audit.read": "Číst auditní záznamy",
}
ADMIN_PERMISSIONS = {"users.manage", "roles.manage", "audit.read"}
PROFILE_PERMISSIONS = {"profile.self.read", "profile.self.update"}
DEFAULT_ROLES = {
    "student": ("Žák", PROFILE_PERMISSIONS | {"timetable.read"}),
    "parent": ("Rodič", PROFILE_PERMISSIONS | {"timetable.read"}),
    "teacher": ("Učitel", PROFILE_PERMISSIONS | {"timetable.read"}),
    "admin": ("Administrátor", PROFILE_PERMISSIONS | ADMIN_PERMISSIONS),
}
