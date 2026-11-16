# Vizuální identita a společné UI

**Nová generace školních systémů.** Navrženo pro lepší školu.
Od studentů, pro studenty. **#myslimenabudoucnost**

Název píšeme malými písmeny. Motiv „Pevný bod školního dne“ propojuje
logo, produkt a komunikační podklady.

## Barvy a písmo

| Role značky | Barva | Použití |
| --- | --- | --- |
| Lime | `#B9FF08` | Značka, hlavní CTA, zvýraznění dalšího kroku |
| Ink | `#1A2400` | Značkový text a tmavé komunikační plochy |
| Paper | `#F8FFE5` | Světlé komunikační plochy |
| White | `#FFFFFF` | Neutrální plocha |
| Link | `#496600` | Čitelný akcent na světlé ploše |

Plus Jakarta Sans je společná rodina pro UI i komunikaci. Soubor písma
s licencí je v [`apps/web/public/fonts`](../apps/web/public/fonts/).
Veřejná komunikace používá pevnou značkovou paletu. Produkt přidává neutrály,
stavové barvy a uživatelské akcenty; volba jiného akcentu nepřebarvuje veřejnou značku.

Logo má jednu sadu původních křivek v [`brand/logo.svg`](../apps/web/public/brand/logo.svg).
Komponenta `Logo` na ni odkazuje. Poměr stran zachováváme, ochranná zóna je
čtvrtina výšky loga a minimální šířka v UI je 40 px. V UI může být logo
monochromní podle kontrastu pracovní plochy.

## Tokeny a podklady

Barvy, písmo, rozestupy a hustotu definuje
[`core/ui/styles/tokens.css`](../apps/web/src/core/ui/styles/tokens.css).
Hodnoty se upravují přímo; sestavení nepotřebuje generátor identity.
V produktu zůstává jen logo, textura přihlášení a licencované písmo.

Zdrojem komunikačních podkladů je Figma. Exporty pro sociální sítě ani
pomocné generátory nejsou součástí aplikace. Při změně značky sjednoť
hodnoty ve Figmě i produktových tokenech.

## UI

Členění `core` a `modules` určuje [architektura](architecture.md#frontend).
Moduly skládají společná primitiva; nevytvářejí jejich kopie.

Běžné ovládání je neutrální. Vystouplý 3D povrch mají hlavní CTA a potvrzení
závažné operace. Stavové barvy označují význam, nevytvářejí další rodinu ovládání.
Komponenty sdílejí velikosti, fokus, chyby a nápovědu. Rozestupy vycházejí ze
čtyřbodové stupnice. Hustoty mění výšku polí a běžných tlačítek na 40 / 44 / 48 px;
mobil zachovává alespoň 44px ovládací plochy.

Pozadí přihlášení je součástí identity: jemné nakloněné řady loga s pomalým
střídavým pohybem. Vykresluje je opakovaná SVG textura ve dvou CSS vrstvách,
nikoli jednotlivá loga v DOM. Při omezeném pohybu zůstávají dlaždice statické.

## Čitelnost a společné chování

Výchozí text má 16 px, doplňkové popisky nejméně 14 px při běžném nastavení
prohlížeče. Používej typografické tokeny v `rem`; pevné malé písmo obchází
uživatelovu volbu velikosti. Utility `text-xs` a `text-sm` vycházejí ze stejné
stupnice. Zvětšení textu i nastavení prohlížeče musí zachovat ovládání.

Výšky běžných prvků jsou 40 / 44 / 48 px podle hustoty. Na mobilu a u voleb
v `ChoiceGroup` zachovej alespoň 44 px. Jde o produktové pravidlo pro snadné
ovládání; WCAG 2.2 AA stanovuje jiné minimum a výjimky.

| Společný vzor | Komponenta | Chování |
| --- | --- | --- |
| Vstup a nápověda | `Input`, `Select`, `Textarea`, `Field` | Viditelný popisek, popis chyby propojený s polem, jednotný fokus |
| Výběr jedné možnosti | `ChoiceGroup` | Nativní rádia, šipky na klávesnici, celá plocha popisku aktivní, stav poznatelný i bez barvy |
| Uložení | `FormActions`, `SaveStatus` | Stejné pořadí akcí; viditelný průběh, neuložené změny, úspěch a chyba |
| Dialog | `Dialog`, `RecordDialog`, `ConfirmProvider` | Viditelné Zavřít, Escape, návrat fokusu, potvrzení zahození rozepsaných údajů |
| Výsledek operace | `ErrorState`, oznámení | Chyba zůstává u formuláře; chybové oznámení zůstává do zavření |

`core/ui` řeší vizuální a přístupné primitivy bez znalosti API a oprávnění.
Sdílené formuláře v `modules/shared` skládají primitiva a datové agendy dodávají
pouze obsah, oprávnění a požadavky. Modulové CSS řeší rozložení; nezmenšuje
společná tlačítka a nevytváří vlastní kopii rádia nebo vstupního pole.

Tabulková třídnice zůstává seznamem se společným uložením. Při nedostatku místa
se řádky přeskupí podle šířky obsahu. Stav uložení je viditelný i na telefonu.
Formuláře nabízejí názvy z oprávněných odpovědí API; ruční opisování UUID není
náhradou chybějících oprávnění. Dostupné volby z rozvrhu lze předat přes
`ReferenceOptionsProvider`.

Ověřené obrazovky, nálezy a omezení uvádí [UX audit](ux-audit.md).
