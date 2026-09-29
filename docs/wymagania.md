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
- Podgląd następnego klocka, rekord zapamiętany w przeglądarce. **[U]**
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

## 7. Technika

- JavaScript + HTML. **[U]**
- Plansza zbudowana z elementów HTML (siatka div-ów), nie z `<canvas>`. **[U]**
- Czysty JavaScript, bez bibliotek; uruchamiana przez otwarcie `index.html` w przeglądarce. **[Z]**
- Logika gry (plansza, kolizje, obroty, zbijanie linii, punkty) oddzielona od wyświetlania i testowana automatycznie w Node (`node:test`, bez instalowania pakietów). **[Z]**
- Działa w aktualnym Chrome, Edge i Firefox. **[Z]**

---

## Pytania otwarte

Brak — wszystkie rozstrzygnięte.
