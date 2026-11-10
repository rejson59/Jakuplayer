# Jakuplayer

Statyczny odtwarzacz muzyki korzystający z YouTube Data API oraz YouTube IFrame API, z opcjonalną synchronizacją biblioteki przez wspólne konto `rejson59.github.io`.

## Uruchomienie

```bash
npm start
```

Aplikacja działa bez procesu budowania. Serwer nasłuchuje na porcie `3000` i udostępnia `index.html`.

## Kolejka i sterowanie

- Przycisk kolejki przy utworze dodaje go na koniec kolejki. W menu **Kolejka** można odtworzyć utwór, zmienić kolejność i usuwać pozycje. Wyczyszczenie zachowuje aktualny utwór. Kolejka i pozycja (maksymalnie 500 utworów) są zapisywane w `sessionStorage` bieżącej karty i przywracane po odświeżeniu; wznowienie wymaga naciśnięcia Play. Nie są synchronizowane między urządzeniami i mogą zniknąć po zamknięciu karty. Stan powiązany z kontem jest przywracany dopiero po weryfikacji tego samego konta; nie zawiera tokenu.
- Timer snu znajduje się w widoku kolejki. Zatrzymuje odtwarzanie po 15, 30, 60 lub 90 minutach; działa tylko, gdy karta pozostaje otwarta, i nie jest przywracany po odświeżeniu. Wstrzymanie może się opóźnić, jeśli przeglądarka uśpi kartę.
- Ulubione i playlisty można filtrować i sortować bez zmiany zapisanej kolejności. Przycisk odtwarzania ulubionych uwzględnia filtr i sortowanie. Historię można wyczyścić po potwierdzeniu; dla połączonego konta zmiana jest synchronizowana.
- W szczegółach playlisty można skopiować link zawierający jej **publiczną kopię**. Odbiorca może odtworzyć lub zapisać kopię bez logowania; późniejsze zmiany nie są synchronizowane. Każdy posiadacz linku widzi utwory. Link może być długi, a dla większych playlist zawiera tylko identyfikatory filmów zamiast tytułów i wykonawców. Odtwarzanie zależy od dostępności i osadzania filmów w YouTube.
- Przycisk **Pokaż propozycje** wyszukuje w YouTube utwory według ostatniego znanego wykonawcy z historii, wykluczając utwory już w historii. Zapytanie jest wysyłane dopiero po kliknięciu; wyniki zależą od YouTube Data API i limitu jego zapytań.
- W przeglądarkach obsługujących Media Session tytuł i przyciski odtwarzania są dostępne również w systemowym panelu multimediów. Dostępność zależy od przeglądarki i systemu.

## Wspólne konto `rejson59.github.io` i synchronizacja

Logowanie w Jakuplayerze **nie jest obowiązkowe** — z wyszukiwarki, odtwarzacza, ulubionych, playlist i historii można korzystać od razu lokalnie na urządzeniu.

Na oficjalnym originie `https://rejson59.github.io/Jakuplayer/` aplikacja ładuje skrypt `/js/rejson-account.js?v=1` i umożliwia połączenie ze wspólnym kontem `rejson59.github.io` przyciskiem **„Zaloguj się przez rejson59.github.io”**:

- tożsamość konta jest zawsze weryfikowana po stronie serwera (`RejsonAccount.getSession()` / `community_whoami`), a token sesji nigdy nie jest zapisywany w URL, logach ani własnym `localStorage` / `sessionStorage` projektu,
- polubione utwory, playlisty oraz historia odtwarzania zalogowanego użytkownika są odczytywane i zapisywane w bazie Supabase wyłącznie przez autoryzowane funkcje RPC (`jakuplayer_get_library`, `jakuplayer_save_library`) weryfikujące sesję po stronie serwera (`supabase/2026-11-04_jakuplayer.sql`),
- dane wczytane z konta nie są zapisywane do lokalnej pamięci gościa i są natychmiast czyszczone przy odłączeniu projektu, wylogowaniu lub zmianie konta,
- jeżeli przed zalogowaniem na urządzeniu istniały lokalne dane z trybu gościa, użytkownik może za wyraźną zgodą scalić i zapisać je na swoim koncie,
- odłączenie konta w Jakuplayerze kończy dostęp samego projektu w danej przeglądarce, natomiast pełne wylogowanie ze strony odbywa się w panelu `/logowanie?zarzadzaj=1`.

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

Testy obejmują wspólne konto i izolację danych, migrację danych gościa, obsługę błędów sieci, blokowanie reklam, przywracanie dźwięku, inicjalizację odtwarzacza, wyszukiwanie, kolejkę, ulubione, playlisty, skróty klawiaturowe oraz obsługę błędnych danych.

## Konfiguracja

Klient korzysta z klucza YouTube Data API zapisanego w `app.js`. W Google Cloud Console klucz powinien być ograniczony do YouTube Data API i do domen aplikacji przez reguły HTTP referrer.
