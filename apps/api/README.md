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
rozsah sad včetně PostgreSQL/Redis integrací a regresních scénářů
[testování](../../docs/testing.md). Provoz školního serveru popisuje
[nasazení](../../docs/deployment.md).

## Správa rozvrhů pro editor

`GET /api/v1/timetable/timetable-versions/{id}/overview` vrací úplný přehled
jedné varianty: verzi, plán, typy týdnů, seřazené zvonění, zadání výuky
s názvy skupin, předmětů a učitelů, položky s označením učeben a úvazky.
U každého zadání a typu týdne vrací `required_periods`, `scheduled_periods`
a `remaining_periods`. Kladný zbytek znamená chybějící hodiny, záporný hodiny
navíc. Chybějící úvazek pro typ týdne se počítá jako nula. `editable` popisuje
možnost změny položek varianty, `plan_editable` možnost změny jejího plánu.
Publikovaný plán může být zmrazený i pro další návrh varianty; pro změnu
zadání použij existující operaci klonování.

`GET /api/v1/timetable/timetable-versions/{id}/publication-check` provede
stejnou doménovou kontrolu jako publikování a vrátí `can_publish` a první
blokující problém v `issues` (`code`, česká `message`). Po opravě opakuj
kontrolu. Operace nemění rozvrh, audit ani zmrazení závislostí. Výsledek
popisuje aktuální stav dat; publikování jej znovu ověří v transakci.
Oba přehledy vyžadují `timetable.edit`; publikování dál samostatně vyžaduje
`timetable.publish`. `can_publish` vyjadřuje připravenost dat, nikoli oprávnění
aktuálního uživatele publikovat.

Seznamy podporují následující volitelné filtry. Kombinují se pomocí AND a
aplikují se **před** `offset` a `limit`; bez filtrů zůstává původní chování.

| Kolekce pod `/api/v1/timetable` | Filtry |
| --- | --- |
| `teaching-plans` | `school_year_id` |
| `teaching-assignments` | `teaching_plan_id`, `group_id`, `teacher_id` |
| `teaching-cycle-weeks` | `teaching_plan_id` |
| `teaching-assignment-weeks` | `teaching_assignment_id` |
| `timetable-versions` | `teaching_plan_id`, `status` (`draft`, `published`, `archived`) |
| `timetable-entries` | `timetable_version_id`, `cycle_week_id` |
| `time-slots` | `time_grid_id` |

Například `GET /api/v1/timetable/timetable-entries?timetable_version_id=UUID&cycle_week_id=UUID`.
Odpovědi seznamů zůstávají pole; pořadí je stabilní podle primárního klíče.

Přehledy využívají vazby ER modelu mezi `teaching_plans`,
`teaching_assignments`, `timetable_versions`, `timetable_entries`, `time_slots`
a katalogy. Nemění databázové tabulky. Současné rozšíření modelu o cykly týdnů
zůstává zachované: hodinové úvazky jsou v `teaching_assignment_weeks`, nikoli
v jednom `weekly_periods` na zadání, a položky nesou `cycle_week_id`.

Testy těchto rozšíření lze spustit z kořene repozitáře:
`uv run python -m pytest tests/api/domain/test_timetable_management.py --no-cov`.
Používají izolované databázové fixtures ze společné backendové sady.

## Dokončené postupy třídnice a suplování

- `GET /classbook/lessons/{id}` vrací zápis, historický seznam účastníků,
  jejich jména a docházku. Učitel čte vlastní hodinu, správce všechny. Žák a
  propojený rodič vidí jen podepsanou hodinu a své účastníky. Pole `note` je
  interní: veřejné přehledy je vracejí jako `null`.
- `PUT /classbook/lessons/{id}/attendance` přijímá `records` (1–500 položek)
  a uloží celou dávku atomicky. Duplicitní žáci a žáci mimo seznam se odmítnou.
  Celá absence má délku hodiny; vynechané `missed_minutes` ji automaticky doplní.
- `DELETE /classbook/lessons/{id}` odstraní vlastní prázdný návrh i s odvozenými
  účastníky. Zápis s docházkou a podepsanou výuku nelze smazat.
- `GET /classbook/excuse-inbox` stránkuje otevřené žádosti s položkami čekajícími
  na rozhodnutí přihlášeného třídního učitele. `GET /classbook/excuse-requests/{id}`
  vrací oprávněnému žadateli nebo učiteli detail položek, absencí a rozhodnutí.
  Učitel v detailu vidí pouze položky, ke kterým má vztah třídního učitele.
- `GET /classbook/my-children` vrací identifikátory a jména propojených dětí.
- `my-lessons` a `my-attendance` podporují `date_from`, výlučný `date_to`,
  `offset` a `limit`. Docházka žáka se zveřejní až s podpisem hodiny.
  `my-excuse-requests` podporuje stránkování a filtr `status`.

`PATCH /classbook/lessons/{id}` i obecný PATCH zápisu vyžadují
`expected_updated_at` z posledního načtení. Oprava podepsaného zápisu navíc
vyžaduje `classbook.correct` a `correction_reason`; důvod se ukládá do auditu.
Identitu, termín a stav zápisu nelze poslat běžným PATCH. Založení mimořádné
výuky vyžaduje vlastní zadání pro předmět a skupinu nebo `classbook.manage`.
Překryv vlastního učitele nebo skupiny se odmítne.

PATCH položky rozvrhu vyžaduje `expected_state`, tedy úplný naposledy načtený
objekt položky včetně `id`. Zastaralý stav vrátí 409; klient musí načíst aktuální
data. Pouhé opakování požadavku nesmí přepsat mezitím uloženou změnu.

`GET /timetable/schedule` obsahuje také názvy skupin, předmětů, učitelů a učeben,
původní termín, učitele a místnost a `change_type`. `include_cancelled=true`
zahrne zrušené hodiny; výchozí chování je dál vynechává. Rozsah se uplatní při
rozvíjení rozvrhu a zohlední i hodiny přesunuté z jiného období.
`unresolved_reasons` označuje nedostupného učitele nebo místnost. Nedostupnost
lze uložit před vyřešením suplování; nová publikace stále vyžaduje její vyřešení.
Změna konkrétní hodiny ověřuje dostupnost jejího výsledného obsazení. Zadání
s požadovaným typem místnosti nelze publikovat bez přiřazené učebny.

Nové instalace mají provozní oprávnění třídnice u výchozích rolí. Existující
ručně upravené role se nepřepisují. Vlastní roli lze přes API přiřadit
`school_role_code` (`student`, `parent`, `teacher`); identita určuje školní
vztahy, oprávnění dál pocházejí výhradně z aktivní role. Oprávnění
`timetable.generate` bylo odstraněno, protože generátor není implementovaný.
Preference a graf vzdáleností jsou zatím uložené podklady pro budoucí výpočet.

Migrace `20261113_07_annual_intervals` ohraničí dříve otevřená zařazení,
členství a verze rozvrhu koncem jejich školního roku. Nové zápisy používají
stejné pravidlo. `20261113_08_domain_locks` odděluje sdílený autorizační zámek
od zámku školních dat; nezávislé zápisy třídnice používají vlastní zámky hodin.
Změny rolí zůstávají exkluzivní vůči probíhajícím zápisům.
`20261113_09_role_scopes` přidává školní identitu vlastních rolí a odstraňuje
neimplementované oprávnění generování. Všechny kroky jsou transakční.

Změna katalogových údajů nevyhodnocuje historickou výuku podle současné
kapacity nebo aktivity místnosti. Kontroly budoucí výuky zůstávají zachované.
