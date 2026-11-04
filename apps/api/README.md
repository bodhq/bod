# bod API

FastAPI služba pro školní informační systém bod. Python balíček se jmenuje `server`.

## ER model a rozdělení backendu

Zdrojový ER návrh je uložený v `schema/bod.dbml`. Backend používá společné
`core` pro účty, autentizaci, oprávnění, audit, transakce a chyby. Doménové
tabulky, DTO, endpointy a pravidla jsou v modulech:

| Modul | Obsah | Oprávnění pro obecnou správu |
| --- | --- | --- |
| `school` | Školní roky, třídy, zařazení, rodiče, předměty a skupiny | `school.manage` |
| `rooms` | Místnosti, graf přesunů a nedostupnost | `rooms.manage` |
| `timetable` | Plány výuky, vlastní cykly, kalendář, varianty a suplování | `timetable.edit`, pro suplování `timetable.substitute` |
| `classbook` | Třídnice, historické seznamy žáků, docházka a omluvenky | `classbook.manage` |

Každý modul odděluje tabulky, vstupní/výstupní schémata, router a doménovou
službu. SQL dotazy jsou v repozitářích. Společné CRUD transakce v `core/domain`
ověří aktuální relaci a oprávnění pod stejným transakčním zámkem jako změny
rolí, provedou doménovou validaci, změnu a audit. Selhání vrátí celou změnu zpět.

Rozvrh používá přímo `models.py`, `schemas.py`, `router.py`, `services.py` a
`repository.py`. Původní model `Lesson`, jeho DTO, repozitář, služba a endpoint
`GET /timetable/{class_id}` jsou odstraněné. Rozvrh obsluhuje
`GET /timetable/schedule` nad UUID identitami a verzovanými plány.
Na nové instalaci se tabulka `lesson` nevytváří. Případná existující tabulka
zůstává fyzicky zachovaná, aby odstranění starého kódu nesmazalo uložená data.
Seed připravuje katalog oprávnění a prvního správce; školní data se zadávají
přes doménové API.

## Endpointy

Všechny níže uvedené cesty mají prefix `/api/v1`. Interaktivní úplný kontrakt
je v `/docs`. Kolekce používají `offset` a `limit` (nejvýše 100); položky s
vícesloupcovým klíčem mají jednotlivé části klíče v cestě. Vstupy zakazují
neznámá pole. Auditní identity, časová razítka a rozhodnutí nastavuje server.

- `/school/school-years`, `/classes`, `/class-enrollments`, `/parent-students`,
  `/specializations`, `/subjects`, `/group-divisions`, `/teaching-groups`,
  `/teaching-group-memberships`, `/group-specialization-rules` pod `/school`.
- `/rooms` pro místnosti; `/rooms/room-types`, `/rooms/group-home-rooms`,
  `/rooms/room-distance-models`, `/rooms/room-connections`, `/rooms/room-unavailability`
  pro jejich navázané evidence.
- `/timetable/teaching-plans`, `/teaching-cycle-weeks`, `/teaching-cycle-steps`,
  `/teaching-plan-calendar-weeks`, `/teaching-plan-calendar-days`,
  `/teaching-assignments`, `/teaching-assignment-weeks`, `/teaching-blocks`,
  `/teaching-block-members`, `/teacher-unavailability`, `/time-grids`,
  `/time-slots`, `/timetable-versions`, `/timetable-entries`,
  `/timetable-preferences`, `/lesson-occurrences`, `/lesson-changes` pod `/timetable`.
- `/classbook/classbook-entries`, `/classbook-participants`, `/attendance-records`,
  `/absence-excuse-requests`, `/absence-excuse-items` pod `/classbook`.

Kolekce mají GET/POST, položky GET/DELETE a tam, kde mají měnitelná pole, PATCH.
Mazání nebo běžný PATCH nezpřístupňuje změny publikované historie ani přechody
stavů, které mají vlastní operaci:

| Metoda a cesta | Chování |
| --- | --- |
| `POST /school/group-divisions/{id}/generate` | Abecední dělení nebo dělení podle uložených pravidel zaměření; přepočet vyžaduje `confirm_recompute` a zachová minulé intervaly |
| `POST /timetable/teaching-plans/{id}/regenerate-calendar` | Přegeneruje automatické týdny, zachová ruční výjimky |
| `POST /timetable/timetable-versions/{id}/publish` | Ověří kalendář, úvazky, bloky, kapacity, nedostupnosti a kolize; zmrazí závislosti |
| `POST /timetable/timetable-versions/{id}/close` | Zkrátí platnost publikované verze a archivuje ji; neodřízne uložené hodiny |
| `POST /timetable/timetable-versions/{id}/clone` | Založí nový upravitelný plán a návrh včetně cyklu, kalendáře, úvazků, bloků a položek |
| `GET /timetable/schedule?date_from=…&date_to=…` | Konkrétní výuka po započtení suplování; konec je výlučný, maximálně 93 dní |
| `POST /timetable/materialize` | Učitel založí konkrétní instanci své hodiny pro třídnici |
| `POST /classbook/lessons` | Učitel zapíše vlastní skutečnou výuku a uloží seznam jejích žáků |
| `PATCH /classbook/lessons/{id}` | Oprava vlastní výuky; podepsaná vyžaduje `classbook.correct` |
| `POST /classbook/classbook-entries/{id}/sign` | Podepíše vlastní zápis s neprázdným tématem |
| `PUT /classbook/classbook-entries/{id}/attendance` | Založí nebo upraví docházku jednoho žáka ze seznamu hodiny |
| `POST /classbook/excuse-requests` | Žák nebo jeho rodič požádá o omluvení konkrétních neomluvených absencí |
| `POST /classbook/excuse-requests/{id}/items/{record_id}/decide` | Oprávněný třídní učitel rozhodne o položce a atomicky změní docházku |
| `POST /classbook/excuse-requests/{id}/withdraw` | Žadatel stáhne otevřenou žádost |
| `GET /classbook/my-lessons` | Vlastní výuka učitele nebo podepsaná výuka žáka a jeho rodiče |
| `GET /classbook/my-attendance?student_id=…` | Docházka vlastní nebo propojeného dítěte |
| `GET /classbook/my-excuse-requests` | Žádosti přihlášeného žadatele |

`timetable.read` dovoluje žákovi číst vlastní výuku, rodiči výuku propojených
dětí a učiteli jeho výuku. Globální přístup správce rozvrhu vyžaduje
`timetable.edit`. Drafty jsou dostupné pouze správě rozvrhu. U třídnice se
samostatně ověřuje aktivní role, vlastnictví výuky, členství v historickém
seznamu nebo vazba rodiče. Omluvení kontroluje třídu žáka k datu výuky a jejího
přiřazeného třídního učitele.

Katalog nových oprávnění se migruje, ale existující role je automaticky
nedostanou. Správce účtů je může přiřadit vlastní provozní roli přes existující
API rolí. Výchozí administrátor zůstává účtem pro správu účtů a oprávnění.
Měnící požadavky používají dosavadní ochranu Origin / `X-Requested-With: bod`.

## Vlastní týdenní cyklus

`teaching_cycle_weeks` pojmenovává typy týdnů. Jejich `position` je pořadí
zobrazení. Skutečné opakování určuje `teaching_cycle_steps`: souvislá posloupnost
od 1 a kladné `duration_weeks`. Délka cyklu je součet délek kroků.
Například kroky A na 2 týdny a B na 1 týden dávají A,A,B,A,A,B.
Stejný typ může být ve více krocích, například A,B,A,C.

Začátek prvního kroku je `teaching_plans.cycle_anchor_monday`. Výpočet funguje
i pro týdny před kotvou. Změna kroků nebo kotvy přepočítá automatické řádky
kalendáře návrhu. `is_override=true` zachová ručně zvolený konkrétní týden a
neposune další fáze. Výjimka výukového dne nepřerušuje cyklus. Publikovaný plán
se neupravuje; nejprve se naklonuje do nového návrhu.

## Migrace

Startup spouští transakční migraci `20261102_05_school_er_model` přes existující
`schema_migrations`. Zachovává účty, relace, audit a původní rozvrhová data.
PostgreSQL navíc vynucuje intervalové EXCLUDE constraints a ochranu zmrazených
závislostí pomocí triggerů. První instalace vyžaduje možnost vytvořit rozšíření
`btree_gist`, případně jeho předchozí instalaci správcem databáze do `public`.

Migrace `20261102_06_rooms_permission` převádí stávající ruční přidělení
oprávnění správy místností na `rooms.manage`.

## Kontrakt a chyby

Přesné vstupy a jejich limity jsou v [OpenAPI](schema/openapi.json), generovaném
z FastAPI. Kontrakt a validační odpovědi ověřuje `tests/test_http_validation.py`.
Při PATCH vynechané pole zachová hodnotu; `null` je povolené pouze tam,
kde ho schéma přijímá. Oprávnění, existence záznamů a doménová pravidla
se ověřují na serveru.

Neplatné vstupy vracejí HTTP 422 s `error.code: VALIDATION_ERROR` a polem
`error.details`. Každá položka obsahuje `location`, `message` a `type`;
zaslané hodnoty ani tělo požadavku se v chybě nevracejí. Doménové chyby
používají `error.message` a mohou `details` vynechat.

Instalaci, generování klienta a spuštění popisuje [vývoj](../../docs/development.md),
rozsah sad včetně PostgreSQL/Redis integrací a vyřazených starých testů
[testování](../../docs/testing.md). Provoz školního serveru popisuje
[nasazení](../../docs/deployment.md).
