import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Snapshot } from '../types'

const PANE = 'plan-usage'
const PERIOD_MS = 60_000
const snapshot = atom({ plugin: 'plan-usage', key: 'snapshot' } as const, null, {
  shape: 'snapshot-2',
})

// Siła myślenia z ostatniego zapytania głównej pętli (nie subagentów).
const effort = atom({ plugin: 'plan-usage', key: 'effort' } as const, null)

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'Tydzień',
  spend_limit: 'Limit wydatków',
}

const label = (kind: string) => LABELS[kind] ?? kind

const untilReset = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return 'reset teraz'
  const min = Math.round(ms / 60_000)
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d > 0) return `reset za ${d}d ${h}h`
  if (h > 0) return `reset za ${h}h ${m}m`
  return `reset za ${m}m`
}

const bar = (pct: number, width = 20) => {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const color = (pct: number) => (pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green')

const modelText = (model: string, level: string | null) =>
  level ? `${model} [${level}]` : model

// ANSI: kolor procentu, reszta przygaszona — tak jak w natywnej linii statusu.
const ANSI = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' }

const lineText = (model: string, level: string | null, limits: Limit[], now: number, probing: boolean) => {
  const d = (t: string) => `${ANSI.dim}${t}${ANSI.reset}`
  const parts = [d(modelText(model, level))]
  if (limits.length === 0) parts.push(d(probing ? 'limity: odczyt…' : 'limity: brak odczytu'))
  for (const l of limits) {
    const reset = untilReset(l.resetsAt, now)
    parts.push(
      `${d(label(l.kind) + ' ')}${ANSI[color(l.percentUsed)]}${l.percentUsed}%${ANSI.reset}` +
        (reset ? d(` (${reset})`) : ''),
    )
  }
  return parts.join(d(' │ '))
}


export const register: Register = on => {
  let refreshNow: (() => Promise<void>) | undefined
  // Trwa startowe zapytanie po świeże limity.
  let probing = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'plan-usage',
      description: 'Pokaż zużycie limitów planu (5h i tygodniowy) w panelu',
    })

    const refresh = async () => {
      const usage = await $.session.usage()
      const model = await $.session.model()
      const now = await $.clock.now()
      const limits = usage.rateLimits.map(l => ({ ...l }))
      await update($, snapshot, () => ({ limits, model, checkedAt: now }))
      // Status moda ma prefiks „⚠ plan-usage:”, więc go czyścimy, a wiersz
      // zapisujemy do pliku, który czyta natywna linia statusu (settings.json → statusLine).
      $.ui.status(undefined)
      const home = (await $.env.get('HOME')) ?? '/tmp'
      const text = lineText(model, await read($, effort), limits, now, probing)
      // Osobny plik na sesję: inaczej kilka otwartych sesji nadpisuje sobie
      // nawzajem wiersz, a nowa sesja pokazuje stan z poprzedniej.
      // Linia statusu wybiera plik po session_id, który dostaje na stdin.
      const id = await $.session.id()
      await $.fs.write(`${home}/.claude/plan-usage/${id}.txt`, text)
      // Stary wspólny plik — dla konfiguracji statusLine sprzed tej zmiany.
      await $.fs.write(`${home}/.claude/plan-usage-status.txt`, text)
    }
    refreshNow = refresh

    // Limity przychodzą tylko w odpowiedzi API, więc przy starcie pytamy
    // najtańszy model o jeden token, żeby od razu pokazać aktualne zużycie.
    const probe = async () => {
      probing = true
      await refresh()
      try {
        await $.model.complete({ model: 'haiku', prompt: '.', maxTokens: 1, effort: 'low', timeoutMs: 20_000 })
      } catch {
        // Model zablokowany lub brak subskrypcji — zostaje „brak odczytu”.
      }
      probing = false
      await refresh()
    }
    void probe()
    $.clock.every(PERIOD_MS, () => {
      void refresh()
    })

    return next(e)
  })

  // Każde zapytanie głównej pętli niesie aktualną siłę myślenia.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const level = e.effort === undefined ? null : String(e.effort)
      if (level !== (await read($, effort))) {
        await update($, effort, () => level)
        if (refreshNow) await refreshNow()
      }
    }
    return yield* next(e)
  })

  // Silnik zgłasza zmianę limitów (np. po odpowiedzi API) — odśwież od razu.
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (refreshNow && e.rateLimits.length > 0) await refreshNow()
    return result
  })

  // Odśwież od razu po każdej turze: nowe limity i ewentualna zmiana /model.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (refreshNow) await refreshNow()
    return result
  })

  on('command.run', { command: 'plan-usage' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Zużycie planu' })
    return { text: 'Panel zużycia planu otwarty.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    const level = await read($, effort)
    const now = await $.clock.now()

    if (!snap || snap.limits.length === 0) {
      return (
        <Box flexDirection="column">
          {snap && <Text>Model: <Text bold>{snap.model}</Text> · Myślenie: <Text bold>{level ?? '—'}</Text></Text>}
          <Text dimColor>Brak odczytu limitów.</Text>
          <Text dimColor>Pojawi się po pierwszej odpowiedzi API (tylko konta Pro/Max).</Text>
        </Box>
      )
    }

    const ago = Math.round((now - snap.checkedAt) / 1000)

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text>Model: <Text bold>{snap.model}</Text> · Myślenie: <Text bold>{level ?? '—'}</Text></Text>
        </Box>
        {snap.limits.map(l => (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>{label(l.kind)}</Text>
            <Text color={color(l.percentUsed)}>
              {bar(l.percentUsed)} {l.percentUsed}%
            </Text>
            <Text dimColor>{untilReset(l.resetsAt, now)}</Text>
          </Box>
        ))}
        <Text dimColor>Sprawdzono {ago}s temu · odświeżanie co 60s</Text>
      </Box>
    )
  })
}
