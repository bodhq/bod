# Vyřízení backend review z 1. 11. 2026

Větev `fix/backend-review-auth` řeší všech pět provozních bodů:

- Limiter počítá neúspěšná přihlášení, standardně 100 na IP a 5 na účet/IP za 15 minut od poslední chyby. Úspěšné přihlášení nespotřebuje IP limit ani nemaže chyby jiných účtů. Stávající `LOGIN_IP_MAX_REQUESTS` funguje jako alias nového `LOGIN_IP_MAX_FAILURES`.
- SSR `/auth/me` posílá `X-Session-Refresh: skip`. Ověří relaci, ale neprodlouží její expiraci. Prohlížeč po připojení AuthProvider zavolá `/auth/me` a dostane odpovídající obnovu DB i cookie. Hlavička neopravňuje k přístupu a neobchází původní expiraci.
- `/auth/sessions` vrací povinné `is_current` porovnáním ID s autentizovaným kontextem. Web tento údaj používá pro rozpoznání zařízení i odhlášení ostatních relací.
- Aktivita se zapisuje po 300 sekundách nezávisle na obnově expirace. Interval je konfigurovatelný.
- Redis zapisuje oba čítače a TTL pomocí `MULTI/EXEC`. Integrační testy ověřují odpojení před EXEC i ztracenou odpověď po jeho provedení. Při nedostupném Redisu zůstává přihlášení uzavřené s chybou 503.

Z refaktoringu je hotové sdílení normalizace username, odstranění nepoužívaných metod pro vyhledávání uživatele a vytvoření relace, odstranění duplicitních polí výsledků a využití jediné existující funkce `utcnow`. DB constraint normalizovaného username zůstává. Přímé porovnání username využívá běžný index; PostgreSQL test ověřuje možnost jeho využití (s vypnutým sekvenčním scanem na malé testovací tabulce, nejde o benchmark produkčních dat). Commit operací AuthSessionRepository nyní řídí služby stejně jako u AccessRepository.

CI má samostatný job s PostgreSQL a Redisem. Kromě migrací ověřuje souběžný bootstrap a ochranu posledního správce se skutečnými PostgreSQL zámky.

## Ověření

Kompletní backendová sada: 111 úspěšných testů, žádný přeskočený, pokrytí 96,49 %. Lokálně ověřeno s PostgreSQL 14 a Redis 7; CI používá PostgreSQL 17. Prošly také Ruff, mypy a Bandit. Integrační prostředí mělo vlastní dočasnou databázi a Redis klíče. Frontend: 7 úspěšných testů včetně obnovy relace po SSR a přesměrování po expiraci cookie; TypeScript a Biome pro změněné soubory prošly. Při ověřování byly sjednoceny React/React DOM na 19.2.8 a Vitest/coverage na 4.1.10, protože rozdílné verze bránily spuštění testů.

## Navazující práce před větším provozem

Globální advisory lock zůstává zachovaný. Je třeba změřit dobu čekání při souběžných změnách profilu, hesla a rolí více účtů, poté navrhnout pořadí zámků a rozsah transakcí. Změna musí zachovat souběžné kontroly oprávnění, revokaci relací a ochranu posledního správce. Stávající testy souběhu nyní běží také proti PostgreSQL; reprezentativní zátěžový benchmark ještě chybí.

Rozvrhový model vyžaduje společné rozhodnutí týmu o místnostech, třídách, skupinách, učitelských identitách, školním roce a verzích rozvrhu. Bez něj by doplnění FK určovalo neodsouhlasený datový model. Před implementací známek a docházky je potřeba doplnit objektová oprávnění. Worker optimalizátoru a ukládání verzovaných návrhů patří k budoucímu modulu. Architektura čtení rozvrhu zůstává zachovaná.
