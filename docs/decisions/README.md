# Architecture Decision Records (ADR)

Tento adresář slouží k verzovanému uchování technologických usnesení s dlouhodobým architektonickým dopadem na infrastrukturu repozitáře. Záznamy slouží jako historický log zdůvodnění kompromisů a výběrů pro budoucí revizory či správce.

## Jak založit nový ADR

Vytvořte markdown soubor podle formátu `NNNN-nazev-rozhodnuti.md` (např. `0001-adoption-of-turborepo-and-pnpm.md`).

Struktura by měla povinně vymezovat následující sekce (dle upraveného MADR vzoru):

1. **Title**: Zkrácený identifikátor rozhodnutí.
2. **Context**: Objektivní, technický a neutrální popis řešeného problému. Proč architektura potřebuje novou volbu?
3. **Decision**: Explicitní ustanovení vybrané technické cesty bez zbytečných výkladů.
4. **Consequences**: Zhodnocení vedlejších dopadů a ceny tohoto rozhodnutí (trade-offs), vliv na budoucí vývoj či kompilaci. Vždy definováno inženýrsky přesně.

Pokud existují pochybnosti o důvodech určité implementační asymetrie, je pravděpodobné, že tento adresář poskytne racionální kontextualizaci.
