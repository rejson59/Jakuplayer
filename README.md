# Jakuplayer

Statyczny odtwarzacz muzyki korzystający z YouTube Data API oraz YouTube IFrame API.

## Uruchomienie

```bash
npm start
```

Aplikacja działa bez procesu budowania. Serwer nasłuchuje na porcie `3000` i udostępnia `index.html`.

## Wtyczka Chrome / Edge

Dla skuteczniejszej blokady repozytorium zawiera wtyczkę Manifest V3 w katalogu `extension/`. Działa ona również wewnątrz osadzonej ramki YouTube, do której skrypt samej strony nie ma dostępu. Blokuje typowe żądania reklamowe, pomija reklamy wideo, klika przyciski pomijania i ukrywa nakładki.

Paczka `jakuplayer-adblock.zip` i strona `extension.html` z instrukcją są dostępne w opublikowanej aplikacji. Instrukcja znajduje się również w [`extension/README.md`](extension/README.md). Wtyczka wymaga jednorazowej instalacji przez każdego użytkownika; strona nie może zainstalować jej automatycznie.

Aby odbudować paczkę po zmianach:

```bash
npm run package:extension
```

## Ochrona przed reklamami

`ad-blocker.js` wykrywa przerwy reklamowe przez zdarzenia odtwarzacza i kontrolę `getAdState()`. Po wykryciu reklamy:

- natychmiast wycisza dźwięk,
- próbuje przewinąć reklamę do końca, jeżeli YouTube udostępnia bezpieczną informację o jej długości,
- gdy przewinięcie nie jest możliwe, po 500 ms ponownie ładuje właściwy utwór od zapamiętanego miejsca zamiast czekać na koniec przerwy,
- ogranicza liczbę takich prób, aby YouTube nie mógł wywołać pętli przeładowań; po ustabilizowaniu odtwarzania zabezpieczenie może ponownie obsłużyć reklamy w środku utworu,
- przyspiesza reklamę do najwyższej prędkości zgłaszanej przez odtwarzacz, a następnie przywraca normalną prędkość, głośność i stan wyciszenia,
- nie traktuje zakończenia reklamy jako zakończenia utworu.

Jest to ochrona na poziomie odtwarzacza, a nie sieciowy adblock. Ze względu na izolację iframe YouTube może ponowić reklamę lub zablokować jej przewijanie i przyspieszanie. Wtedy reklama pozostaje wyciszona, a zabezpieczenie przed pętlą przeładowań ma pierwszeństwo przed kolejną próbą.

## Testy

```bash
npm install
npm run check
npm test
```

Testy obejmują blokowanie reklam, przywracanie dźwięku, inicjalizację odtwarzacza, wyszukiwanie, kolejkę, ulubione, playlisty, skróty klawiaturowe oraz obsługę błędnych danych.

## Konfiguracja

Klient korzysta z klucza YouTube Data API zapisanego w `app.js`. W Google Cloud Console klucz powinien być ograniczony do YouTube Data API i do domen aplikacji przez reguły HTTP referrer.
