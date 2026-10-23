# Jakuplayer

Statyczny odtwarzacz muzyki korzystający z YouTube Data API oraz YouTube IFrame API.

## Uruchomienie

```bash
npm start
```

Aplikacja działa bez procesu budowania. Serwer nasłuchuje na porcie `3000` i udostępnia `index.html`.

## Ochrona przed reklamami

`ad-blocker.js` wykrywa przerwy reklamowe przez zdarzenia odtwarzacza i kontrolę `getAdState()`. Po wykryciu reklamy:

- natychmiast wycisza dźwięk,
- próbuje przewinąć reklamę do końca, jeżeli YouTube udostępnia bezpieczną informację o jej długości,
- przywraca poprzednią głośność i stan wyciszenia,
- nie traktuje zakończenia reklamy jako zakończenia utworu.

Jest to ochrona na poziomie odtwarzacza, a nie sieciowy adblock. Ze względu na izolację iframe YouTube może nie zezwolić na pominięcie każdej reklamy; wtedy pozostaje ona wyciszona do zakończenia przerwy.

## Testy

```bash
npm install
npm run check
npm test
```

Testy obejmują blokowanie reklam, przywracanie dźwięku, inicjalizację odtwarzacza, wyszukiwanie, kolejkę, ulubione, playlisty, skróty klawiaturowe oraz obsługę błędnych danych.

## Konfiguracja

Klient korzysta z klucza YouTube Data API zapisanego w `app.js`. W Google Cloud Console klucz powinien być ograniczony do YouTube Data API i do domen aplikacji przez reguły HTTP referrer.
