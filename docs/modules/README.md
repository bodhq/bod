# Adresářová organizace modulů

Systém `bod` opustil historický monolitický návrh adresářů (oddělené soubory modelů, pohledů, trasovačů a kontrolerů napříč kořeny aplikace) a plně adoptoval vzor doménových modulů (Domain-Driven Structure).

Tento adresář by měl shromažďovat referenční manuály pro každou funkční doménu systému. 

## Obecná pravidla vrstvení

Implementace nových úloh nesmí narušovat logickou izolaci. Architektonické omezení vyžaduje, aby veškerý kód týkající se konkrétní byznys problematiky ležel sdružen v jednom ohraničeném kontextu (Bounded Context) adresáře `modules/<nazev_modulu>`.

### Backend: `apps/api/server/modules/`
Modul v kontextu API by měl standardně obsahovat následující primitivní struktury:
- `models.py`: Vymezení SQLAlchemy / SQLModel databázových entit.
- `schemas.py`: Pydantic serializační schémata pro validaci a generování OpenAPI.
- `router.py`: FastAPI operace nad příslušnou adresní trasou (endpoints).
- `services.py`: Výpočetní a byznys logika.

### Frontend: `apps/web/src/modules/`
Modul v kontextu Webové aplikace by měl agregovat vrstvu prezentace specifické problematiky:
- `components/`: Komponenty izolovaně sloužící tomuto modulu. Není zde povoleno sdílení pro zbytek repozitáře.
- `hooks/`: Asynchronní získávání a operace s modifikací stavu modulu (fetching hooks).

Ucelená symetrická struktura obou aplikací dramaticky snižuje kognitivní zátěž vývojářů při hledání souvztažných částí systému.
