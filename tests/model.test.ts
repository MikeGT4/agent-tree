// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import type { AgentTreeLogEntry } from '../types'
import {
  adopted,
  chosen,
  clockTime,
  closed,
  completed,
  correctionFailed,
  correctionHeld,
  correctionRead,
  correctionSent,
  counts,
  createTree,
  detailLoaded,
  detailOpened,
  effortBar,
  excerpt,
  familyLabel,
  fmtShortDuration,
  fmtTokens,
  groups,
  isStopping,
  lookOpened,
  measured,
  MODEL_FAMILIES,
  modelLabel,
  pendingCorrection,
  phaseOf,
  pickerOpened,
  spawned,
  stepModelFor,
  stepped,
  stopCancelled,
  stopRequested,
  stopSent,
  synced,
  TOOL_TIMES_KEPT,
  toolLabel,
  toolRan,
  trimmed,
  turnStarted,
  typeLabel,
  wasStopSent,
} from '../hooks/model.ts'
import { connector, inputKey, pickerLines, planRows, pressKey, runningMark, shimmer, statusText, timelineBar } from '../hooks/view.tsx'
import { logLine, resolveLang, toolText } from '../hooks/words.ts'

const line = (entry: AgentTreeLogEntry | undefined) => (entry ? logLine(entry, 'de') : undefined)

const spawn = (agentId: string, extra: Record<string, unknown> = {}) => ({
  agentId,
  agentType: 'Explore',
  description: `Auftrag ${agentId}`,
  background: false,
  fork: false,
  ...extra,
})

const done = (agentId?: string, extra: Record<string, unknown> = {}) => ({
  agentId,
  answer: 'OK',
  reason: 'answer',
  isAborted: false,
  durationMs: 900,
  ...extra,
})

describe('Datenmodell', () => {
  test('ein Unteragent läuft und wird fertig', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    expect(counts(s)).toEqual({ running: 1, done: 0, failed: 0, stopped: 0 })
    s = completed(s, done('a1'), 2)
    expect(counts(s)).toEqual({ running: 0, done: 1, failed: 0, stopped: 0 })
    expect(s.agents[0]?.endedAt).toBe(2)
  })

  test('ein abgebrochener Unteragent gilt als gestoppt, ein abgelehnter als fehlgeschlagen', () => {
    let s = spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 1)
    s = completed(s, done('a1', { reason: 'aborted', isAborted: true }), 2)
    s = completed(s, done('a2', { reason: 'refusal' }), 2)
    expect(counts(s)).toEqual({ running: 0, done: 0, failed: 1, stopped: 1 })
  })

  test('Berateraufrufe zählen je Ort und nur einmal je Kennung', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = stepped(s, { model: 'claude-opus-5-5', advisorUses: [{ id: 'x1', startedAt: 10, endedAt: 4010 }] }, 5000)
    s = stepped(s, { agentId: 'a1', model: 'claude-opus-5-5', advisorUses: [{ id: 'x2', startedAt: 20 }] }, 6000)
    s = stepped(s, { model: 'claude-opus-5-5', advisorUses: [{ id: 'x1', startedAt: 10, endedAt: 4010 }] }, 7000)
    expect(s.advisor.calls.map(c => [c.id, c.agentId ?? 'main', c.durationMs ?? -1])).toEqual([
      ['x1', 'main', 4000],
      ['x2', 'a1', -1],
    ])
  })

  test('kürzen behält laufende und wirft die ältesten fertigen', () => {
    let s = createTree(0)
    for (const id of ['a', 'b', 'c', 'd']) s = spawned(s, spawn(id), 1)
    for (const [i, id] of ['a', 'b', 'c'].entries()) s = completed(s, done(id), 10 + i)
    s = trimmed(s, 2)
    expect(s.agents.map(n => n.id)).toEqual(['c', 'd'])
  })

  test('ein Workflow mit 25 Agenten ist ein Bündel, laufende stehen vorn', () => {
    let s = spawned(createTree(0), spawn('solo'), 0)
    s = completed(s, done('solo'), 1)
    for (let i = 1; i <= 25; i++) s = spawned(s, spawn(`w${i}`, { workflowRunId: 'wf_1' }), 1 + i)
    const g = groups(s)
    expect(g.map(x => x.kind)).toEqual(['workflow', 'agent'])
    const bundle = g[0]
    expect(bundle?.kind === 'workflow' ? [bundle.size, bundle.running, bundle.lastDescription] : []).toEqual([
      25,
      25,
      'Auftrag w25',
    ])
  })

  test('das Protokoll hält die neuesten 40 Einträge', () => {
    let s = createTree(0)
    for (let i = 0; i < 50; i++) s = spawned(s, spawn(`p${i}`), i)
    expect(s.log.length).toBe(40)
    expect(line(s.log.at(-1))).toContain('Auftrag p49')
  })

  test('Hauptsitzung: Phasen, Rückgaben, Kontext und gekürzter Prompt', () => {
    let s = turnStarted(createTree(0), { text: 'x'.repeat(500) }, 1)
    expect([phaseOf(s), s.main.turn, line(s.log.at(-1))?.length]).toEqual(['planning', 1, 69])
    s = spawned(s, spawn('a1'), 2)
    expect(phaseOf(s)).toBe('delegating')
    s = completed(s, done('a1', { answer: 'abcd'.repeat(100) }), 3)
    expect([phaseOf(s), s.main.returned, s.main.returnedTokens]).toEqual(['reviewing', 1, 100])
    s = measured(s, { tokens: 68000, window: 200000, percent: 34 })
    expect([s.main.contextTokens, s.main.window, s.main.percent]).toEqual([68000, 200000, 34])
    s = completed(s, done(undefined), 4)
    expect(phaseOf(s)).toBe('idle')
    s = turnStarted(s, { text: 'weiter' }, 5)
    expect([phaseOf(s), s.main.turn, s.main.returned]).toEqual(['planning', 2, 0])
  })

  test('eine Rückmeldung eines Unteragenten ist keine neue Nutzerrunde', () => {
    let s = turnStarted(createTree(0), { text: 'Prüf das Auth-Modul' }, 1)
    s = spawned(s, spawn('a1', { background: true }), 2)
    s = completed(s, done('a1'), 3)
    s = completed(s, done(undefined), 4)
    s = turnStarted(s, { text: '<agent-message from="a1"> [Unteragent hand-back] OK' }, 5)
    s = completed(s, done(undefined), 6)
    expect([s.main.turn, s.main.returned]).toEqual([1, 1])
    expect(s.log.map(e => line(e))).toEqual([
      'Runde 1: Prüf das Auth-Modul',
      'Explore gestartet: Auftrag a1',
      'Explore fertig nach 1 s · ↑ 1',
      'Hauptsitzung fertig nach 1 s',
    ])
  })

  test('das Protokoll steht in zeitlicher Reihenfolge, auch für späte Berater-Meldungen', () => {
    let s = turnStarted(createTree(0), { text: 'los' }, 100)
    s = spawned(s, spawn('a1'), 300)
    s = stepped(s, { model: 'claude-opus-5-5', advisorUses: [{ id: 'x1', startedAt: 200, endedAt: 250 }] }, 400)
    expect(s.log.map(e => e.at)).toEqual([100, 200, 300])
    expect(line(s.log[1])).toBe('gefragt aus Hauptsitzung')
  })

  test('übernimmt Agenten aus der Agentenliste, die vor dem Laden gestartet wurden', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = adopted(
      s,
      [
        { id: 'a1', description: 'Auftrag a1', type: 'Explore', status: 'running' },
        { id: 'x1', description: 'Vorher gestartet', type: 'Plan', status: 'running' },
        { id: 'x2', description: 'Schon fertig', type: 'general-purpose', status: 'completed' },
        { id: 'x3', description: 'Abgebrochen', type: 'general-purpose', status: 'killed' },
      ],
      5,
    )
    expect(s.agents.map(n => [n.id, n.type, n.status])).toEqual([
      ['a1', 'Explore', 'running'],
      ['x1', 'Plan', 'running'],
    ])
    expect(line(s.log.at(-1))).toBe('1 Agent aus der Agentenliste übernommen')
    expect(adopted(s, [{ id: 'x1', description: 'Vorher gestartet', type: 'Plan', status: 'running' }], 6)).toBe(s)
  })

  test('ein geweckter oder fortgesetzter Agent läuft wieder und behält seine Zahlen', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = toolRan(toolRan(s, { agentId: 'a1', label: 'Read a.ts' }, 2), { agentId: 'a1', label: 'Read b.ts' }, 3)
    s = completed(s, done('a1'), 4)
    s = turnStarted(s, { text: 'neue Nachricht', agentId: 'a1' }, 5)
    expect([s.agents[0]?.status, s.agents[0]?.endedAt]).toEqual(['running', undefined])
    s = completed(s, done('a1'), 6)
    s = spawned(s, spawn('a1'), 7)
    expect([s.agents.length, s.agents[0]?.status, s.agents[0]?.toolCount]).toEqual([1, 'running', 2])
    expect(line(s.log.at(-1))).toBe('Explore fortgesetzt: Auftrag a1')
  })

  test('verschachtelte Unteragenten zählen nicht als Rückgabe an die Hauptsitzung', () => {
    let s = turnStarted(createTree(0), { text: 'los' }, 1)
    s = spawned(s, spawn('p'), 2)
    s = spawned(s, spawn('c', { parentAgentId: 'p' }), 3)
    s = completed(s, done('c'), 4)
    expect(s.main.returned).toBe(0)
    s = completed(s, done('p'), 5)
    expect(s.main.returned).toBe(1)
  })

  test('ein Ende vor dem Eintrag des Starts geht nicht verloren', () => {
    let s = completed(createTree(0), done('ghost', { reason: 'error' }), 1)
    s = spawned(s, spawn('ghost'), 2)
    expect([s.agents[0]?.status, s.agents[0]?.endedAt]).toEqual(['failed', 1])
    let t = completed(createTree(0), done('early', { answer: 'Spätes Ergebnis' }), 5)
    t = spawned(t, spawn('early'), 7)
    const n = t.agents[0]
    expect([n?.answer, (n?.startedAt ?? 0) <= (n?.endedAt ?? 0), t.log.at(-1)?.kind, t.main.returned]).toEqual(['Spätes Ergebnis', true, 'agentEnded', 1])
  })

  test('ein Ende, das die Agentenliste zuerst meldet, behält Antwort, Rückweg und Protokoll', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = synced(s, [{ id: 'a1', status: 'completed' }], 2)
    s = completed(s, done('a1', { answer: 'Ergebnis' }), 3)
    expect([s.agents[0]?.status, s.agents[0]?.answer, s.main.returned, s.log.at(-1)?.kind]).toEqual(['done', 'Ergebnis', 1, 'agentEnded'])
    s = completed(s, done('a1', { answer: 'Ergebnis' }), 4)
    expect(s.main.returned).toBe(1)
  })

  test('beim Kürzen fallen auch die Modellwahlen der entfernten Agenten weg', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = spawned(s, spawn('a2'), 2)
    s = chosen(s, 'a1', 'sonnet', 3)
    s = completed(s, done('a1'), 4)
    s = trimmed(s, 1)
    expect(Object.keys(s.choices?.agents ?? {})).toEqual([])
  })

  test('eine Modellwahl gilt nur ihrem Ziel: die offene Auswahl eines anderen bleibt, ein entfernter Agent bekommt keine', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = spawned(s, spawn('a2'), 2)
    s = pickerOpened(s, 'a2')
    s = chosen(s, 'a1', 'sonnet', 3)
    expect([s.choices?.agents, s.choices?.picker]).toEqual([{ a1: 'sonnet' }, 'a2'])
    s = chosen(s, 'a2', 'opus', 4)
    expect([s.choices?.agents, s.choices?.picker]).toEqual([{ a1: 'sonnet', a2: 'opus' }, undefined])
    expect(chosen(s, 'gone', 'haiku', 5)).toBe(s)
  })

  test('abgebrochene Hauptrunde und leerer Rundentext', () => {
    let s = turnStarted(createTree(0), { text: 'los' }, 1)
    s = completed(s, done(undefined, { reason: 'aborted', isAborted: true }), 2)
    expect(line(s.log.at(-1))).toBe('Hauptsitzung abgebrochen nach 1 s')
    s = turnStarted(s, { text: '   ' }, 3)
    expect([s.main.turn, line(s.log.at(-1))]).toEqual([1, 'Hauptsitzung abgebrochen nach 1 s'])
  })

  test('Schritte setzen Modell, Effort und Kontext je Loop', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = stepped(s, { model: 'claude-opus-5-5', effort: 'high', contextTokens: 50000 }, 2)
    s = stepped(s, { agentId: 'a1', model: 'claude-haiku-4-5-20251001', effort: 'medium', contextTokens: 9000 }, 3)
    expect([s.main.model, s.main.effort]).toEqual(['claude-opus-5-5', 'high'])
    expect([s.agents[0]?.model, s.agents[0]?.effort, s.agents[0]?.contextTokens]).toEqual([
      'claude-haiku-4-5-20251001',
      'medium',
      9000,
    ])
  })

  test('Knöpfe der Leiste wirken über ihren Schlüssel', () => {
    const calls: string[] = []
    const actions = {
      pick: (target: string) => void calls.push(`pick ${target}`),
      choose: (target: string, family: string | undefined) => void calls.push(`choose ${target} ${family ?? '-'}`),
      close: () => void calls.push('close'),
      detail: (agentId: string) => void calls.push(`detail ${agentId}`),
      stop: (agentId: string) => void calls.push(`stop ${agentId}`),
    }
    const keys = ['pick:new', 'pick:a1', 'choose:new:default', 'choose:a1:sonnet', 'picker:close', 'detail:a1', 'detail:close', 'stop:a1', 'choose:sonnet', 'choose:a1:', 'picker', 'pickX', 'fremd:x']
    expect(keys.map(key => pressKey(actions, key))).toEqual([true, true, true, true, true, true, true, true, false, false, false, false, false])
    expect(calls).toEqual(['pick new', 'pick a1', 'choose new -', 'choose a1 sonnet', 'close', 'detail a1', 'close', 'stop a1'])
  })

  test('Modellwahl: gesehene Kennung der Familie, sonst ihr Alias', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = stepped(s, { model: 'claude-opus-5-5' }, 2)
    s = stepped(s, { agentId: 'a1', model: 'claude-sonnet-5-5' }, 3)
    expect([stepModelFor(s, 'opus'), stepModelFor(s, 'sonnet'), stepModelFor(s, 'haiku'), stepModelFor(s, 'mythos')]).toEqual([
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'haiku',
      'mythos',
    ])
    expect([...MODEL_FAMILIES.map(familyLabel), familyLabel('mythos')]).toEqual(['Haiku', 'Sonnet', 'Opus', 'Fable', 'Mythos'])
  })

  test('Zeilenplan: Kästen, Zeilen und Protokoll teilen sich die Höhe', () => {
    const wide = { wide: true, tight: false, asRows: false, perRow: 3, advisorRows: 15, earlier: false }
    expect(planRows({ ...wide, height: 40, total: 6 })).toEqual({ shown: 3, logRows: 3 })
    expect(planRows({ ...wide, height: 60, total: 6 })).toEqual({ shown: 6, logRows: 6 })
    expect(planRows({ ...wide, height: undefined, total: 12 })).toEqual({ shown: 9, logRows: 6 })
    const tight = { wide: false, tight: true, asRows: true, perRow: 3, advisorRows: 4, earlier: false }
    expect(planRows({ ...tight, height: 30, total: 6 })).toEqual({ shown: 2, logRows: 2 })
    expect(planRows({ ...tight, height: 30, total: 0 })).toEqual({ shown: 0, logRows: 6 })
  })

  test('die Auswahlzeile zählt ihre Umbrüche', () => {
    expect([pickerLines('neue Unteragenten', 120), pickerLines('neue Unteragenten', 59), pickerLines('neue Unteragenten', 30)]).toEqual([1, 2, 4])
  })

  test('Laufzeichen drehen sich je Takt, ohne Bewegung steht es still', () => {
    expect([0, 1, 2, 3, 4].map(f => runningMark(f, true))).toEqual(['◐', '◓', '◑', '◒', '◐'])
    expect(runningMark(3, false)).toBe('◐')
  })

  test('Werkzeuge und Abgleich mit der Agentenliste', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = toolRan(s, { agentId: 'a1', label: 'Read flow.ts' }, 2)
    expect([s.agents[0]?.toolCount, s.agents[0]?.lastTool]).toEqual([1, 'Read flow.ts'])
    s = synced(s, [{ id: 'a1', status: 'killed' }, { id: 'fremd', status: 'failed' }], 3)
    expect(s.agents.map(n => [n.id, n.status])).toEqual([['a1', 'stopped']])
  })

  test('Formatierer', () => {
    expect([fmtTokens(950), fmtTokens(12345), fmtTokens(250000), fmtTokens(1200000), fmtTokens(undefined)]).toEqual([
      '950',
      '12,3k',
      '250k',
      '1,2M',
      '',
    ])
    expect([effortBar('low'), effortBar('high'), effortBar('max'), effortBar(undefined)]).toEqual([
      '▮▯▯▯▯',
      '▮▮▮▯▯',
      '▮▮▮▮▮',
      '',
    ])
    expect(clockTime(Date.UTC(2026, 9, 22, 9, 48, 3))).toMatch(/^\d\d:\d\d:\d\d$/)
    expect([modelLabel('claude-opus-5-5'), modelLabel('claude-haiku-4-5-20251001'), modelLabel('opus'), modelLabel(undefined)]).toEqual([
      'Opus 5.5',
      'Haiku 4.5',
      'Opus',
      '',
    ])
    expect(toolLabel('Bash', { command: 'git   status' })).toBe('Bash git')
    expect(toolLabel('Read', { file_path: '/home/x/hooks/model.ts' })).toBe('Read model.ts')
    expect(toolLabel('Agent', { description: 'Prüfung', prompt: 'lang' })).toBe('Agent Prüfung')
    expect([toolText(toolLabel('SubagentHandback', { message: 'OK' }), 'de'), toolText('SubagentHandback', 'en')]).toEqual(['Antwort übergeben', 'answer handed back'])
  })

  test('kurze Dauer, Rundung, Modellkennungen und Typen mit Namensraum', () => {
    expect([fmtShortDuration(45_000), fmtShortDuration(65_000), fmtShortDuration(754_000), fmtShortDuration(3_900_000)]).toEqual([
      '45 s',
      '1:05',
      '12:34',
      '1 h 5',
    ])
    expect([fmtTokens(999_600), fmtTokens(99_960)]).toEqual(['1M', '100k'])
    expect([
      modelLabel('eu.cloud.claude-sonnet-4-5-20250929-v1:0'),
      modelLabel('claude-opus-4-1@20250805'),
      modelLabel('sonnet[1m]'),
      modelLabel('claude-3-5-sonnet-20241022'),
      modelLabel('claude-opus-5-20260101'),
    ]).toEqual(['Sonnet 4.5', 'Opus 4.1', 'Sonnet', 'Sonnet 3.5', 'Opus 5'])
    expect([typeLabel('plugin:code-review'), typeLabel('Explore')]).toEqual(['code-review', 'Explore'])
  })

  test('Etiketten und Texte zeigen keine Befehlsargumente, Muster oder Geheimnisse', () => {
    expect(toolLabel('Bash', { command: 'curl -s --data vertraulich https://x' })).toBe('Bash curl')
    expect(toolLabel('Bash', { command: '/usr/bin/git status' })).toBe('Bash git')
    expect(toolLabel('Bash', { command: 'git status', description: 'Zeige Status' })).toBe('Bash Zeige Status')
    expect(toolLabel('Grep', { pattern: 'ghp_abcdef123456' })).toBe('Grep')
    expect(toolLabel('WebSearch', { query: 'vertraulich' })).toBe('WebSearch')
    expect(toolLabel('Bash', { description: 'Push mit ghp_abcdefghijklmnop' })).toBe('Bash Push mit •••')
    expect(toolLabel('Agent', { description: 'x'.repeat(100) }).length).toBe(40)
    const s = turnStarted(createTree(0), { text: 'a\u001b[31mb\u202ec token=geheim123 ' + 'y'.repeat(100) }, 1)
    expect(line(s.log.at(-1))).toBe(`Runde 1: ${`a b c ••• ${'y'.repeat(100)}`.slice(0, 60)}`)
    const t = spawned(createTree(0), spawn('a1', { description: 'z'.repeat(120) }), 1)
    expect(t.agents[0]?.description.length).toBe(80)
  })

  test('Sprache: Einstellung, Vorgabe und Protokollzeilen in beiden Sprachen', () => {
    expect([
      resolveLang('auto', 'German'),
      resolveLang('auto', 'Deutsch'),
      resolveLang('auto', 'english'),
      resolveLang('auto', undefined),
      resolveLang('de', 'english'),
      resolveLang('en', 'German'),
    ]).toEqual(['de', 'de', 'en', 'en', 'de', 'en'])
    let s = turnStarted(createTree(0), { text: 'Prüf das' }, 1)
    s = spawned(s, spawn('a1'), 2)
    s = completed(s, { agentId: 'a1', answer: 'x'.repeat(400), reason: 'answer', isAborted: false, durationMs: 65000 }, 3)
    expect(s.log.map(e => logLine(e, 'en'))).toEqual(['Round 1: Prüf das', 'Explore started: Auftrag a1', 'Explore done after 1:05 min · ↑ 100'])
    expect(logLine({ at: 1, source: 'session', text: 'alter Eintrag' }, 'en')).toBe('alter Eintrag')
  })

  test('Zeitleiste: Balken je Kasten auf der Spanne der Runde', () => {
    expect(timelineBar(0, 10, 0, 10, 10)).toBe('██████████')
    expect(timelineBar(5, 10, 0, 10, 10)).toBe('░░░░░█████')
    expect(timelineBar(0, 1, 0, 100, 10)).toBe('█░░░░░░░░░')
    expect(timelineBar(100, 100, 0, 100, 10)).toBe('░░░░░░░░░█')
    expect(timelineBar(3, 3, 3, 3, 5)).toBe('█████')
    expect([shimmer('████', 1), shimmer('░░██', 4), shimmer('░░██', -1), shimmer('', 3)]).toEqual(['█▓██', '▒░██', '░░█▓', ''])
  })

  test('Details: öffnen, laden, schließen, abgelehnt', () => {
    let s = spawned(createTree(0), { ...spawn('a1'), prompt: 'Lies den Code und nenne token=geheim123 nicht.' }, 1)
    s = spawned(s, spawn('a2'), 2)
    s = detailOpened(s, 'a1')
    expect([s.detail, s.agents[0]?.task]).toEqual([{ agentId: 'a1', state: 'ready' }, 'Lies den Code und nenne ••• nicht.'])
    s = pickerOpened(s, 'new')
    expect([s.detail, s.choices?.picker]).toEqual([undefined, 'new'])
    s = detailOpened(s, 'a2')
    expect([s.detail, s.choices?.picker]).toEqual([{ agentId: 'a2', state: 'loading' }, undefined])
    s = detailLoaded(s, 'a2', { task: 'Früher Auftrag', answer: 'Zwischenstand' })
    expect([s.detail?.state, s.agents[1]?.task, s.agents[1]?.answer]).toEqual(['ready', 'Früher Auftrag', 'Zwischenstand'])
    s = detailOpened(s, 'a2')
    expect(s.detail).toBeUndefined()
    s = detailLoaded(detailOpened(spawned(s, spawn('a3'), 3), 'a3'), 'a3', { denied: true })
    expect(s.detail).toEqual({ agentId: 'a3', state: 'denied' })
    expect(closed(s).detail).toBeUndefined()
    s = stepped(s, { agentId: 'a1', answer: 'Halbzeit', model: 'claude-haiku-5-5' }, 4)
    expect(s.agents[0]?.answer).toBe('Halbzeit')
    expect(excerpt('a'.repeat(500)).length).toBe(160)
  })

  test('Stopp: nur für laufende Agenten, das Ende zählt als gestoppt', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = spawned(s, spawn('a2'), 1)
    s = stopRequested(s, 'a1', 2)
    s = stopRequested(s, 'a1', 3)
    expect([isStopping(s, 'a1'), isStopping(s, 'a2'), s.stopping, line(s.log.at(-1))]).toEqual([
      true,
      false,
      ['a1'],
      'Stopp für Explore angefordert',
    ])
    s = stopSent(stopSent(s, 'a1'), 'a1')
    expect([wasStopSent(s, 'a1'), s.stopSent]).toEqual([true, ['a1']])
    s = completed(s, { agentId: 'a1', answer: 'Gestoppt.', reason: 'answer', isAborted: false, durationMs: 1000 }, 4)
    expect([s.agents[0]?.status, s.stopping, s.stopSent, line(s.log.at(-1))]).toEqual(['stopped', [], [], 'Explore gestoppt'])
    expect(stopRequested(s, 'a1', 5)).toBe(s)
    s = stopRequested(s, 'a2', 6)
    s = synced(s, [{ id: 'a2', status: 'completed' }], 7)
    expect([s.agents[1]?.status, s.stopping]).toEqual(['done', []])
  })

  test('Stopp zählt nur, wenn der Stoppbericht wirklich hinausging', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = spawned(s, spawn('a2'), 1)
    s = spawned(s, spawn('a3'), 1)
    s = stopRequested(stopRequested(stopRequested(s, 'a1', 2), 'a2', 2), 'a3', 2)
    s = completed(s, { agentId: 'a1', answer: 'Bericht', reason: 'answer', isAborted: false, durationMs: 1 }, 3)
    s = completed(s, { agentId: 'a2', answer: '', reason: 'error', isAborted: false, durationMs: 1 }, 3)
    s = stopCancelled(s, 'a3')
    expect([s.agents.map(n => n.status), isStopping(s, 'a3'), s.stopping]).toEqual([['done', 'failed', 'running'], false, []])
    s = synced(stopSent(stopRequested(s, 'a3', 4), 'a3'), [{ id: 'a3', status: 'completed' }], 5)
    expect(s.agents[2]?.status).toBe('stopped')
  })

  test('Maskierung: Schlüssel in Variablen, JSON und Google-Form', () => {
    for (const secret of [
      'DB_PASSWORD=hunter2',
      'AWS_SECRET_ACCESS_KEY=beispielwert',
      'PGPASSWORD=s3cr3t',
      '{"password": "hunter2"}',
      'key AIzaSyA1234567890abcdefghijklmnopqr',
      '\u001b[31mghp_abcdefghijklmnop\u001b[0m',
      '\u001b[32mBearer geheim123',
      'password="mein geheimes wort"',
      "token: 'zwei worte'",
      'https://nutzer:kennwort123@example.org/pfad',
      'Authorization: Basic dXNlcjpwYXNzd29yZA==',
      'DB_PASS=hunter3 psql',
      'MYSQL_PWD=hunter4',
    ]) {
      expect(excerpt(secret)).not.toMatch(/hunter2|beispielwert|s3cr3t|AIzaSy|ghp_|geheim123|geheimes|worte|kennwort123|dXNlcjpw|hunter3|hunter4/)
    }
    expect(excerpt('Lies den Code und prüfe die Tests')).toBe('Lies den Code und prüfe die Tests')
    expect(excerpt('SK-Kontenrahmen 03, Basic configuration, Kompass: Norden')).toBe('SK-Kontenrahmen 03, Basic configuration, Kompass: Norden')
    expect(toolLabel('Bash', { command: 'DB_PASS=hunter3 psql -h x' })).toBe('Bash psql')
  })

  test('leerer Auftrag zählt als unbekannt, gekürzte Agenten nehmen ihr Detail mit', () => {
    let s = spawned(createTree(0), { ...spawn('a1'), prompt: '' }, 1)
    expect([s.agents[0]?.task, detailOpened(s, 'a1').detail?.state]).toEqual([undefined, 'loading'])
    s = detailOpened(s, 'a1')
    s = completed(s, done('a1'), 2)
    for (let i = 2; i <= 6; i++) s = completed(spawned(s, spawn(`a${i}`), i + 1), done(`a${i}`), i + 2)
    s = trimmed(s, 5)
    expect([s.agents.some(n => n.id === 'a1'), s.detail]).toEqual([false, undefined])
  })

  test('Verbinder: Punkte laufen beim Verteilen nach außen und beim Zurückgeben nach innen', () => {
    expect(connector(21, [2, 10, 18], 10, 'split')).toBe('  ┌───────┼───────┐  ')
    expect(connector(21, [2, 10, 18], 10, 'split', 0)).toBe('  ┌──────•┼•──────┐  ')
    expect(connector(21, [2, 10, 18], 10, 'split', 2)).toBe('  ┌────•·─┼─·•────┐  ')
    expect(connector(21, [2, 10, 18], 10, 'merge', 0)).toBe('  └•──────┼──────•┘  ')
    expect(connector(21, [2, 10, 18], 10, 'merge', 2)).toBe('  └─·•────┼────•·─┘  ')
    expect(connector(21, [2, 10, 18], 10, 'split', 7)).toBe(connector(21, [2, 10, 18], 10, 'split', 0))
  })

  test('Kosten stehen in der Statuszeile, in beiden Sprachen', () => {
    let s = spawned(createTree(0), spawn('a1'), 1)
    s = measured(s, { tokens: 1000, window: 200000, percent: 1, costUsd: 0.4234 })
    expect([statusText(s, 'de'), statusText(s, 'en')]).toEqual([
      'Unteragenten [1/1] · Kontext [1 %] · 0,42 $',
      'Sub-agents [1/1] · context [1%] · $0.42',
    ])
    expect([fmtTokens(12345, '.'), fmtTokens(12345)]).toEqual(['12.3k', '12,3k'])
  })
})

describe('Korrekturen', () => {
  const one = () => spawned(createTree(0), spawn('sub-1'), 1)

  test('eine Korrektur wird als geschickt vermerkt, gezählt und maskiert protokolliert', () => {
    const s = correctionSent(one(), { agentId: 'sub-1', text: 'Nimm token=abc123 raus', via: 'append' }, 1000)
    const c = s.corrections?.['sub-1']
    expect([c?.state, c?.count, c?.via, c?.at]).toEqual(['sent', 1, 'append', 1000])
    expect(c?.text).toContain('•••')
    expect(c?.text).not.toContain('abc123')
    expect(line(s.log.at(-1))).toBe('Korrektur an Explore: Nimm ••• raus')
  })

  test('eine zweite Korrektur zählt weiter', () => {
    let s = correctionSent(one(), { agentId: 'sub-1', text: 'A', via: 'append' }, 2)
    s = correctionSent(s, { agentId: 'sub-1', text: 'B', via: 'send' }, 3)
    const c = s.corrections?.['sub-1']
    expect([c?.count, c?.via, c?.text, c?.state]).toEqual([2, 'send', 'B', 'sent'])
  })

  test('der nächste Schritt setzt gelesen, nur aus geschickt', () => {
    const fresh = one()
    expect(correctionRead(fresh, 'sub-1', 5)).toBe(fresh)
    let s = correctionSent(fresh, { agentId: 'sub-1', text: 'A', via: 'append' }, 2)
    s = correctionRead(s, 'sub-1', 2000)
    expect([s.corrections?.['sub-1']?.state, s.corrections?.['sub-1']?.readAt]).toEqual(['read', 2000])
    expect(correctionRead(s, 'sub-1', 3000)).toBe(s)
  })

  test('fehlgeschlagen behält den Zähler', () => {
    let s = correctionSent(one(), { agentId: 'sub-1', text: 'A', via: 'append' }, 2)
    s = correctionFailed(s, 'sub-1', 3)
    expect([s.corrections?.['sub-1']?.state, s.corrections?.['sub-1']?.count]).toEqual(['failed', 1])
    expect(line(s.log.at(-1))).toBe('Korrektur an Explore nicht zugestellt')
  })

  test('pendingCorrection kennt nur geschickte', () => {
    const fresh = one()
    expect(pendingCorrection(fresh, 'sub-1')).toBeUndefined()
    const s = correctionSent(fresh, { agentId: 'sub-1', text: 'A', via: 'append' }, 2)
    expect(pendingCorrection(s, 'sub-1')?.count).toBe(1)
    expect(pendingCorrection(correctionRead(s, 'sub-1', 3), 'sub-1')).toBeUndefined()
    expect(pendingCorrection(correctionFailed(s, 'sub-1', 3), 'sub-1')).toBeUndefined()
    expect(pendingCorrection(s, undefined)).toBeUndefined()
  })

  test('correctionHeld merkt sich das Anhalten der Rückgabe einmal', () => {
    const s = correctionSent(one(), { agentId: 'sub-1', text: 'A', via: 'append' }, 2)
    const held = correctionHeld(s, 'sub-1')
    expect(held.corrections?.['sub-1']?.held).toBe(true)
    expect(correctionHeld(one(), 'sub-1').corrections).toBeUndefined()
  })

  test('ein langer Text wird gekürzt vermerkt', () => {
    const s = correctionSent(one(), { agentId: 'sub-1', text: 'x'.repeat(5000), via: 'append' }, 2)
    expect(s.corrections?.['sub-1']?.text.length ?? 0).toBeLessThanOrEqual(160)
    expect(String(s.log.at(-1)?.data?.text ?? '').length).toBeLessThanOrEqual(60)
  })

  test('toolRan merkt sich höchstens 64 Zeiten', () => {
    let s = one()
    for (let i = 1; i <= 70; i++) s = toolRan(s, { agentId: 'sub-1', label: 'Read' }, 100 + i)
    const times = s.agents[0]?.toolTimes ?? []
    expect([times.length, times.at(-1), TOOL_TIMES_KEPT]).toEqual([64, 170, 64])
  })

  test('Aussehen und Modellwahl schließen einander', () => {
    let s = pickerOpened(one(), 'sub-1')
    s = lookOpened(s)
    expect([s.lookOpen, s.choices?.picker]).toEqual([true, undefined])
    s = pickerOpened(s, 'sub-1')
    expect([s.lookOpen, s.choices?.picker]).toEqual([undefined, 'sub-1'])
    s = closed(lookOpened(s))
    expect([s.lookOpen, s.choices?.picker]).toEqual([undefined, undefined])
  })
})

describe('Textfeld', () => {
  test('inputKey schickt nur bei submit', () => {
    const said: [string, string][] = []
    const actions = { pick: () => {}, choose: () => {}, close: () => {}, detail: () => {}, stop: () => {}, say: (id: string, value: string) => void said.push([id, value]) }
    expect(inputKey(actions, 'say:sub-1:0', 'submit', 'x')).toBe(true)
    expect(said).toEqual([['sub-1', 'x']])
    expect(inputKey(actions, 'say:sub-1:0', 'change', 'y')).toBe(false)
    expect(inputKey(actions, 'other:sub-1', 'submit', 'z')).toBe(false)
    expect(said.length).toBe(1)
  })
})

describe('Stopp am Kasten', () => {
  test('pressKey kennt halt', () => {
    const stopped: string[] = []
    const actions = { pick: () => {}, choose: () => {}, close: () => {}, detail: () => {}, stop: (id: string) => void stopped.push(id), say: () => {} }
    expect(pressKey(actions, 'halt:sub-1')).toBe(true)
    expect(stopped).toEqual(['sub-1'])
  })
})
