# Tetris dla dzieci — specyfikacja projektu

- **Data:** 2026-09-29
- **Źródło wymagań:** [docs/wymagania.md](../../wymagania.md)
- **Termin:** gra gotowa do grania dzisiaj

## 1. Cel

Prosta gra typu Tetris w przeglądarce, dla dzieci i młodzieży, do grania dla zabicia czasu. Uruchamia się przez dwuklik na `index.html`, bez instalacji i bez serwera.

**Gra jest skończona, gdy:**
- da się grać od startu do końca gry;
- pełne linie znikają i naliczają się punkty;
- działa pauza;
- po końcu gry widać wynik i można zagrać ponownie;
- wszystkie testy logiki przechodzą (`node --test`).

## 2. Zakres

**W zakresie:** plansza 10×20; 7 klasycznych klocków; losowe spadanie; ruch w lewo i w prawo; obrót; szybsze opadanie; zbijanie linii z punktacją; pauza; ekran końca gry z przyciskiem „Zagraj ponownie”.

**Poza zakresem:** poziomy i przyspieszanie, dźwięk, podgląd następnego klocka, rekord, hard drop, hold, „duch” klocka, animacje, sterowanie dotykowe, ranking online.

## 3. Zasady gry

### 3.1 Plansza i klocki
- Plansza ma 10 kolumn i 20 wierszy. Wiersz 0 to góra planszy.
- Klocki: I, O, T, S, Z, J, L. Każdy ma 4 pozycje obrotu (O wygląda we wszystkich tak samo) i stały kolor:

| Klocek | Kolor |
|---|---|
| I | błękitny (cyan) |
| O | żółty |
| T | fioletowy |
| S | zielony |
| Z | czerwony |
| J | niebieski |
| L | pomarańczowy |

- Każdy kształt jest opisany na siatce 4×4, a jego pozycja na planszy to lewy górny róg tej siatki.
- Każdy kolejny klocek jest losowany z równym prawdopodobieństwem.

### 3.2 Pojawianie się klocka
- Nowy klocek pojawia się w pozycji obrotu 0. Lewy górny róg jego siatki stoi w kolumnie 3, a w wierszu 0 znajduje się najwyższy zajęty wiersz kształtu (dla każdego klocka ustalamy przesunięcie w pionie).
- Jeśli nowy klocek od razu nachodzi na zajęte pola, gra się kończy („konstrukcja dotknęła sufitu”).

### 3.3 Ruch i obrót
- **Ruch** w lewo, w prawo lub w dół wykonuje się tylko wtedy, gdy klocek w nowym położeniu nie wychodzi poza planszę i nie nachodzi na zajęte pola. W przeciwnym razie nic się nie dzieje.
- **Obrót** przechodzi do następnej pozycji obrotu (w prawo, w kółko 0→1→2→3→0). Obowiązuje ta sama zasada: przy kolizji obrót się nie wykonuje. Nie ma odsuwania klocka od ściany (wall kick).

### 3.4 Opadanie i zatrzymanie
- Jedno **uderzenie zegara** (tick) przesuwa klocek o 1 wiersz w dół.
- Jeśli klocek nie może zejść niżej, tick go **zatrzymuje**: klocek zostaje wpisany w planszę w swoim kolorze, pełne wiersze znikają, nalicza się punkty i pojawia się nowy klocek.
- Tempo jest stałe: 1 tick na sekundę.
- Strzałka ↓ działa dokładnie jak jeden tick.

### 3.5 Zbijanie linii i punktacja
- Wiersz jest pełny, gdy wszystkie jego 10 pól jest zajętych. Pełne wiersze znikają, wiersze nad nimi opadają, a na górze dochodzą puste wiersze.
- Punkty zależą od liczby wierszy zbitych jednym zatrzymaniem klocka:

| Wiersze | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Punkty | 0 | 100 | 300 | 500 | 800 |

- Za samo opadanie nie ma punktów.

### 3.6 Statusy gry
- `playing` — gra trwa.
- `paused` — pauza. Tick, ruch i obrót nic nie zmieniają. Klawisz P wraca do stanu `playing`.
- `over` — koniec gry. Tick, ruch, obrót i pauza nic nie zmieniają. Przycisk „Zagraj ponownie” zaczyna nową grę.

## 4. Sterowanie

| Klawisz | Akcja |
|---|---|
| ← / → | przesunięcie w lewo / w prawo |
| Spacja | obrót |
| ↓ | szybsze opadanie (jeden tick) |
| ↑ | brak akcji |
| P | pauza / wznowienie |

Dla tych klawiszy blokujemy domyślne zachowanie przeglądarki, żeby strzałki i spacja nie przewijały strony.

## 5. Architektura

Zwykłe skrypty `<script>` bez modułów ES, bo moduły nie działają przy otwieraniu pliku z dysku (`file://`). Pliki z logiką działają i w przeglądarce, i w Node: w przeglądarce ich funkcje trafiają do jednego obiektu globalnego (`window.Tetris`), a w Node są eksportowane przez `module.exports`.

```
index.html          strona: plansza, wynik, nakładki, przycisk
style.css           wygląd
src/pieces.js       kształty (4 pozycje obrotu), kolory, przesunięcia startowe
src/game.js         czysta logika gry — bez DOM, bez zegara
src/view.js         rysowanie w DOM, klawiatura, zegar
tests/game.test.js  testy logiki (node:test)
package.json        tylko skrypt "test": "node --test"
```

### 5.1 `src/game.js` — interfejs

Wszystkie funkcje są czyste: przyjmują stan i zwracają **nowy** stan, nie zmieniając przekazanego.

- `createGame(random)` — nowa gra: pusta plansza, wynik 0, status `playing`, pierwszy klocek. `random` to funkcja zwracająca liczbę z przedziału [0, 1), jak `Math.random`. W testach podajemy ustaloną sekwencję.
- `moveLeft(state)`, `moveRight(state)`, `rotate(state)` — ruch lub obrót zgodnie z punktem 3.3.
- `tick(state)` — opadanie lub zatrzymanie zgodnie z punktem 3.4. Przy zatrzymaniu losuje następny klocek funkcją `random` zapisaną w stanie.
- `togglePause(state)` — przełącza `playing` ↔ `paused`. W stanie `over` nic nie zmienia.
- `getCells(state)` — plansza 20×10 do narysowania, z aktywnym klockiem naniesionym na zajęte pola. Każde pole to `null` albo litera klocka.

**Kształt stanu:**
```js
{
  board: [[null | 'I' | 'O' | ...] × 10] × 20,
  piece: { type: 'T', rotation: 0, row: 0, col: 3 },
  score: 0,
  status: 'playing' | 'paused' | 'over',
  random: () => number
}
```

### 5.2 `src/view.js`
- Przy starcie tworzy 200 elementów `div` w siatce CSS 10×20 i potem tylko zmienia ich klasy (np. `cell cell--T`). Nie buduje planszy od nowa przy każdym rysowaniu.
- Po każdej zmianie stanu wywołuje `render(state)`: aktualizuje pola, wynik i nakładki („Pauza”, „Koniec gry” z wynikiem i przyciskiem).
- Zegar `setInterval` co 1000 ms wywołuje `tick`. „Zagraj ponownie” wywołuje `createGame(Math.random)`.
- Nie zawiera reguł gry; te są tylko w `game.js`.

### 5.3 Wygląd
- Płaski, prosty styl, bez efektów. Klocki w kolorach z punktu 3.1, pola z cienką ramką, ciemne tło planszy.
- Obok planszy: tytuł, wynik i krótka ściąga z klawiszami.
- Interfejs po polsku.

## 6. Obsługa błędów

Gra nie przyjmuje danych od użytkownika poza klawiszami, więc nie ma błędów do zgłaszania. Niedozwolone ruchy są po prostu ignorowane (punkt 3.3), a klawisze spoza tabeli z punktu 4 — pomijane.

## 7. Testy

TDD: każda reguła z punktu 3 najpierw dostaje test, który nie przechodzi. Testujemy tylko `game.js` (i dane z `pieces.js`), bez DOM. Kolejność klocków ustalamy, przekazując do gry własną funkcję `random`.

**Obowiązkowe przypadki:**
1. Nowa gra: pusta plansza, wynik 0, status `playing`, klocek w pozycji startowej.
2. Ruch w lewo i w prawo; blokada na ścianie; blokada na zajętych polach.
3. Obrót; blokada obrotu przy ścianie i przy zajętych polach.
4. Tick przesuwa klocek o 1 wiersz w dół.
5. Tick na dnie lub na innych klockach zatrzymuje klocek, wpisuje go w planszę i pojawia się nowy.
6. Zbicie 1, 2, 3 i 4 wierszy: poprawne punkty (100/300/500/800) i opadnięcie wierszy znad zbitych.
7. Koniec gry, gdy nowy klocek nie ma miejsca.
8. Pauza: tick, ruch i obrót nic nie zmieniają; ponowne przełączenie wznawia grę.
9. Po końcu gry tick, ruch, obrót i pauza nic nie zmieniają.
10. Funkcje nie zmieniają przekazanego stanu.

Warstwę `view.js` sprawdzamy ręcznie w przeglądarce: granie do końca gry, pauza, „Zagraj ponownie”, strzałki nie przewijają strony.
