# Wymagania — gra typu Tetris (JS + HTML)

> Legenda: **[U]** — decyzja użytkownika, **[Z]** — założenie Claude'a (do potwierdzenia lub zmiany).
> Pytania otwarte są na końcu dokumentu.

---

## 1. Cel i odbiorca

- Gra dla zabicia czasu, dla dzieci i młodzieży. **[U]**
- Musi być prosta w obsłudze i czytelna, bez przytłaczających efektów. **[Z]**
- Grę kończymy dzisiaj. Za „skończoną” uznajemy: da się grać od startu do game over, widać wynik i można zagrać ponownie. **[Z]**

## 2. Zakres (MVP na dziś)

**W zakresie:**
- Różne klocki spadają z góry; prosta grafika, bez „wystrzałowych” efektów. **[U]**
- Pełna linia znika, a gracz dostaje punkty. **[U]**
- 7 klasycznych klocków: I, O, T, S, Z, J, L. **[Z]**
- Ekran game over z wynikiem i przyciskiem „Zagraj ponownie”. **[Z]**
- Pauza pod klawiszem P. **[U]**

**Poza zakresem:**
- Poziomy i przyspieszanie gry. **[U]**
- Dźwięk i muzyka. **[U]**
- Podgląd następnego klocka. **[U]**
- Hard drop, hold, „duch” klocka, animacje, ranking online, sterowanie dotykowe. **[Z]**

## 3. Zasady rozgrywki

- Plansza 10 kolumn × 20 wierszy. **[Z]**
- Klocki losowane z równym prawdopodobieństwem. **[U]** (losowo)
- Klocek opada samoczynnie w stałym tempie: 1 wiersz na sekundę. **[Z]** (poziomów nie ma, więc tempo się nie zmienia)
- Obrót w prawo; jeśli obrócony klocek wszedłby w ścianę lub w inne klocki, obrót się nie wykonuje. **[Z]**
- Klocek zatrzymuje się, gdy nie może opaść niżej; wtedy pojawia się następny. **[Z]**
- Game over, gdy konstrukcja dotknie sufitu, czyli nowy klocek nie mieści się na górze planszy. **[U]**

### Punktacja **[Z]** (użytkownik zostawił wybór Claude'owi)

| Linie zbite jednym klockiem | Punkty |
|---|---|
| 1 | 100 |
| 2 | 300 |
| 3 | 500 |
| 4 (Tetris) | 800 |

Premia za zbicie kilku linii naraz zachęca do planowania, a zasada jest łatwa do wyjaśnienia dziecku. Za samo opadanie klocka punktów nie ma.

## 4. Sterowanie (klawiatura)

| Klawisz | Akcja | Źródło |
|---|---|---|
| Spacja | obrót klocka | **[U]** |
| ← / → | przesunięcie w lewo / w prawo | **[U]** |
| ↓ | szybsze opadanie (o 1 wiersz przy każdym naciśnięciu) | **[Z]** |
| ↑ | brak akcji | **[Z]** |
| P | pauza / wznowienie | **[U]** |

## 5. Wygląd

- Prosty, płaski styl, każdy rodzaj klocka ma własny kolor (klasyczne kolory). **[Z]**
- Obramowanie planszy jest zielone. **[U]**
- Obok planszy widać aktualny wynik. **[Z]**
- Interfejs po polsku. **[Z]**

## 6. Dźwięk

- Brak dźwięku. **[U]**

## 7. Zapis wyników i wznawianie gry (baza danych)

- Wyniki rozgrywek zapisują się w bazie danych Supabase. **[U]**
- Przerwaną rozgrywkę można wznowić; jej stan jest zapisany w bazie danych. **[U]**
- Gracz nie zakłada konta: przy pierwszej grze wpisuje nick, który gra zapamiętuje w przeglądarce. Nie zbieramy e-maili ani innych danych osobowych dzieci. **[Z]**
- Gra nadaje graczowi losowy identyfikator (UUID) zapamiętany w przeglądarce. Zapis gry jest przypisany do tego identyfikatora, więc wznowić grę można na tym samym urządzeniu i w tej samej przeglądarce. **[Z]**
- Wynik zapisuje się po zakończeniu gry (game over): nick, liczba punktów, data. **[Z]**
- Stan gry (plansza, aktywny klocek, wynik) zapisuje się przy pauzie i przy zamknięciu lub ukryciu karty. Gracz ma jeden zapis; nowy zapis nadpisuje poprzedni. **[Z]**
- Przy wejściu do gry, jeśli istnieje zapis, gra pyta: „Wznowić grę?” z przyciskami „Wznów” i „Nowa gra”. Wznowiona gra startuje w pauzie. **[Z]**
- Po game over zapis przerwanej gry jest usuwany. **[Z]**
- Obok planszy widać 10 najlepszych wyników (nick + punkty). **[Z]**
- Gdy baza jest niedostępna, gra działa normalnie, tylko bez zapisu; gracz widzi krótki komunikat „Nie udało się zapisać”. **[Z]**
- Bezpieczeństwo: klucz publiczny (anon) jest w kodzie strony, więc dostęp do tabel ograniczają reguły RLS. Zapisy gry są dostępne tylko przez funkcje bazy, które wymagają identyfikatora gracza. Wyniki można tylko dodawać i czytać, a nie zmieniać ani usuwać. **[Z]**
- Schemat bazy: `supabase/schema.sql`. **[Z]**

## 8. Technika

- JavaScript + HTML. **[U]**
- Plansza zbudowana z elementów HTML (siatka div-ów), nie z `<canvas>`. **[U]**
- Czysty JavaScript, bez bibliotek; uruchamiana przez otwarcie `index.html` w przeglądarce. **[Z]**
- Z Supabase gra łączy się przez jego REST API zwykłym `fetch`, bez biblioteki `supabase-js`. Adres projektu i klucz publiczny (anon) są w pliku konfiguracyjnym strony. **[Z]**
- Logika gry (plansza, kolizje, obroty, zbijanie linii, punkty) oddzielona od wyświetlania i testowana automatycznie w Node (`node:test`, bez instalowania pakietów). **[Z]**
- Działa w aktualnym Chrome, Edge i Firefox. **[Z]**

---

## Na przyszłość (future)

- **Wznawianie gry na innym urządzeniu.** **[U]** Dziś zapis jest przypisany do identyfikatora ukrytego w przeglądarce, więc wznowić grę można tylko na tym samym urządzeniu. Rozważane warianty:
  1. **Kod gracza do przepisania** (np. `KLOC-7QX4-M2PA`), wpisywany na innym urządzeniu w „Mam kod”. Bez logowania i danych osobowych; w bazie zapis przypisany do kodu zamiast identyfikatora. *Rekomendowany.*
  2. **Nick + PIN.** Znajomy schemat, ale nick musi być unikalny, PIN łatwo zapomnieć, a 4 cyfry wymagają blokady wielu prób w bazie.
  3. **Logowanie e-mailem lub Google.** Najwygodniejsze, ale to dane osobowe dzieci (RODO, zgoda rodzica) i dużo więcej pracy.

  Tabela `scores` (ranking) się nie zmienia. Wariant 1 lub 2 wymaga zmiany `saved_games` i funkcji w `supabase/schema.sql`.

## Pytania otwarte

Brak — wszystkie rozstrzygnięte.
