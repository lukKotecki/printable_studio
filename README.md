# Printable Studio

Printable Studio to lokalna aplikacja webowa do szybkiego projektowania prostych modeli 3D przygotowanych do druku. Umożliwia tworzenie tagow, puzzli i kostek D6, podglad modelu w Three.js oraz eksport gotowej bryly do STL bez uzycia zewnetrznego API.

## Live Demo

Demo online: https://studio.mojestrony.pl

## Screenshot

![Printable Studio - screenshot](docs/app-screenshot.png)

## Funkcje

- Podglad 3D modelu w czasie rzeczywistym z obrotem, zoomem i przesuwaniem kamery.
- Tryby modelu: plaski tag, puzzle oraz kostka D6.
- Edycja geometrii modelu: ksztalt, rozmiar, grubosc, promien rogow i parametry charakterystyczne dla wybranego trybu.
- Regulowany otwor w tagu: srednica, margines oraz przesuniecie w osi X/Y.
- Tekst 3D na awersie i rewersie z ustawieniem rozmiaru oraz glebokosci dodatniej lub ujemnej.
- Logo SVG/PNG na tagu i na scianach kostki; jasne tlo PNG jest ignorowane, a ciemne obszary sa przetwarzane do ksztaltu 3D.
- Niezalezne sterowanie rozmiarem, glebokoscia, przesunieciem i obrotem logo.
- Konfiguracja kostki D6: podpisy/sciany, rozmiar czcionki, glebokosc, logo per sciana, zaokraglenie krawedzi i opcjonalny podglad kuli ograniczajacej.
- Obsluga fontow lokalnych: wbudowane typeface.json oraz wlasne pliki .ttf lub .json.
- Interfejs PL/EN z lokalizacjami XML i lokalnymi presetami zapisywanymi w localStorage.
- Eksport gotowego modelu do formatu STL.
- Dzialanie w calosci po stronie klienta, bez backendu.

## Tech Stack

- TypeScript
- Vite
- Three.js
- three-csg-ts

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Domyslnie aplikacja jest dostepna pod adresem http://localhost:5173.

## Build produkcyjny

```bash
npm run build
npm run preview
```

Build produkcyjny generowany jest przez Vite i zapisuje pliki wynikowe w katalogu `dist/`.

## Struktura projektu

- src/main.ts - punkt wejscia aplikacji i logika renderowania UI/3D
- src/config/ - typy domenowe i stale konfiguracyjne
- src/i18n/ - ladowanie lokalizacji i helpery tlumaczen
- src/models/ - wydzielona geometria i logika modelu (tag/puzzle/kosc)
- src/storage/ - odczyt/zapis danych aplikacji do localStorage
- src/ui/ - helpery obslugi zdarzen interfejsu
- src/utils/ - wspolne narzedzia pomocnicze
- public/fonts/ - lokalne fonty 3D (typeface.json)
- scripts/ - skrypty pomocnicze

## Licencja

Brak okreslonej licencji.
