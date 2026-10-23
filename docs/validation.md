# Validace API a OpenAPI kontrakt

Vstupy jsou definované v Pydantic schématech a typech parametrů FastAPI.
Kontrakt se generuje z téhož kódu; omezení není potřeba zvlášť ručně psát
do `docs/openapi.json`. Společné typy jsou v
`apps/api/server/core/validation.py`.

## Pravidla vstupů

| Vstup | Pravidla |
| --- | --- |
| Uživatelské jméno | 3–64 znaků, první znak písmeno nebo číslice, dále písmena, číslice, tečka, podtržítko a pomlčka. Okrajové mezery se odstraní, písmena převedou na malá. Při vytvoření lze jméno vynechat nebo poslat null a server je vygeneruje. |
| Přihlašovací/současné heslo | 1–1024 znaků kvůli kompatibilitě s existujícími účty. Hodnota se neořezává ani jinak nemění. |
| Nové heslo | 12–128 znaků, alespoň jeden nebílý znak. Musí se lišit od současného; to ověřuje služba proti hashi v DB. |
| Osobní jména | Nejvýše 100 znaků, bez řídicích znaků. Diakritika, apostrofy, pomlčky i jiné běžné znaky zůstávají povolené. |
| E-mail | `EmailStr`, úplná syntaktická kontrola knihovnou email-validator a nejvýše 254 znaků. Neověřuje se existence schránky ani doručitelnost přes DNS. OpenAPI uvádí `format: email`. |
| Telefon | Nejvýše 32 znaků, číslice, mezery, pomlčky a závorky; volitelné úvodní plus, první a poslední číslice. Podporuje například `+420 123 456 789` i krátké vnitřní kontakty. Neověřuje existenci čísla. |
| Kód role | 2–64 znaků, začíná malým písmenem, dále malá písmena, číslice, tečka, podtržítko nebo pomlčka. Stejné omezení platí v těle i v URL. |
| Kód oprávnění | Stejný formát, délka 2–100 znaků. Existenci v aktuálním katalogu ověřuje služba. |
| Seznam rolí | Nejvýše 20 unikátních položek. Prázdný seznam je povolený; admin může být přiřazený pouze samostatně. |
| Seznam oprávnění | Nejvýše 100 unikátních položek. Při úpravě nahrazuje celou sadu. |
| Název role | 1–100 znaků po oříznutí mezer, nesmí být prázdný ani obsahovat řídicí znaky. |
| Popis role | Volitelný, nejvýše 4000 znaků; povolené jsou nové řádky a tabulátory, jiné řídicí znaky jsou zakázané. |
| Hromadné založení | 1–100 účtů. Každá položka používá stejné schéma jako samostatné založení. |
| `is_active` | Pouze JSON `true` nebo `false`; čísla a řetězce se na boolean nepřevádějí. |
| Identifikátory účtů a relací | UUID v parametrech cesty. |
| `class_id` v rozvrhu | Celé číslo 1–2147483647. |
| Stránkování uživatelů a auditu | `offset` 0–2147483647, `limit` 1–100, výchozí hodnoty 0 a 50. Neznámé query parametry jsou odmítnuté. |
| Session cookie | Volitelný token o délce 1–128 znaků, písmena, číslice, podtržítko a pomlčka. Chybějící token nadále vede na `401`; neplatný formát na `422`. |
| Hlavičky | Origin nejvýše 2048 znaků, X-Requested-With nejvýše 64, User-Agent při loginu nejvýše 512. Měnící požadavek musí mít povolený Origin, nebo při jeho absenci `X-Requested-With: bod`; jinak vrací `403`. |
| Název souboru avataru | 32 malých hexadecimálních znaků a přípona `.webp`; pro původní soubory se stále přijímá `.png`. URL vytváří server. |

Všechny JSON vstupní objekty odmítají neznámá pole (`additionalProperties:
false`). Prázdný objekt PATCH je odmítnutý (`minProperties: 1`). Vytvoření
neúplného účtu zůstává povolené.

U osobních údajů se nejprve odstraní okrajové mezery; prázdný řetězec se
převede na `null`. Délky a formát se kontrolují nad normalizovanou hodnotou.
Hesla takovou normalizaci nepoužívají. Popisy polí v kontraktu dokumentují
výjimky, kde normalizace dovoluje více vstupních zápisů téže hodnoty.

### Vynechané pole versus null

Při PATCH platí:

- vynechané pole: ponechat aktuální hodnotu,
- osobní údaj s hodnotou `null`: vymazat údaj,
- `username`, `is_active` nebo `role_codes` s hodnotou `null`: chyba `422`,
- `role_codes: []`: odebrat všechny role, pokud to neporuší ochranu posledního správce.

Řídicí pole proto v OpenAPI nejsou povinná, ale jejich typ nepovoluje null.
`SkipJsonSchema[None]` zde skrývá pouze interní hodnotu pro vynechaná pole;
skutečně poslané null odmítá modelový validátor.

### Rozvrh

Současné HTTP API rozvrh pouze čte. Parametr třídy je validovaný a popsaný
v OpenAPI. DTO `LessonCreate` je připravené pro další práci: kladná ID,
den 1–7, čas přesně `HH:MM` v rozsahu 00:00–23:59 a konec po začátku
ve stejném dni. DTO zatím nepoužívá žádný HTTP endpoint, takže se samostatně
v kontraktu neobjevuje.

### Profilovky

Upload zůstává syrové binární tělo s Content-Type `image/jpeg`, `image/png`
nebo `image/webp`; `.jpg` i `.jpeg` používají `image/jpeg`, přijatý je i alias `image/jpg`. Limit je 5 MiB a 16 milionů pixelů, animace jsou zakázané.
Typ obrázku i jeho obsah ověřuje API; soubory se normalizují do **WebP s kvalitou 85**, do
512 × 512 px. Průhlednost se zachová a metadata se odstraní.

OpenAPI uvádí podporované typy, popis a rozšíření `x-maxSizeBytes`,
`x-maxPixels`, `x-animated`, `x-outputFormat` a `x-outputQuality`. Tato rozšíření nejsou standardní JSON Schema
validátory. Klient je může využít, server ale vždy ověřuje skutečná data
a velikost čte průběžně ze streamu. Příliš velké tělo vrací `413`, nepodporovaný
Content-Type `415`, neplatný obrázek `422`.

Původní PNG soubory zůstávají čitelné s odpovídajícím Content-Type. Při
novém uploadu se nahradí WebP a původní soubor se po commitu odstraní.
Pro jednorázový převod všech původních profilovek spusť z `apps/api`:

```sh
uv run python -m server.scripts.convert_avatars
```

Převod je opakovatelný. Nejprve zapíše nový soubor a potvrdí jeho URL v DB,
teprve potom smaže původní PNG. Databáze dál ukládá pouze URL.

## Vlastní přihlašovací relace

`GET /api/v1/auth/sessions` a `DELETE /api/v1/auth/sessions/{session_id}`
vyžadují platné přihlášení, nikoli výběr role nebo oprávnění profilu.
Fungují i před změnou dočasného hesla. Seznam vrací pouze vlastní neexpirované
relace; změna hesla staré relace zruší a vydá jednu novou. Cizí relaci nelze
číst ani zrušit. Rušení relací nadále podléhá ochraně původu požadavku.

## Smazání účtu a audit

Auditní události používají pro odkaz na původce `ON DELETE SET NULL`.
Administrátor proto může smazat účet i po změně hesla nebo úpravě profilu.
Historie událostí zůstává zachovaná a pouze odkaz na smazaný účet se vyprázdní.
Migrace `20261023_04_audit_actor_delete` upraví i existující databázi při startu.
Ochrana posledního správce, vlastního aktuálního účtu a dalších školních
vazeb zůstává zachovaná; navázaná školní data se kaskádově nemažou.

## Odpovědi validačních chyb

Neplatná struktura těla, parametrů, cookies nebo hlaviček vrací `422`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "location": ["body", "phone"],
        "message": "String should match pattern ...",
        "type": "string_pattern_mismatch"
      }
    ]
  }
}
```

`details` obsahuje umístění chyby, zprávu a typ. Neobsahuje zaslané hodnoty,
tělo požadavku ani validační kontext, aby se nevracela hesla. Typ těchto
podrobností je součástí kontraktu. Obchodní chyby nad DB, například neznámé
oprávnění nebo zákaz odebrání posledního správce, mají nadále zprávu
v `error.message` a mohou `details` vynechat.

Statické podmínky používají `minLength`, `maxLength`, `pattern`, `format`,
`minimum`, `maximum`, `minItems`, `maxItems`, `uniqueItems`,
`additionalProperties` a `minProperties`. Samostatný admin je v JSON Schema
vyjádřený podmínkou `if`/`then`. Oprávnění konkrétního uživatele a existence
záznamů závisejí na DB a dál se ověřují na serveru; popis v kontraktu
nenahrazuje autorizaci.

## Obnovení kontraktu a kontrola

Z `apps/api`:

```sh
uv run python -m server.openapi ../../docs/openapi.json
```

Živý kontrakt je na `http://localhost:8000/openapi.json`, interaktivní
dokumentace na `/docs`. Do Postmanu můžeš kontrakt znovu importovat přes URL.
Připravená Postman kolekce zůstává určená pro konkrétní testovací scénáře.

Z kořene projektu:

```sh
uv run pytest -q
```

`tests/api/test_validation.py` porovnává zamítnuté vstupy s JSON Schema,
ověřuje bezpečný formát chyb, limity a platné hraniční případy a hlídá shodu
exportovaného kontraktu s živým API. U e-mailů testuje úplnou syntaxi server:
jednotlivé klientské validátory mohou podporovat `format: email` různě.

Zdroje: [Pydantic Field a JSON Schema](https://docs.pydantic.dev/latest/concepts/fields/),
[SkipJsonSchema](https://docs.pydantic.dev/latest/api/json_schema/#pydantic.json_schema.SkipJsonSchema)
a [query modely FastAPI](https://fastapi.tiangolo.com/tutorial/query-param-models/).
