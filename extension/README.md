# Jakuplayer Adblock — Chrome / Edge

Wtyczka Manifest V3 blokująca typowe żądania reklamowe i pomijająca reklamy wideo bezpośrednio w osadzonej ramce YouTube.

## Instalacja z paczki ZIP

1. Pobierz `jakuplayer-adblock.zip` ze strony Jakuplayera i rozpakuj go.
2. W Chrome otwórz `chrome://extensions`, a w Edge `edge://extensions`.
3. Włącz **Tryb dewelopera**.
4. Kliknij **Załaduj rozpakowane** / **Load unpacked**.
5. Wybierz katalog `jakuplayer-adblock` zawierający `manifest.json`.
6. Odśwież otwartą stronę Jakuplayera.

Nie instaluj rozszerzeń z innych, nieznanych źródeł. Kod tej wtyczki jest dostępny w repozytorium Jakuplayera.

## Jak działa

- reguły `declarativeNetRequest` blokują typowe domeny i ścieżki reklamowe,
- skrypt w ramce YouTube wykrywa `ad-showing` / `ad-interrupting`,
- reklama jest wyciszana, przyspieszana i przewijana,
- nowe przyciski „Pomiń reklamę” są klikane automatycznie,
- po przerwie przywracane są głośność, wyciszenie i prędkość odtwarzania,
- nakładki reklamowe są ukrywane, ale właściwy film i `googlevideo.com` nie są blokowane.

## Aktualizacja i ograniczenia

To wersja instalowana ręcznie, nie dodatek z Chrome Web Store. Po pobraniu nowszej paczki zastąp pliki i kliknij **Przeładuj** na karcie rozszerzenia. YouTube może zmienić strukturę odtwarzacza lub sposób dostarczania reklam, dlatego nie da się uczciwie zagwarantować działania „na zawsze” bez aktualizacji. Wtyczka nie usuwa reklam i segmentów sponsorskich nagranych bezpośrednio w filmie.

Blokada JavaScript wbudowana w stronę Jakuplayera pozostaje dodatkowym zabezpieczeniem, jeśli wtyczka nie jest zainstalowana.
