# Produktový audit: backend, školní postupy a vizualizace

Stav k 16. 11. 2026. Posouzení vychází z aktuálního kódu, OpenAPI,
čtení běžící izolované školy a oficiálních podkladů MŠMT, právních předpisů
a nápovědy Bakalářů. Hlavní provozní kontext je česká střední škola.
Základní škola, zejména první stupeň, vyžaduje samostatné dopracování postupů.

Projekt má funkční základ pro rozvrh, učebny, skupiny a zápis hodin. Ještě
nepokrývá celý životní cyklus školní evidence ani všechny možnosti vlastního
backendu. Předchozí [UX audit](ux-audit.md) ověřoval čitelnost a technické
scénáře; nepotvrzoval úplnost školního systému ani právní soulad celé instalace.

## Integrační kontrola 20. 11. 2026

Aktuální frontend byl spojen s backendovým commitem `9b73d1c6` z `develop`.
Evidence rozlišuje obory studia a zaměření, zařazení žáka obsahuje obě vazby
a automatické dělení skupin podporuje také pravidla podle oboru. Správa prostorů
nabízí sdílené budovy, patra a umístění učebny včetně souřadnic a rozměrů.
Model přesunů je při založení varianty rozvrhu volitelný.

V izolované PostgreSQL škole bylo ověřeno vytvoření oboru, navázaného zaměření,
budovy a patra, umístění existující učebny, čtení agregovaného plánu budovy
a zobrazení nových evidencí po obnovení stránky. Kontrolní záznamy byly odstraněny
a původní umístění učebny obnoveno. Opravené je zalamování drobečkové navigace
a prostor pro první řádek docházky na nízkém mobilním displeji.

Sdílené umístění učebny a místní editor pravidel přesunů jsou samostatné pohledy.
Editor přesunů dál uchovává vlastní pracovní dokument v prohlížeči; nová evidence
budov jej automaticky nemigruje ani nepřepočítává. Automatický optimalizátor,
uzávěrky třídnice a archivní výstupy zůstávají nedokončené. Projekt je funkční
vývojová aplikace pro ověřené postupy, nikoli dokončený systém pro ostrý provoz školy.

Bezpečnostní aktualizace Next.js z 16.4.1 na 16.4.5 řeší nálezy objevené při
této kontrole. Starší závěry níže zachycují audit z 16. 11.; dostupnost sdílených
budov, pater a oborů se od té doby změnila.

## Stav realizace po navazujících opravách

Opravené jsou názvy dnešních hodin učitele a napojení editoru na přehled
varianty. Sdílené názvy z rozvrhu používá úvodní přehled i deník výuky.
Editor přebírá jména, úvazky i možnost úprav ze serveru, zobrazuje také hodiny
nad požadovaný úvazek a při přepnutí varianty zahodí výběr předchozí varianty.
Číselníky pro kontrolu skupin a učeben dál respektují vlastní oprávnění.

Příprava úvazků funguje i před založením varianty; zadání a týdny se načítají
s filtrem plánu. Seznam jednotlivých úvazků zatím nenabízí filtr celého plánu,
proto se v této přípravné obrazovce dokončuje výběr na klientovi.

Prošlo šest nových regresních scénářů včetně role pouze s `timetable.edit`,
chyby a opakování dotazu, respektování serverového zákazu úprav a uložení
položky s revizním stavem bez doplněných popisků. V izolované škole proběhl
skutečný PATCH, nové načtení a vrácení testovací změny. Počet různých GET cest
při otevření editoru klesl v tomto scénáři z 18 na 11 včetně přihlášení;
samotný editor používá jeden přehled místo pěti globálních seznamů.

Rodičovská a žákovská docházka používá pouze stávající kontrakt backendu.
Frontend spojuje `my-attendance` s `my-lessons`; při oprávnění `timetable.read`
získává názvy předmětu a skupiny z autorizovaného rozvrhu. Chybějící názvy
nebo termín výslovně označí jako neuvedené. Neprovádí dotazy do správy účtů.
Období má v rozhraní oba krajní dny včetně; API dostává výlučný konec.
Souhrn počítá skutečné minuty, neznámou délku výslovně přiznává. Graf
nahradil chronologický seznam s hromadnou žádostí.

Čekající stav se zobrazuje pouze pro vlastní žádosti potvrzené jejich
existujícím detailem. Žádosti jiného rodiče API v osobním seznamu neposkytuje;
frontend jejich stav neodhaduje. Duplicitní podání odmítne stávající server.
Při konfliktu se zablokuje další odeslání vybraných absencí a zachová důvod.
Změna dítěte nebo období vyžaduje potvrzení zahození rozpracovaného podání.
Nepřítomnost bez potvrzeného omluvení se neprezentuje jako konečně neomluvená.

Backend, jeho testy i OpenAPI zůstávají beze změn vůči `develop`. Dřívější
lokální rozšíření osobní docházky a přihlašovací odpovědi bylo odstraněno.
Požadavky na backend jsou podklady pro jeho vlastníka, nikoli součást této
implementace. Ověření po návratu na původní kontrakt je uvedené níže.

Prošlo 240 webových testů, lint, typy, produkční sestavení v Dockeru a 9
prohlížečových kontrol proti preview s nezměněným API z `develop`. Nad
PostgreSQL proběhlo skutečné podání a zpětvzetí omluvenky i odmítnutí duplicity
druhého rodiče. Při chybě se zachoval rozepsaný důvod. Nový přehled prošel
kontrolou axe ve světlém i tmavém režimu a šesti kombinacemi šířek 1440, 390,
320 px s běžným a dvojnásobným písmem. Testovací podání byla vzata zpět.

## Opravy mobilního a provozního rozhraní

Frontend používá mobilní menu s jediným zavřením, samostatným posouváním
navigace a viditelným odhlášením. Technický popisek „Pracovní prostor“ je
odstraněný. Přepínače agend a kroků mají na telefonu jeden výběr místo
zalamovaných řad tlačítek; stolní rozhraní zachovává přímé volby.

Docházka má na telefonu jeden kompaktní řádek na žáka. Běžná nepřítomnost
se označuje přímo, zpoždění, odchod a poznámka mají detail řádku. Číselný
vstup minut se zobrazuje při příslušném stavu. Téma hodiny lze rozbalit,
doplňkové úkony nezabírají výchozí záhlaví. Prázdný vlastní návrh lze po
potvrzení odstranit existujícím endpointem; konečné podmínky ověřuje server.

Rodičovský přehled začíná dítětem, docházkou, vlastními omluvenkami a dnešní
výukou. Učitel má svůj den; správce rozepsané zápisy tohoto měsíce a pracovní
varianty rozvrhu. Inventář školy je volitelný souhrn. Osobní nastavení je
oddělené od denních úloh. Kontext dítěte se přenáší do cílového přehledu.

Obecné evidence a učebny používají řádkové seznamy. Dekorativní časové
proužky a tečky kapacity jsou z těchto seznamů odstraněné, stejně jako
opakovaný náhled běžného formuláře. Hledání evidencí a účtů prochází všechny
povolené stránky API a přijímá text bez diakritiky. Jde o klientské hledání;
serverové hledání a filtry pro velké objemy nadále patří vlastníkovi API.

Účty a historie mají stránkování. Profil a fotografie jiného účtu mají
oprávněné ovládání přes existující API. Detail auditu ukazuje autora podle
dostupných oprávnění a změněné hodnoty před/po; citlivé klíče se nezobrazují.
Z hodiny lze s `audit.read` otevřít její historii. Vlastní omluvenka používá
jméno a detail konkrétních hodin s rozhodnutím a poznámkou školy. Položka
stažené žádosti se neprezentuje jako nadále čekající na rozhodnutí.

Backend, jeho testy a OpenAPI zůstávají shodné s `develop`. Mobilní regresní
scénář je v `tests/e2e/mobile-workflows.cjs`; běží jen nad izolovanou lokální
školou a své testovací změny docházky vrací zpět.

## Požadavky pro vlastníka backendu

- Zvážit osobní čtecí přehled docházky s kontextem hodiny a dostupným stavem
  vyřízení včetně podání druhého rodiče. Nyní frontend potřebuje více dotazů
  a bez tohoto rozšíření nedokáže předem zobrazit cizí čekající žádost.
- Zpřístupnit školní identitu právě aktivní vlastní role v odpovědi o uživateli.
  Aktuální `active_role` obsahuje pouze vlastní kód role; frontend rozpozná
  standardní `parent`, `student` a `teacher`, význam vlastního kódu nehádá.
- Navrhnout revizi docházky a atomické uložení zápisu, docházky a podpisu.
- Rozhodnout právní postavení žadatele, konečnou klasifikaci absence,
  výjimky v součtech, uzávěrky a archivní výstupy.

## Co už funguje a kde je skutečná hranice

OpenAPI obsahuje 238 operací na 119 cestách. Všechny aktuální doménové evidence
mají registraci ve frontendu: škola 10, učebny 6, rozvrh 17 a třídnice 5,
celkem 38. Porovnání názvů `RESOURCES` backendu s definicemi frontendu nenašlo
chybějící evidenci. Registrace CRUD však neprokazuje dokončený pracovní postup
ani to, že každá operace má dostupné a použitelné ovládání.

| Oblast | Implementováno | Co zbývá |
| --- | --- | --- |
| Účty a přístup | Role, oprávnění, relace, profily a fotografie, stránkování, čitelný detail auditu | Serverové filtrování a hledání pro velké objemy |
| Škola | Roky, třídy, zařazení, rodičovské vazby, předměty, skupiny a jejich platnost | Rozlišení účtu a plné matriky; právní postavení zástupce; převod do dalšího školního roku |
| Učebny | Evidence, typy, kapacity, nedostupnost a relativní náročnosti přesunů | Rozhodnout význam prostorového plánu a jeho sdílení; skutečné využití v plánování |
| Rozvrh | Cykly, kalendář, úvazky, ruční editor s přehledem varianty, publikace, uzavření, klonování, suplování | Doplnit filtry přípravné evidence úvazků a výchozí český školní kalendář |
| Třídnice | Téma, docházka, seznam účastníků, potvrzení učitelem, opravy, omluvenky, rozhodování a osobní přehled za období | Konečná klasifikace a výjimky v součtech absence, oprávnění podle právního postavení, třídní souhrny, uzávěrky a výstupy |

Automatický generátor rozvrhu implementovaný není. Preference a graf přesunů
jsou uložené podklady; nastavení jejich vah samo rozvrh nemění. Tuto hranici
uvádí i [README API](../apps/api/README.md#dokončené-postupy-třídnice-a-suplování).

Známky, vysvědčení, obecná komunikace školy, úplná školní matrika a předávání
jejích údajů MŠMT nejsou hotovými moduly tohoto backendu. Jejich absence není
pouze nedokončený frontend. Pro první provozní verzi je vhodnější dokončit
vybrané agendy a definovat jejich soužití se stávajícím systémem školy.

## Potvrzené mezery ve stávajících funkcích

### P1: názvy dnešních hodin učitele — opraveno

[`useTeacherDay`](../apps/web/src/modules/overview/hooks/useTeacherDay.ts)
při původním auditu četl názvy jen přes chráněné číselníky. Do nich běžný učitel nemá přístup,
přestože jeho rozvrh už názvy obsahuje. V prohlížeči s běžným učitelským účtem
a datem naplněného dne se u matematiky i češtiny zobrazilo „Výuka podle rozvrhu“
a chyběl název skupiny.

Realizace: názvy z autorizované odpovědi rozvrhu nyní sdílí přehled učitele
a deník výuky. Zobrazení předmětu a skupiny bez `school.manage` ověřuje
regresní test i běžící preview. Rozšíření oprávnění na celou školu nebylo potřebné.

### P1: přehled rozvrhu — napojeno

Backend nabízí `GET /timetable/timetable-versions/{id}/overview` s plánem,
pojmenovanými zadáními, zvoněním a výpočtem úvazků. Frontend ho při původním auditu nevolal.
[`useTimetableEditor`](../apps/web/src/modules/timetable/hooks/useTimetableEditor.ts)
tehdy načítal celé seznamy a teprve potom vybíral jednu variantu. Další číselníky
přidával `usePlanningData`.

V izolované škole otevření editoru vyvolalo 17 různých doménových GET cest
plus kontrolu přihlášení. Zásobník ukazoval „Vyučující bf00f83c“, zatímco
přímé volání přehledu stejné varianty vrátilo HTTP 200 a jméno „Jan Novák“.
Názvy tedy nechybějí v backendu.

Realizace: přehled varianty je nyní hlavním zdrojem editoru; používá také
serverové údaje o požadovaných a umístěných hodinách. Přípravné seznamy zadání
a týdnů dostávají filtr plánu.
Lokální náhled kolizí může zůstat; konečné rozhodnutí náleží serveru.
Nejde o provedený zátěžový test, ale o potvrzenou zbytečnou šíři načítání.

### P1: rodičovská a žákovská docházka — opraveno

[`OwnAttendance`](../apps/web/src/modules/classbook/components/OwnAttendance.tsx)
původně zobrazoval část ID místo data, předmětu a hodiny. Graf dával
pětiminutovému zpoždění a celé zameškané hodině stejnou váhu jednoho záznamu.
Nyní seznam spojuje dostupné časy a názvy ze stávajících endpointů,
skutečné minuty a vybrané období.
Hromadná žádost podporuje nejvýše 100 vybraných záznamů; neznámá délka
není započtena jako nulová nepřítomnost.

### P1: nedořešené není totéž co rozhodnuté neomluvení

Původní UI označovalo každý nepřítomný záznam s `is_excused=false` jako
„neomluveno“, i bez vyřízené žádosti. Tato zkratka je odstraněná: přehled
rozlišuje potvrzené omluvení, doloženou vlastní čekající žádost a absenci
bez potvrzeného omluvení. Trvalý model konečného rozhodnutí a stav podání
jiného rodiče zůstávají požadavkem na backend.

Doporučený model odděluje účast, vyřešení omluvy a započítání do souhrnů.
Přítomnost, absence, zpoždění a odchod nejsou stavy omluvenky. Čekající,
dosud nedoložená, omluvená a rozhodnutá neomluvená absence potřebují různé
zobrazení. Školní akci nebo jiné nezapočítávané případy nelze modelovat jen
změnou barvy.

Pravidla musí odpovídat školnímu řádu. Samotné překročení lhůty nemá bez
rozhodnutí automaticky vést k sankci. MŠMT navíc odlišuje doporučující části
metodiky od závazných pravidel a rozlišuje záškoláctví od pozdních příchodů.
[Metodika MŠMT aktualizovaná k 30. 1. 2026](https://edu.gov.cz/wp-content/uploads/2026/01/zaskolactvi-a-omlouvani-zaku_metodika.pdf).

### P1: kalendář potřebuje bezpečné výchozí nastavení

[`resolved_lessons`](../apps/api/server/modules/timetable/repository.py)
považuje bez explicitní výjimky pondělí až pátek za výukový den. Automatické
naplnění českých svátků a prázdnin není implementované. Testovací škola proto
ukazuje běžnou výuku i 17. 11.; jde o syntetický scénář, nikoli správně
připravený provozní školní kalendář.

Doporučení: při založení roku nabídnout svátky a školní prázdniny včetně
regionálního nastavení, zachovat ruční výjimky a před publikací zkontrolovat
neobvyklé výukové dny. Změny prázdnin nesmějí přepsat již potvrzenou historii.
Podklady jsou [organizace roku MŠMT](https://msmt.gov.cz/organizace-skolniho-roku)
a [zákon o svátcích](https://e-sbirka.gov.cz/sb/2000/245).

### P1: ukládání a opravy potřebují jednotnou verzi celé hodiny

Téma má ochranu `expected_updated_at`; položka rozvrhu `expected_state`.
Dávková docházka se ukládá transakčně, ale nepřijímá očekávanou revizi.
Současné dvě úpravy téže docházky proto nemají ochranu proti přepsání starším
načteným stavem srovnatelnou s tématem.

„Uložit a podepsat“ jsou na frontendu tři postupné operace: téma, docházka,
potvrzení. Při chybě docházky se potvrzení neprovede a rozepsané změny zůstanou,
ale téma už může být uložené. To je částečný výsledek, nikoli jedna transakce.
Serverová akce potvrzení sama kontroluje téma a stav návrhu, nikoli úplnost
celé docházky. Oprava potvrzené docházky vyžaduje oprávnění, ale vstup pro
její dávkový zápis nemá důvod opravy.

Doporučení: revize celé hodiny včetně seznamu účastníků a docházky, atomická
operace dokončení a zdůvodněné opravy. Test má otevřít stejnou hodinu ve dvou
relacích a ověřit, že druhé uložení staré verze skončí konfliktem.

### P2: dostupné možnosti API — doplněno

Frontend doplňuje odstranění vlastního prázdného návrhu hodiny, autorství a
rozdíl hodnot v auditu, odkaz na historii konkrétní hodiny, hledání napříč
stránkami a správu profilu a fotografie jiného účtu. GET jednotlivé položky
nebo cesty obrázků nepotřebují samostatnou obrazovku pro každý endpoint.
Serverové hledání a kontextové filtrování zůstávají požadavkem pro větší školu.

## Legislativní a provozní hranice

Školský zákon v § 28 rozlišuje třídní knihu, matriku a další dokumentaci;
třídní kniha má dokládat poskytované vzdělávání a jeho průběh. Registr účtů
s přiřazením do tříd není automaticky úplná matrika. Rozsah dokumentace
a předávání údajů řeší také vyhláška č. 364/2005 Sb.
[Školský zákon](https://e-sbirka.gov.cz/sb/2004/561),
[vyhláška o dokumentaci](https://e-sbirka.gov.cz/sb/2005/364).

Pro SŠ § 67 stanoví doložení důvodů nepřítomnosti do tří kalendářních dnů
od počátku nepřítomnosti; jedná zletilý žák nebo zákonný zástupce nezletilého.
Podrobnosti určuje školní řád. Současný model neuchovává věk ani právní
postavení zástupce: `parent_students` je pouze dvojice účtů a školní identita
`student` umožní žádost za sebe. Je nutné rozlišit žákův podnět, oprávnění
k doložení a následné rozhodnutí školy. Právo rodiče zletilého žáka na informace
nelze automaticky zaměnit s oprávněním jednat místo něj.
[Školský zákon](https://e-sbirka.gov.cz/sb/2004/561),
[metodika MŠMT](https://edu.gov.cz/wp-content/uploads/2026/01/zaskolactvi-a-omlouvani-zaku_metodika.pdf).

| Před provozní náhradou příslušné agendy vyjasnit | Stav a doporučení |
| --- | --- |
| Ohlášení nepřítomnosti před zápisem hodiny | Nyní lze žádat pouze nad docházkou podepsané hodiny. Doplnit včasné oznámení nezávislé na rychlosti zápisu učitele. |
| Zástupce a zletilost | Doplnit právní postavení, časovou platnost a oddělená oprávnění ke čtení a podání. Pouhá role rodiče nestačí. |
| Přehled absence a uzávěrka období | Doplnit pololetí, pravidla součtů, nezapočítávané případy, kontrolu úplnosti a opravu po uzávěrce. |
| Průkazná historie třídnice | Audit existuje; doplnit přístup k revizím, autorům a důvodům opravy u konkrétního záznamu. „Podepsat“ je aplikační potvrzení učitelem. |
| Dlouhodobé výstupy | Chybí ucelený čitelný export třídnice a souhrnů. Doporučit archivní výstup s metadaty a ověřit použitelnost po obnově či změně verze. |
| Uchování a provoz | Databázová záloha funguje, ale nenahrazuje dokumentový archiv. Plán uchování a případné skartace vychází z konkrétní školy, typu dokumentu a jejích pravidel. |
| Matrika a výkaznictví | Buď samostatně implementovat, nebo výslovně ponechat ve stávajícím systému a připravit potřebnou integraci. |

GDPR vyžaduje přiměřený rozsah údajů a odpovídající dobu uchování. Důvody
omluvenek mohou obsahovat zdravotní informace; nemají se bez potřeby přenášet
do běžných grafů, širokých přehledů či provozních logů. Doporučení je doplnit
účelové přístupy, pravidla uchování včetně záloh a srozumitelnou informaci
uživatelům. Pro povinnou školní evidenci nelze zpracování automaticky zakládat
na obecném souhlasu rodiče.
[GDPR, zejména čl. 5](https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX%3A32016R0679),
[stanovisko ÚOOÚ ke školství](https://uoou.gov.cz/cs/praxe-s-nadbytecnym-vyzadovanim-souhlasu-ve-skolstvi-pretrvava).

Uvedená implementační doporučení nejsou seznamem univerzálně předepsaných
obrazovek. PDF export, barevné rozlišení či konkrétní tlačítko jsou návrhy
řešení; povinnosti a způsob jejich naplnění se posuzují pro konkrétní školu.

## Provozní návaznosti

Zálohování a obnova byly technicky ověřené v předchozím smoke testu.
[Provozní návod](deployment.md) však přenechává plánování a uchování záloh
správci školy. Před ostrým provozem doplnit konkrétní automatický plán,
upozornění na neúspěch, chráněné uložení mimo server a pravidelnou zkoušku
obnovy. Tento audit jejich existenci na školním serveru nepotvrdil.

První instalace potřebuje srozumitelné sestavení provozních rolí, založení
roku, předmětů, tříd a účtů. Dostupnost jednotlivých CRUD formulářů nenahrazuje
průvodce přípravou školy nebo import ze stávajícího systému. Totéž platí pro
převod do nového roku a ukončení či přestup žáka. Tyto návaznosti mají být
součástí přijímacích scénářů první verze.

## Které vizualizace mají smysl

| Pohled | Doporučení | Důvod a náhrada |
| --- | --- | --- |
| Denní seznam hodin učitele | Ponechat a opravit názvy | Odpovídá úkolu „co teď zapsat“; doplnit skutečně chybějící zápisy. |
| Žáci v hodině s přímými volbami docházky | Ponechat | Slouží okamžitému zápisu; stav a uložení mají přednost před grafem. |
| Týdenní rozvrh a editor | Ponechat | Časové a prostorové kolize mají přirozené zobrazení v mřížce. |
| Cyklus týdnů a kalendář | Ponechat | Náhled například A,A,B s konkrétními daty vysvětluje netriviální opakování. |
| Kontrola publikace a zásobník úvazků | Ponechat | Nález vede na konkrétní problém; doplnit data a názvy z backendového přehledu. |
| Graf a barevný proužek vlastní docházky | Nahrazeno | Přehled nyní používá souhrn skutečných minut a chronologický seznam s obdobím, kontextem hodiny a stavem žádosti. |
| Obecné karty `ResourceCanvas` | Nahrazeno řádky | Seznam ukazuje základní kontext a akce; úplné údaje zůstávají v detailu. |
| Časové čárky obecných karet | Odstraněno | Datum a čas se čtou přímo, měřítko stránky se již nevydává za společnou osu. |
| Tečky `Quantity` a opakovaný živý náhled | Výrazně omezit | „32 míst“ se čte rychleji než 32 teček; náhled jen tam, kde ukáže důsledek zadání nebo chybu. |
| „Lidé, prostory a výuka“ | Přesunout do správcovského souhrnu | Inventář napříč roky není každodenní úloha učitele. „Prostory podle využití“ ve skutečnosti počítá typy místností; přejmenovat. |
| Budovy, patra a přesuny | Ponechat jako pokročilou správu | Užitečné při přípravě školy; rozmístění je lokální pomocný plán a sdílí se exportem. Server ukládá odvozené náročnosti, nikoli společný půdorys. |
| Priority budoucího výpočtu | Odložit mimo hlavní postup | Nyní nepřesouvají hodiny. Rozsáhlé nastavování nemá předcházet dokončení běžné třídnice. |

Vizuál má zůstat, pokud pomůže rozhodnout, odhalit problém nebo provést úkon.
Jednotnost má znamenat společné ovládání a pravidla, nikoli povinnou kartu
se stejnými ozdobami pro každý datový typ.

## Co převzít z pracovních postupů Bakalářů

Oficiální nápověda popisuje přímý vstup do aktuální hodiny, kontext třídy,
předmětu a učitele, historii, kopírování předchozí absence a další činnosti
nad třídnicí. To jsou vhodné pracovní vzory; není nutné přebírat celé členění
jejich rozhraní. [Zápis do třídnice](https://napoveda.bakalari.cz/wa_vyuka_tridnikn_nova.htm).

Doplnit především souhrn třídy za období, nevyřízené absence, chybějící zápisy,
hromadné vyřízení běžné omluvenky a dohledatelnou historii. Kopírování absence
má být výslovná pomůcka s možností opravy, nikoli skryté přenášení neověřeného
stavu do dalších hodin.

Bakaláři samostatně řeší období součtů absence, zámek třídnice a kontrolní
výstupy. To odpovídá chybějícímu životnímu cyklu v bod; nejde pouze o další
graf nebo formulář.
[Pololetí pro výpočet absence](https://napoveda.bakalari.cz/tk_configuration_conf_schoolyearhalves.htm),
[zámek třídnice](https://napoveda.bakalari.cz/tk_classbook_cb_lock.htm),
[kontrola absence](https://napoveda.bakalari.cz/tk_tools_tool_controlabsent.htm).

## Doporučené pořadí realizace

1. Opravit již dostupná data a ovládání: názvy dnešních hodin, přehled varianty,
   čitelné položky docházky, rozlišení čekajícího vyřízení a detail auditu.
2. Dokončit model docházky a oprávnění: právní postavení, včasné oznámení,
   klasifikace absence, vymezené období a jednotky součtů.
3. Dokončit třídnici jako evidenci: revize, souběh, atomické dokončení,
   uzávěrky, čitelné výstupy a předání do archivu školy.
4. Omezit dekorativní vizualizace, používat kontextové filtry a řádkové přehledy.
5. Ověřit celý školní rok a integraci se zbývajícími agendami. Teprve podle
   cílového rozsahu zahajovat matriku, klasifikaci či automatický generátor.

## Jak poznat dokončení první provozní verze

- Učitel a správce rozvrhu pracují s běžnými rolemi bez nutnosti získat
  oprávnění správce účtů jen kvůli jménům.
- Rodič pozná datum, předmět a délku každé absence; podání a rozhodnutí mají
  správný právní i procesní význam.
- Druhá relace nepřepíše starší docházkou novější stav; selhání dokončení
  nenechá hodinu označenou jako kompletní s neúplnými daty.
- Školní akce, prázdniny, suplování, přesun hodiny, přestup žáka a změna
  členství ve skupině zachovají správnou historickou evidenci a součty.
- Vedení najde neúplné zápisy a uzavře období; oprava má autora, důvod a revizi.
- Škola získá srozumitelný archivní výstup a obnoví jej spolu s instalací.
- Datová zkouška s více školními roky a reálným objemem záznamů ověří hledání,
  stránkování a rychlost; tato zátěžová zkouška zatím provedena nebyla.

Původní audit neměnil aplikační kód; následné opravy shrnuje stav realizace
na začátku dokumentu. Při auditu proběhlo porovnání 38 registrací
s backendem a čtení běžícího editoru i učitelského přehledu. Pro učitelský
přehled byly hodiny v prohlížeči nastavené na datum testovacích dat;
serverový čas a uložená školní data se tím neměnily. Důkazy a screenshoty jsou
v ignorovaném `.local-notes/ux-audit`, bez přístupových údajů ve verzované
dokumentaci. Dříve úspěšné technické testy se tím neruší; tato kontrola
odhaluje jinou kategorii mezer.
