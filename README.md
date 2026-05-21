# Printable Studio (lokalnie)

Lokalny generator tagow 3D dzialajacy offline, inspirowany serwisami do tworzenia identyfikatorow i zawieszek.

## Funkcje

- Podglad 3D tagu w czasie rzeczywistym (orbit, zoom, pan)
- Parametry geometrii: ksztalt, rozmiar, grubosc, promien rogow
- Otwor na kolko z regulacja srednicy i marginesu
- Napis 3D: tekst, rozmiar, glebokosc, tryb wypukly/wklesly
- Eksport gotowego modelu do pliku STL
- Presety zapisywane lokalnie (localStorage)
- Pelne dzialanie lokalnie, bez zewnetrznego API

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja bedzie dostepna pod adresem podanym przez Vite (domyslnie `http://localhost:5173`).

## Build produkcyjny

```bash
npm run build
npm run preview
```

## Uwagi

- Font 3D jest dolaczony lokalnie w `public/fonts/helvetiker_regular.typeface.json`.
- STL jest generowany po stronie klienta (w przegladarce).
