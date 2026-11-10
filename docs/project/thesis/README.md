# Maturitní dokumentace

Práce má jeden společný dokument. Autoři píšou vlastní kapitoly do
oddělených souborů; LaTeX je při sestavení spojí do jednoho PDF.

| Soubor | Obsah | Autor |
| --- | --- | --- |
| `main.tex` | Společná metadata a spuštění dokumentu | Oba |
| `document.tex` | Úvodní listy, společné kapitoly, závěr a přílohy | Oba |
| `prochazkaelias23.tex` | Frontend a uživatelské rozhraní | Eliáš Jan Procházka |
| `nagyfilip23.tex` | Backend a databáze | Filip Nagy |
| `DMP_a_RP_sablona.bib` | Společný seznam citovaných zdrojů | Oba |

Hlavní dokument vkládá kapitoly takto:

```tex
\input{prochazkaelias23}
\input{nagyfilip23}
```

Kapitoly obsahují běžný text, `\chapter`, `\section` a citace. Nemají
vlastní `\documentclass` ani `\begin{document}`. Číslování, obsah,
křížové odkazy a bibliografie se vytvoří společně. Pro větší kapitolu
lze stejným způsobem přidat další soubory.

## Sestavení

Z kořene repozitáře s TeX Live, latexmk a Biberem:

```sh
scripts/docs
```

Stejný build v připnutém kontejneru používá CI:

```sh
scripts/ci docs
```

Kontejner používá Linux/amd64; na Apple Silicon vyžaduje emulaci.
Výsledkem je `dist/docs/bod-dokumentace.pdf`. GitHub Actions i GitLab CI
zveřejňují stejné PDF jako artefakt. PDF a pomocné soubory se necommitují.

## Šablona a obsah

Základ tvoří školní balíček `DMP_a_RP_sablona` z 31. 8. 2026. Školní sazba
a logo zůstávají zachované; styl má pouze doplněný nastavitelný popisek
autorů. Vstupní soubor ho mění na „Autoři práce“. Dokument zahrnuje obě zadání z `../assignments`
a místo pro podpisy obou autorů.

Anotace a osnovy jsou pracovní verze. Autorské části jsou označené přímo
v textu; společná analýza a návrh jsou oddělené od vlastní implementace.
Datum na titulní straně je datum sestavení.

Zdroje přidávej do `.bib` a cituj pomocí `\cite{klíč}`. Klíče křížových
odkazů pojmenovávej například `fe:...` a `be:...`, aby se nesrážely.
Před odevzdáním uprav anotaci a prohlášení podle skutečné práce a potvrď
formální náležitosti s vedoucím.
