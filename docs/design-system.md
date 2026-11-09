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
čtyřbodové stupnice. Hustoty mění výšku polí a běžných tlačítek na 34 / 40 / 46 px;
mobil zachovává alespoň 44px ovládací plochy.

Pozadí přihlášení je součástí identity: jemné nakloněné řady loga s pomalým
střídavým pohybem. Vykresluje je opakovaná SVG textura ve dvou CSS vrstvách,
nikoli jednotlivá loga v DOM. Při omezeném pohybu zůstávají dlaždice statické.
