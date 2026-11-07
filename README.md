# claude-plan-status

Mod do Claude Code, który pokazuje w linii statusu zużycie limitów planu Claude (Pro/Max), bieżący model i siłę myślenia:

![Linia statusu z modelem, siłą myślenia i zużyciem limitów 5h i tygodniowego](docs/statusline.png)

- odświeżanie co 60 s i po każdej odpowiedzi modelu,
- procenty w kolorze: zielony < 70%, żółty ≥ 70%, czerwony ≥ 90%,
- `/plan-usage` otwiera panel z paskami zużycia.

Każdy użytkownik widzi **wyłącznie własne** zużycie: dane pochodzą z odpowiedzi API w jego własnej sesji. Mod niczego nie wysyła na zewnątrz.

## Instalacja

W terminalu, w sesji Claude Code:

```
/plugin install plan-usage --marketplace KR3C1K/claude-plan-status
```

Odpowiedz `y` na „Add marketplace?”, a potem wybierz zakres (Enter = user).

Z powłoki:

```
claude plugin install plan-usage --marketplace KR3C1K/claude-plan-status
```

W aplikacji desktop: kliknij + obok pola promptu → Plugins → Add marketplace `KR3C1K/claude-plan-status` → Add plugin.

## Linia statusu (jednorazowo)

Mod zapisuje gotowy wiersz do `~/.claude/plan-usage-status.txt`. Żeby wyświetlał się w natywnej linii statusu, dodaj do `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "cat ~/.claude/plan-usage-status.txt 2>/dev/null"
}
```

i uruchom `claude` ponownie.

## Uwagi

- Limity są znane dopiero po pierwszej odpowiedzi API w sesji; wcześniej widać „limity: brak odczytu”.
- Limity pojawiają się tylko na kontach z subskrypcją (Pro/Max), nie przy kluczu API.
- Siła myślenia dotyczy głównej sesji (nie subagentów) i nie jest pokazywana dla modeli, które jej nie obsługują.

## Licencja

MIT
