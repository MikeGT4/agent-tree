// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { DEFAULT_LOOK, LOOK_OPTIONS, PALETTES } from '../hooks/looks.ts'
import { createTree } from '../hooks/model.ts'

const usage = { input_tokens: 2000, output_tokens: 40, cache_read_input_tokens: 30000, cache_creation_input_tokens: 0 }
const answering = (model: string) => ({ sonnet: 'claude-sonnet-5-5' } as Record<string, string>)[model] ?? model

type Appended = { agentId?: string; message: { type: string; content: { type: string; text: string }[] } }

function engine(on: On, listed: unknown[] = [], refuse: { append?: boolean; send?: boolean; command?: boolean; lag?: boolean; noAdvisor?: boolean; storeGet?: boolean; onSend?: () => Promise<unknown>; clearResets?: boolean; advisorFails?: string } = {}, saved: Record<string, unknown> = {}) {
  const status: string[] = []
  const stored: Record<string, unknown> = { ...saved }
  const storeSets: { key: string; value: unknown }[] = []
  const stepEfforts: unknown[] = []
  let storeBroken = false
  on('store.get', (_, e) => {
    if (refuse.storeGet || storeBroken) throw new Error('store')
    return { value: stored[(e as { key: string }).key] } as never
  })
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    stored[key] = value
    storeSets.push({ key, value })
    return { value: undefined } as never
  })
  const settings: Record<string, unknown> = {}
  const commands: { command: string; args: string }[] = []
  const fills: string[] = []
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('command.list', () =>
    ({ value: refuse.noAdvisor ? [] : [{ name: 'advisor', description: 'Advisor', source: 'builtin' }] }) as never,
  )
  const focused: string[] = []
  on('ui.focus', (_, e) => {
    focused.push(JSON.stringify(e))
    return {} as never
  })
  let deferred: (() => void) | undefined
  on('settings.read', () => {
    const value = { ...settings }
    const later = deferred
    deferred = undefined
    later?.()
    return { value } as never
  })
  on('command.run', (_, e) => {
    if (refuse.command) throw new Error('refused')
    commands.push({ command: e.command, args: e.args })
    if (e.command === 'advisor' && refuse.advisorFails) return {} as never
    const apply = () => {
      if (e.command === 'advisor' && e.args === 'off') delete settings.advisorModel
      else if (e.command === 'advisor') settings.advisorModel = e.args
    }
    if (refuse.lag) deferred = apply
    else apply()
    return { text: 'ok' } as never
  })
  on('prompt.fill', (_, e) => {
    fills.push((e as { text: string }).text)
    return { isFilled: true } as never
  })
  const appended: Appended[] = []
  const sent: { to: unknown; text: string }[] = []
  on('session.append', async (_, e, next) => {
    const row = e as unknown as Appended
    if (refuse.append && row.agentId) return { deny: 'no running loop' } as never
    appended.push(row)
    return next(e)
  })
  on('session.send', async (_, e) => {
    if (refuse.send) return { isDelivered: false, reason: 'gone' } as never
    sent.push(e as never)
    await refuse.onSend?.()
    return { isDelivered: true } as never
  })
  const spawnModels: (string | undefined)[] = []
  const stepModels: string[] = []
  let spawnCount = 0
  on('command.register', () => ({ value: { command: 'agent-tree' } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.status', (_, e) => {
    status.push(e.text ?? '')
    return { value: undefined } as never
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let newSession = false
  const isTree = (e: unknown) => (e as { plugin?: string; key?: string }).plugin === 'agent-tree' && (e as { key?: string }).key === 'tree'
  on('state.get', async (_, e, next) => (refuse.clearResets && newSession && isTree(e) ? ({ value: createTree(0), version: 0 } as never) : next(e)))
  on('state.set', async (_, e, next) => {
    if (isTree(e)) newSession = false
    return next(e)
  })
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  const sessionReplaced = () => {
    newSession = true
  }
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('agent.list', () => ({ value: listed }) as never)
  on('agent.spawn', async (_, e) => {
    spawnModels.push(e.model)
    spawnCount += 1
    return { model: 'claude-haiku-4-5-20251001', agentId: `sub-${spawnCount}` }
  })
  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_, e) => ({ text: e.answer }) as never)
  on('tool.call', async () => ({ result: 'ok', text: 'ok' }) as never)
  on('turn.step', async function* (_, e) {
    stepModels.push(e.model)
    stepEfforts.push(e.effort)
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: { ...usage, model: answering(e.model) },
      ...(e.messageCount === 99
        ? { serverToolUses: [{ id: 'adv-1', name: 'advisor', input: {}, startedAt: 1000, endedAt: 4000 }] }
        : {}),
    }
  })
  const storeGetFails = () => {
    storeBroken = true
  }
  return { status, spawnModels, stepModels, stepEfforts, appended, sent, storeSets, settings, commands, fills, focused, stored, toasts, storeGetFails, sessionReplaced }
}

async function step($: Engine, options: { agentId?: string; advisor?: boolean; chunks?: unknown[]; noEffort?: boolean } = {}) {
  const stream = $.turn.step({
    turnId: 't1',
    index: 0,
    model: options.agentId ? 'claude-haiku-4-5-20251001' : 'claude-opus-5-5',
    ...(options.noEffort ? {} : { effort: options.agentId ? ('medium' as const) : ('high' as const) }),
    messageCount: options.advisor ? 99 : 3,
    ...(options.agentId ? { agentId: options.agentId } : {}),
  })
  let read = await stream.next()
  while (!read.done) {
    options.chunks?.push(read.value)
    read = await stream.next()
  }
  return read.value
}

const pane = (bodyColumns: number, bodyRows = 60) =>
  ({
    plugin: 'agent-tree',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'agent-tree',
    props: {
      title: 'Agent Tree',
      isFocused: false,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows },
      view: {},
    },
  }) as const

const de = { options: { language: 'de' } }

async function screen(ui: { drawn: () => Promise<unknown> }): Promise<string> {
  return JSON.stringify(await ui.drawn())
}

async function startSession($: Engine) {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
}

async function oneAgentWithAdvisor($: Engine) {
  await startSession($)
  await $.turn.start({ text: 'Prüf das Auth-Modul', turnId: 't1' })
  await step($, { advisor: true })
  await $.agent.spawn({ prompt: 'Lies den Code.', description: 'Code lesen', subagentType: 'Explore' } as never)
  await step($, { agentId: 'sub-1' })
  await $.tool.call({ tool: 'Read', file_path: '/x/auth.ts', agentId: 'sub-1' } as never)
}

describe('Agent Tree', () => {
  test('der Befehl öffnet die Leiste und nennt sich', de, async ($, on) => {
    engine(on)
    await startSession($)
    const opened = await $.command.run({
      command: 'agent-tree',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 200 },
    })
    expect(opened.text).toContain('Agent Tree')
  })

  test('beim Öffnen erscheinen Agenten, die vor dem Laden des Mods gestartet wurden', de, async ($, on) => {
    engine(on, [{ id: 'early-1', description: 'Vorher gestartet', type: 'Plan', status: 'running' }])
    await startSession($)
    const opened = await $.command.run({
      command: 'agent-tree',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 200 },
    })
    expect(opened.text).toContain('1 Agent bisher')
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Vorher gestartet/)
    await ui.unmount()
  })

  test('die Leiste zeigt Hauptsitzung, Unteragent, Berater und Protokoll', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Hauptsitzung/)
    expect(await screen(ui)).toMatch(/Opus 5\.5/)
    expect(await screen(ui)).toMatch(/Code lesen/)
    expect(await screen(ui)).toMatch(/Read auth\.ts/)
    expect(await screen(ui)).toMatch(/Aufrufe 1/)
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    expect(seen.status.at(-1)).toBe('Unteragenten [1/1] · Berater [1×]')
    await ui.unmount()
  })

  test('ein verschachtelter Unteragent nennt seinen Auftraggeber, auf Terminal und Desktop', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Prüfe.', description: 'Unterauftrag', subagentType: 'general-purpose', parentAgentId: 'sub-1' } as never)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...pane(90), surface })
      expect(await screen(ui)).toMatch(/↳ unter Explore/)
      await ui.unmount()
    }
  })

  test('Modellwahl für neue Unteragenten setzt das Modell beim Start, ein eigenes Modell des Aufrufs bleibt', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Modell für neue Unteragenten/)
    await ui.press({ key: 'choose:new:opus' })
    await ui.unmount()
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    await $.agent.spawn({ prompt: 'Q.', description: 'Eigen', subagentType: 'Plan', model: 'haiku' } as never)
    expect(seen.spawnModels.slice(-2)).toEqual(['opus', 'haiku'])
  })

  test('die Modellwahl für neue Unteragenten wird gespeichert, Standard leert sie', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'choose:new:haiku' })
    expect(seen.storeSets.filter(s => s.key === 'model').at(-1)).toEqual({ key: 'model', value: 'haiku' })
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'choose:new:default' })
    expect(seen.storeSets.filter(s => s.key === 'model').at(-1)).toEqual({ key: 'model', value: null })
    await ui.unmount()
  })

  test('die Wahl für einen einzelnen Agenten wird nicht gespeichert', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:sub-1' })
    await ui.press({ key: 'choose:sub-1:sonnet' })
    expect(seen.storeSets.filter(s => s.key === 'model')).toEqual([])
    await ui.unmount()
  })

  test('eine gespeicherte Modellwahl gilt beim Start und steht am Knopf', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet' })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Sonnet ▾')
    await ui.unmount()
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('sonnet')
  })

  test('ein unbekanntes gespeichertes Modell gilt als Standard', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'gpt-9' })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Standard ▾')
    await ui.unmount()
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBeUndefined()
  })

  test('ein Aussehen aus einem anderen Terminal gilt ab dem nächsten Zug', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    seen.stored.look = { style: 'ascii', colors: 'retro', light: 'gold' }
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toContain(PALETTES.retro.agent)
    await ui.unmount()
  })

  test('eine laufende Sitzung behält ihre Modellwahl, auch wenn ein anderes Terminal eine andere speichert', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet' })
    await oneAgentWithAdvisor($)
    seen.stored.model = 'haiku'
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Sonnet ▾')
    await ui.unmount()
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('sonnet')
  })

  test('kann der Speicher nicht gelesen werden, bleibt die Wahl der Sitzung', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet', look: { style: 'ascii', colors: 'retro', light: 'gold' } })
    await oneAgentWithAdvisor($)
    seen.storeGetFails()
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Sonnet ▾')
    expect(await screen(ui)).toContain(PALETTES.retro.agent)
    await ui.unmount()
  })

  test('die Denkstufe für Unteragenten steht in der Auswahl, wird gespeichert und steht am Knopf', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.redraw()
    for (const key of ['effort:new:default', 'effort:new:low', 'effort:new:medium', 'effort:new:high', 'effort:new:xhigh', 'effort:new:max']) {
      expect(await ui.find({ key })).toBeDefined()
    }
    await ui.press({ key: 'effort:new:max' })
    expect(seen.storeSets.filter(s => s.key === 'effort').at(-1)).toEqual({ key: 'effort', value: 'max' })
    await ui.redraw()
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Standard · Max ▾')
    await ui.unmount()
  })

  test('die Denkstufe für Unteragenten gilt für ihre Schritte, nicht für die Hauptsitzung', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'effort:new:low' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('low')
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('high')
  })

  test('ein Modell ohne Denkstufe bekommt keine', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'effort:new:low' })
    await ui.unmount()
    await step($, { agentId: 'sub-1', noEffort: true })
    expect(seen.stepEfforts.at(-1)).toBeUndefined()
  })

  test('die Denkstufe eines Agenten geht der für alle Unteragenten vor, mit Hinweis auf die nächste Nachricht', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'effort:new:low' })
    await ui.press({ key: 'pick:sub-1' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/sobald es eine neue Nachricht bekommt/)
    await ui.press({ key: 'effort:sub-1:max' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('max')
    expect(seen.storeSets.filter(s => s.key === 'effort').at(-1)).toEqual({ key: 'effort', value: 'low' })
  })

  test('Standard bei der Denkstufe leert sie', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'effort:new:max' })
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'effort:new:default' })
    expect(seen.storeSets.filter(s => s.key === 'effort').at(-1)).toEqual({ key: 'effort', value: null })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('medium')
  })

  test('eine gespeicherte Denkstufe gilt beim Start, eine unbekannte nicht', de, async ($, on) => {
    const seen = engine(on, [], {}, { effort: 'xhigh', model: 'opus' })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Opus · XHigh ▾')
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('xhigh')
  })

  test('eine unbekannte gespeicherte Denkstufe gilt als Standard', de, async ($, on) => {
    const seen = engine(on, [], {}, { effort: 'turbo' })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Standard ▾')
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('medium')
  })

  test('Modellwahl für einen laufenden Agenten setzt seine nächsten Schritte um', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:sub-1' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Modell für Explore · Code lesen/)
    await ui.press({ key: 'choose:sub-1:sonnet' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    await step($, { agentId: 'sub-1' })
    await step($)
    expect(seen.stepModels.slice(-3)).toEqual(['sonnet', 'claude-sonnet-5-5', 'claude-opus-5-5'])
    const again = await $.ui.mount(pane(90))
    await again.press({ key: 'detail:sub-1' })
    await again.redraw()
    expect(await screen(again)).toMatch(/Sonnet 5\.5 · /)
    await again.unmount()
  })

  test('eine Modellwahl bleibt bei ihrem Agenten, auch wenn die Uhr erst nach dem Öffnen der nächsten Auswahl antwortet', de, async ($, on) => {
    const seen = engine(on)
    let held = false
    let release: (() => void) | undefined
    on('clock.now', async () => {
      if (held) {
        held = false
        await new Promise<void>(resolve => (release = resolve))
      }
      return { value: 1_000 } as never
    })
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Plane.', description: 'Plan bauen', subagentType: 'Plan' } as never)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:sub-1' })
    held = true
    await ui.press({ key: 'choose:sub-1:sonnet' })
    await ui.press({ key: 'pick:sub-2' })
    expect(release).toBeDefined()
    release?.()
    for (let i = 0; i < 4; i++) await ui.redraw()
    expect(await screen(ui)).toMatch(/Modell für Plan · Plan bauen/)
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    await step($, { agentId: 'sub-2' })
    expect(seen.stepModels.slice(-2)).toEqual(['sonnet', 'claude-haiku-4-5-20251001'])
  })

  test('die Berater-Spalte zeigt eine Zeitleiste mit Marken', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const bild = await screen(ui)
    expect(bild).toMatch(/┆ /)
    expect(bild).toMatch(/liest die ganze/)
    expect(bild).toMatch(/◆ \d\d:\d\d:\d\d Haupt/)
    await ui.unmount()
  })

  test('eine schmale Leiste stapelt und bleibt gültig', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(52))
    expect(await screen(ui)).toMatch(/Berater/)
    expect(await screen(ui)).toMatch(/Code lesen/)
    await ui.unmount()
  })

  test('bei 38 Spalten stehen Unteragenten als kompakte Zeilen', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(38))
    expect(await screen(ui)).toMatch(/◐ läuft · Explore · Code lesen/)
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('25 Agenten eines Workflows erscheinen als ein Kasten', de, async ($, on) => {
    engine(on)
    await startSession($)
    for (let i = 1; i <= 25; i++) {
      await $.agent.spawn({
        prompt: 'Prüfe.',
        description: `Prüfer ${i}`,
        subagentType: 'general-purpose',
        workflow: { runId: 'wf_test', agentIndex: i },
      } as never)
    }
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Workflow · 25/)
    await ui.unmount()
  })

  test('bei wenig Höhe bleiben laufende Kästen und das Protokoll, der Rest wird gezählt', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Viel zu tun', turnId: 't1' })
    for (let i = 1; i <= 6; i++) {
      await $.agent.spawn({ prompt: 'Prüfe.', description: `Prüfung ${i}`, subagentType: 'general-purpose' } as never)
    }
    for (let i = 1; i <= 3; i++) {
      await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: `sub-${i}`, reason: 'answer' })
    }
    const ui = await $.ui.mount(pane(90, 41))
    expect(await screen(ui)).toMatch(/Prüfung 6/)
    expect(await screen(ui)).not.toMatch(/Prüfung 1/)
    expect(await screen(ui)).toMatch(/\+3 weitere beendet/)
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('bei 30 Zeilen Höhe stehen Unteragenten als Zeilen und das Protokoll bleibt', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90, 30))
    expect(await screen(ui)).toMatch(/◐ läuft · Explore · Code lesen/)
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    expect(await screen(ui)).not.toMatch(/schreibt nie/)
    await ui.unmount()
  })

  test('Agenten früherer Runden erscheinen als eine Zeile, die neuen als Kästen', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Erste Runde', turnId: 't1' })
    await $.agent.spawn({ prompt: 'A.', description: 'Alt eins', subagentType: 'Explore' } as never)
    await $.agent.spawn({ prompt: 'B.', description: 'Alt zwei', subagentType: 'Explore' } as never)
    for (const agentId of ['sub-1', 'sub-2']) {
      await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId, reason: 'answer' })
    }
    await $.turn.complete({ answer: 'fertig', durationMs: 900, isAborted: false, turnId: 't1', reason: 'answer' })
    await $.turn.start({ text: 'Zweite Runde', turnId: 't2' })
    await $.agent.spawn({ prompt: 'C.', description: 'Neu', subagentType: 'Plan' } as never)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/aus früheren Runden: 2 Agenten/)
    expect(await screen(ui)).toMatch(/"Neu"/)
    expect(await screen(ui)).not.toMatch(/"Alt eins"/)
    await ui.unmount()
  })

  test('ein Hintergrundagent der Vorrunde, der in dieser Runde endet, bleibt als Kasten mit Rückweg', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Erste Runde', turnId: 't1' })
    await $.agent.spawn({ prompt: 'A.', description: 'Hintergrund', subagentType: 'Explore' } as never)
    await $.turn.complete({ answer: 'gestartet', durationMs: 900, isAborted: false, turnId: 't1', reason: 'answer' })
    await $.turn.start({ text: 'Zweite Runde', turnId: 't2' })
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/"Hintergrund"/)
    expect(await screen(ui)).toMatch(/1 Antwort/)
    expect(await screen(ui)).not.toMatch(/aus früheren Runden/)
    await ui.unmount()
  })

  test('/clear beginnt den Baum neu', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).not.toMatch(/Code lesen/)
    expect(await screen(ui)).toMatch(/noch keine Unteragenten/)
    await ui.unmount()
  })

  test('ein neuer Start des Moduls behält den Baum', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Code lesen/)
    await ui.unmount()
  })

  test('nach /clear bleiben gespeichertes Modell und Denkstufe', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet', effort: 'low' })
    await oneAgentWithAdvisor($)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Sonnet · Low ▾')
    await ui.unmount()
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('sonnet')
  })

  test('nach /agent-tree clear bleibt die Wahl der Sitzung', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'choose:new:opus' })
    await ui.unmount()
    await $.command.run({ command: 'agent-tree', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('opus')
  })

  test('ein erneuter Start des Moduls überschreibt die Wahl der Sitzung nicht', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet' })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'choose:new:opus' })
    await ui.unmount()
    seen.stored.model = 'haiku'
    await startSession($)
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('opus')
  })

  test('Sitzungen ohne Bedienung übernehmen keine gespeicherte Wahl', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet', effort: 'low' })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBeUndefined()
    expect(seen.toasts.join(' ')).not.toMatch(/gespeicherte Wahl/)
  })

  test('eine gespeicherte Wahl abseits von Standard meldet sich beim Start', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet', effort: 'low' })
    await startSession($)
    expect(seen.toasts.join(' ')).toMatch(/gespeicherte Wahl für Unteragenten: Sonnet · Low/)
  })

  test('mit Standard meldet sich beim Start nichts', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: null, effort: null })
    await startSession($)
    expect(seen.toasts.join(' ')).not.toMatch(/gespeicherte Wahl/)
  })

  test('das Eingabefeld im Detailkasten ist beschriftet', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'detail:sub-1' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Nachricht:/)
    expect(await screen(ui)).toMatch(/hier klicken und tippen/)
    await ui.unmount()
  })

  const limitAt = (month: number, day: number, hour: number, minute: number) => new Date(2026, month, day, hour, minute).toISOString()
  const limitWindows = [
    { kind: 'five_hour', percentUsed: 13, resetsAt: limitAt(9, 29, 1, 40) },
    { kind: 'seven_day', percentUsed: 84, resetsAt: limitAt(10, 2, 9, 0) },
  ]
  const measureLimits = ($: Engine, rateLimits: unknown[]) =>
    $.session.measure({ context: { window: 200000, tokens: 50000, percent: 25 }, rateLimits, cost: { usd: 1.5 }, changed: ['context', 'rateLimits'] } as never)

  test('unten in der Leiste stehen das 5-Stunden- und das Wochenlimit', de, async ($, on) => {
    engine(on)
    await startSession($)
    await measureLimits($, limitWindows)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toMatch(/5 h \S+ 13 % bis 01:40/)
    expect(text).toMatch(/Woche \S+ 84 % bis Mo\.? 09:00/)
    const texts = await ui.findAll({ type: 'Text' })
    const colorOf = (pattern: RegExp) => texts.find(f => pattern.test(f.text))?.props.color
    expect(colorOf(/Woche/)).toBeDefined()
    expect(colorOf(/Woche/)).not.toBe(colorOf(/^5 h /))
    await ui.unmount()
  })

  test('ohne Abo gibt es keine Zeile mit Limits', de, async ($, on) => {
    engine(on)
    await startSession($)
    await measureLimits($, [])
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).not.toMatch(/Woche|bis \d\d:\d\d/)
    await ui.unmount()
  })

  test('nach /clear bleiben die Limits stehen', de, async ($, on) => {
    engine(on)
    await startSession($)
    await measureLimits($, limitWindows)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Woche \S+ 84 %/)
    await ui.unmount()
  })

  test('beim Start liest die Leiste die Limits selbst', de, async ($, on) => {
    engine(on)
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: limitWindows } }) as never)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/5 h \S+ 13 %/)
    await ui.unmount()
  })

  test('die Limits auf Englisch', { options: { language: 'en' } }, async ($, on) => {
    engine(on)
    await startSession($)
    await measureLimits($, limitWindows)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toMatch(/5h \S+ 13% resets 01:40/)
    expect(text).toMatch(/week \S+ 84% resets Mon 09:00/)
    await ui.unmount()
  })

  test('der Kasten zeigt die Denkstufe, mit der der Unteragent läuft', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'effort:new:low' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    const again = await $.ui.mount(pane(90))
    expect(await screen(again)).toMatch(/▮▯▯▯▯ low/)
    await again.unmount()
  })

  test('ein auf ein Modell mit Denkstufe umgestellter Agent bekommt die gewählte Stufe', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'effort:new:low' })
    await ui.press({ key: 'pick:sub-1' })
    await ui.press({ key: 'choose:sub-1:opus' })
    await ui.unmount()
    await step($, { agentId: 'sub-1', noEffort: true })
    expect(seen.stepModels.at(-1)).toMatch(/opus/)
    expect(seen.stepEfforts.at(-1)).toBe('low')
  })

  test('nach dem Fortsetzen bleibt die gespeicherte Wahl', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet', effort: 'low' })
    await oneAgentWithAdvisor($)
    await $.session.end({ reason: 'resume', sessionId: 's1', resume: { id: 's2' } } as never)
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('sonnet')
  })

  test('ein erneuter Start meldet die gespeicherte Wahl nicht noch einmal', de, async ($, on) => {
    const seen = engine(on, [], {}, { model: 'sonnet', effort: 'low' })
    await startSession($)
    await startSession($)
    expect(seen.toasts.filter(t => /gespeicherte Wahl/.test(t))).toHaveLength(1)
  })

  test('englische Beschriftung, wenn die Sprache Englisch ist', { options: { language: 'en' } }, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    for (const word of [/Main session/, /Sub-agents/, /Session log/, /Calls 1/, /Sub-agent model: Default ▾/, /to sub-agents/]) expect(text).toMatch(word)
    expect(text).not.toMatch(/Hauptsitzung|Unteragenten|Sitzungsprotokoll|Aufrufe/)
    expect(seen.status.at(-1)).toBe('Sub-agents [1/1] · advisor [1×]')
    await ui.unmount()
  })

  test('Tasten an den Knöpfen: m, 0 bis 4, x', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.hotkey).toBe('m')
    await ui.press({ key: 'pick:new' })
    await ui.redraw()
    const keys = await Promise.all(
      ['choose:new:default', 'choose:new:haiku', 'choose:new:sonnet', 'choose:new:opus', 'choose:new:fable', 'picker:close'].map(async key => (await ui.find({ key }))?.props.hotkey),
    )
    expect(keys).toEqual(['0', '1', '2', '3', '4', 'x'])
    await ui.unmount()
  })

  test('Schriftgrößen: Titel als heading, Nebenzeilen als footnote, Hinweise als caption', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount({ ...pane(90), surface: 'desktop' })
    expect((await ui.find({ type: 'Text', text: /^AGENT TREE/ }))?.props.size).toBe('heading')
    expect((await ui.find({ type: 'Text', text: /^Code lesen$/ }))?.props.size).toBe('footnote')
    expect((await ui.find({ type: 'Text', text: /^Sitzungsprotokoll$/ }))?.props.size).toBe('caption')
    await ui.unmount()
    const terminal = await $.ui.mount(pane(90))
    expect(await screen(terminal)).toMatch(/AGENT TREE/)
    await terminal.unmount()
  })

  test('ein Klick auf den Typ zeigt Auftrag, Werkzeuge und letzte Antwort', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'detail:sub-1' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/Auftrag: Lies den Code\./)
    expect(text).toMatch(/Werkzeuge: Read auth\.ts/)
    expect(text).toMatch(/Zuletzt: noch keine Antwort/)
    expect((await ui.find({ key: 'stop:sub-1' }))?.props.hotkey).toBe('s')
    await ui.press({ key: 'detail:close' })
    await ui.redraw()
    expect(await screen(ui)).not.toMatch(/Auftrag: /)
    await ui.unmount()
  })

  test('Details eines vorher gestarteten Agenten kommen aus seinem Verlauf', de, async ($, on) => {
    engine(on, [{ id: 'early-1', description: 'Vorher gestartet', type: 'Plan', status: 'running' }])
    on('session.messages', () =>
      ({
        value: [
          { role: 'user', text: 'Früher Auftrag mit Bearer abcdef123456', toolUses: [] },
          { role: 'assistant', text: 'Zwischenstand', toolUses: [] },
          { role: 'assistant', text: '', toolUses: [] },
        ],
      }) as never,
    )
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'detail:early-1' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/Auftrag: Früher Auftrag mit •••/)
    expect(text).toMatch(/Zuletzt: Zwischenstand/)
    await ui.unmount()
  })

  test('Stopp: Werkzeuge werden abgelehnt, der nächste Schritt endet den Agenten', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'detail:sub-1' })
    await ui.redraw()
    await ui.press({ key: 'stop:sub-1' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/hält an …/)
    const denied = await $.tool.call({ tool: 'Read', file_path: '/x/b.ts', agentId: 'sub-1' } as never)
    expect(JSON.stringify(denied)).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    const before = seen.stepModels.length
    const chunks: unknown[] = []
    const first = await step($, { agentId: 'sub-1', chunks })
    expect(chunks.map(c => (c as { kind: string }).kind)).toEqual(['text', 'tool', 'input', 'stop'])
    expect((chunks[1] as { id: string; name: string }).name).toBe('SubagentHandback')
    expect((chunks[1] as { id: string }).id).toMatch(/^toolu_01[A-Za-z0-9]{22}$/)
    expect(JSON.parse((chunks[2] as { json: string }).json)).toEqual({ message: 'Im Agent Tree vom Nutzer gestoppt, nach 1 Werkzeugaufruf.' })
    expect([seen.stepModels.length - before, first.stopReason, first.toolUses]).toEqual([
      0,
      'tool_use',
      [{ name: 'SubagentHandback', input: { message: 'Im Agent Tree vom Nutzer gestoppt, nach 1 Werkzeugaufruf.' } }],
    ])
    const handback = await $.tool.call({ tool: 'SubagentHandback', message: 'Im Agent Tree vom Nutzer gestoppt.', agentId: 'sub-1' } as never)
    expect(JSON.stringify(handback)).not.toMatch(/deny/)
    const second = await step($, { agentId: 'sub-1' })
    expect([seen.stepModels.length - before, second.stopReason, second.toolUses.length]).toEqual([0, 'end_turn', 0])
    await $.turn.complete({ answer: second.answer, durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/○ gestoppt/)
    expect(text).toMatch(/Explore gestoppt/)
    expect(await step($)).toBeDefined()
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('Kosten der Sitzung stehen im Kasten der Hauptsitzung', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    await $.session.measure({ context: { window: 200000, tokens: 50000, percent: 25 }, rateLimits: [], cost: { usd: 1.5 }, changed: ['context', 'cost'] } as never)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Runde 1 · 1,50 \$/)
    expect(seen.status.at(-1)).toBe('Unteragenten [1/1] · Berater [1×] · Kontext [25 %] · 1,50 $')
    await ui.unmount()
  })

  test('ein Agent, der bei angefordertem Stopp selbst berichtet, endet normal', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'detail:sub-1' })
    await ui.redraw()
    await ui.press({ key: 'stop:sub-1' })
    const own = await $.tool.call({ tool: 'SubagentHandback', message: 'Mein Bericht', agentId: 'sub-1' } as never)
    expect(JSON.stringify(own)).not.toMatch(/deny/)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await $.turn.complete({ answer: 'Mein Bericht', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/● fertig/)
    expect(text).not.toMatch(/○ gestoppt/)
    await ui.unmount()
  })

  test('lange Typen werden gekürzt statt umbrochen', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Lauf', turnId: 't1' })
    await $.agent.spawn({ prompt: 'P.', description: 'Messung', subagentType: 'performance-optimizer-extra' } as never)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'detail:sub-1' }))?.props.label).toBe('performance-opti…')
    await ui.unmount()
  })

  test('ein Workflow ohne laufende Mitglieder zeigt Fehlschläge statt fertig', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Lauf', turnId: 't1' })
    for (let i = 1; i <= 3; i++) {
      await $.agent.spawn({ prompt: 'P.', description: `Teil ${i}`, subagentType: 'general-purpose', workflow: { runId: 'wf_f', agentIndex: i } } as never)
      await $.turn.complete({ answer: '', durationMs: 900, isAborted: false, turnId: 't1', agentId: `sub-${i}`, reason: 'error' })
    }
    const ui = await $.ui.mount(pane(38))
    expect(await screen(ui)).toMatch(/✗ 3 fehlgeschlagen · Workflow · 3/)
    await ui.unmount()
  })
})

describe('Korrektur', () => {
  async function openDetail($: Engine) {
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'detail:sub-1' })
    await ui.redraw()
    return ui
  }

  const text = (row: Appended | undefined) => row?.message.content[0]?.text ?? ''

  test('eine Korrektur an einen laufenden Agenten geht per append, die Hauptsitzung erfährt sie', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.unmount()
    expect(seen.appended.length).toBe(2)
    expect([seen.appended[0]?.agentId, seen.appended[0]?.message.type]).toEqual(['sub-1', 'user'])
    expect(text(seen.appended[0])).toContain('Nur lesen')
    expect(text(seen.appended[0])).toMatch(/Bericht über SubagentHandback/)
    expect(seen.appended[1]?.agentId).toBeUndefined()
    expect(text(seen.appended[1])).toContain('Code lesen')
    expect(text(seen.appended[1])).toContain('Nur lesen')
    expect(seen.sent.length).toBe(0)
  })

  test('nach dem nächsten Schritt ist die Korrektur gelesen und hält die Rückgabe nicht mehr an', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    const handback = await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    expect(JSON.stringify(handback)).not.toMatch(/deny/)
  })

  test('an einen fertigen Agenten geht die Korrektur per send', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Bitte noch die Tests' })
    await ui.unmount()
    expect(seen.sent.length).toBe(1)
    expect(JSON.stringify(seen.sent[0]?.to)).toContain('sub-1')
    expect(seen.sent[0]?.text).toContain('Bitte noch die Tests')
    expect(seen.sent[0]?.text).toMatch(/Bericht über SubagentHandback/)
    expect(seen.appended.filter(row => row.agentId === 'sub-1').length).toBe(0)
  })

  test('lehnt die Engine append ab, geht dieselbe Nachricht per send', de, async ($, on) => {
    const seen = engine(on, [], { append: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.unmount()
    expect(seen.sent.length).toBe(1)
    expect(seen.sent[0]?.text).toContain('Nur lesen')
    expect(seen.appended.length).toBe(1)
    expect(seen.appended[0]?.agentId).toBeUndefined()
  })

  test('eine ungelesene Korrektur hält SubagentHandback einmal an', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.unmount()
    const first = await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    expect(JSON.stringify(first)).toMatch(/deny/)
    expect(JSON.stringify(first)).toMatch(/neue Nachricht/)
    expect(JSON.stringify(first)).toMatch(/SubagentHandback erneut/)
    const second = await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    expect(JSON.stringify(second)).not.toMatch(/deny/)
  })

  test('ein angeforderter Stopp hat Vorrang vor der Korrektur', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.press({ key: 'stop:sub-1' })
    await ui.unmount()
    const handback = await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    expect(JSON.stringify(handback)).not.toMatch(/neue Nachricht/)
  })

  test('leerer Text schickt nichts', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: '   ' })
    await ui.redraw()
    expect(seen.appended.length + seen.sent.length).toBe(0)
    expect(await screen(ui)).not.toMatch(/Korrektur an/)
    await ui.unmount()
  })

  test('lehnen beide Wege ab, meldet sich die Korrektur in der Statuszeile und im Protokoll', de, async ($, on) => {
    const seen = engine(on, [], { append: true, send: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.redraw()
    expect(seen.appended.length + seen.sent.length).toBe(0)
    expect(seen.status.at(-1)).toMatch(/Korrektur nicht zugestellt/)
    expect(await screen(ui)).toMatch(/Korrektur an Explore nicht zugestellt/)
    await ui.unmount()
  })

  test('ein langer Text geht ganz an den Agenten', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'x'.repeat(5000) })
    await ui.unmount()
    expect(text(seen.appended[0])).toContain('x'.repeat(5000))
  })
})

describe('Textfeld, Status und Stopp am Kasten', () => {
  async function openDetail($: Engine, columns = 90) {
    const ui = await $.ui.mount(pane(columns))
    await ui.press({ key: 'detail:sub-1' })
    await ui.redraw()
    return ui
  }

  test('der Detailkasten eines Unteragenten hat ein Textfeld mit dem Fokus', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    const field = await ui.find({ key: 'say:sub-1:0' })
    expect(field).toBeDefined()
    expect((field?.props as { autoFocus?: boolean } | undefined)?.autoFocus).toBe(true)
    await ui.unmount()
  })

  test('nach dem Senden ist das Feld leer, nach einer gescheiterten Korrektur bleibt es', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.redraw()
    expect(await ui.find({ key: 'say:sub-1:1' })).toBeDefined()
    expect(await ui.find({ key: 'say:sub-1:0' })).toBeUndefined()
    await ui.unmount()
  })

  test('eine gescheiterte Korrektur lässt das Feld stehen', de, async ($, on) => {
    engine(on, [], { append: true, send: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.redraw()
    expect(await ui.find({ key: 'say:sub-1:0' })).toBeDefined()
    await ui.unmount()
  })

  test('in der Zeilenansicht bleibt das Zeichen der Korrektur trotz langer Beschreibung sichtbar', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const wide = await openDetail($)
    await wide.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await wide.unmount()
    const ui = await $.ui.mount(pane(38))
    const label = String((await ui.find({ key: 'detail:sub-1' }))?.props.label ?? '')
    expect(label).toMatch(/^◐ läuft ✉ · /)
    await ui.unmount()
  })

  test('das Textfeld nennt Esc zum Verlassen', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    expect(String((await ui.find({ key: 'say:sub-1:0' }))?.props.placeholder ?? '')).toMatch(/Esc/)
    await ui.unmount()
  })

  const finished = { answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' } as const

  test('endet ein Agent vor dem Lesen, schickt Agent Tree die Korrektur einmal nach', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nimm b.ts' })
    await ui.unmount()
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(1)
    expect(seen.sent[0]?.text).toContain('Nimm b.ts')
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(1)
  })

  test('ein angeforderter Stopp verhindert das Nachschicken', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nimm b.ts' })
    await ui.press({ key: 'stop:sub-1' })
    await ui.unmount()
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(0)
  })

  test('beim Nachschicken liest ein sofort startender Agent die Korrektur ohne Anhalten', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nimm b.ts' })
    await ui.unmount()
    refuse.onSend = () => step($, { agentId: 'sub-1' })
    await $.turn.complete(finished)
    const handback = await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    expect(JSON.stringify(handback)).not.toMatch(/deny/)
  })

  test('scheitert das Nachschicken, gilt die Korrektur als nicht zugestellt und die Hauptsitzung erfährt es', de, async ($, on) => {
    const refuse = { send: false }
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nimm b.ts' })
    refuse.send = true
    await $.turn.complete(finished)
    await ui.redraw()
    expect(await ui.find({ key: 'say:sub-1:1' })).toBeDefined()
    expect(await screen(ui)).toMatch(/Korrektur: nicht zugestellt/)
    expect(seen.appended.some(row => !row.agentId && (row.message.content[0]?.text ?? '').includes('nicht mehr angekommen'))).toBe(true)
    await ui.unmount()
  })

  test('nach einem Stopp bleibt keine ungelesene Korrektur als geschickt stehen', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nimm b.ts' })
    await ui.press({ key: 'stop:sub-1' })
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    await $.turn.complete(finished)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: nicht zugestellt/)
    expect(seen.sent.length).toBe(0)
    await ui.unmount()
  })

  test('mehrere ungelesene Korrekturen gehen zusammen nach', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Erstens A' })
    await ui.input({ key: 'say:sub-1:1', text: 'Zweitens B' })
    await ui.unmount()
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(1)
    expect(seen.sent[0]?.text).toMatch(/Erstens A[\s\S]*Zweitens B/)
  })

  test('nach /agent-tree clear wird keine alte Korrektur nachgeschickt', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nimm b.ts' })
    await ui.unmount()
    await $.command.run({ command: 'agent-tree', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(0)
  })

  test('in der Zeilenansicht steht beim Stoppen „hält an“', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(38))
    await ui.press({ key: 'halt:sub-1' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(String((await ui.find({ key: 'detail:sub-1' }))?.props.label ?? '')).toMatch(/hält an/)
    await ui.unmount()
  })

  test('ein in dieser Runde beendeter Workflow bleibt sichtbar', de, async ($, on) => {
    engine(on)
    let tick = 1000
    on('clock.now', () => ({ value: (tick += 10) }) as never)
    await startSession($)
    await $.turn.start({ text: 'Lauf', turnId: 't1' })
    for (let i = 1; i <= 2; i++) {
      await $.agent.spawn({ prompt: 'P.', description: `Teil ${i}`, subagentType: 'general-purpose', workflow: { runId: 'wf_r', agentIndex: i } } as never)
    }
    await $.turn.complete({ answer: 'ok', durationMs: 900, isAborted: false, turnId: 't1', reason: 'answer' })
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    for (let i = 1; i <= 2; i++) {
      await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't2', agentId: `sub-${i}`, reason: 'answer' })
    }
    const ui = await $.ui.mount(pane(38))
    expect(await screen(ui)).toMatch(/Workflow · 2/)
    await ui.unmount()
  })

  test('eine gelesene Korrektur wird beim Ende nicht nachgeschickt', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nimm b.ts' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(0)
  })

  test('scheitert eine zweite Korrektur, bleibt die erste offen', de, async ($, on) => {
    const refuse = { append: false, send: false }
    engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Erste Korrektur' })
    refuse.append = true
    refuse.send = true
    await ui.input({ key: 'say:sub-1:1', text: 'Zweite Korrektur' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/Korrektur: geschickt[^"]*Erste Korrektur/)
    expect(text).toMatch(/nicht zugestellt: Zweite Korrektur/)
    await ui.unmount()
  })

  test('ein per send neu gestarteter Agent liest die Korrektur schon im ersten Schritt', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    await $.turn.complete(finished)
    refuse.onSend = () => step($, { agentId: 'sub-1' })
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nimm b.ts' })
    await ui.unmount()
    const handback = await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    expect(JSON.stringify(handback)).not.toMatch(/deny/)
  })

  test('bei verschachtelten Agenten erfährt auch der laufende Eltern-Agent die Korrektur', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Prüfe.', description: 'Unterauftrag', subagentType: 'general-purpose', parentAgentId: 'sub-1' } as never)
    await step($, { agentId: 'sub-2' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'detail:sub-2' })
    await ui.redraw()
    await ui.input({ key: 'say:sub-2:0', text: 'Nur lesen' })
    await ui.unmount()
    expect(seen.appended.some(row => row.agentId === 'sub-1' && (row.message.content[0]?.text ?? '').includes('Nur lesen'))).toBe(true)
  })

  test('der Kasten zeigt geschickt und gelesen, der Detailkasten nennt den Stand', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await ui.input({ key: 'say:sub-1:0', text: 'Nur lesen' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/läuft[^"]*✉/)
    expect(await screen(ui)).toMatch(/Korrektur: geschickt/)
    await step($, { agentId: 'sub-1' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/läuft[^"]*✓/)
    expect(await screen(ui)).toMatch(/Korrektur: gelesen/)
    await ui.unmount()
  })

  test('der Stopp-Knopf am Kasten stoppt den Agenten', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ key: 'halt:sub-1' })).toBeDefined()
    await ui.press({ key: 'halt:sub-1' })
    await ui.redraw()
    expect(await ui.find({ key: 'halt:sub-1' })).toBeUndefined()
    expect(await screen(ui)).toMatch(/hält an …/)
    const denied = await $.tool.call({ tool: 'Read', file_path: '/x/b.ts', agentId: 'sub-1' } as never)
    expect(JSON.stringify(denied)).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    await ui.unmount()
  })

  test('bei 38 Spalten haben Zeile und Detailkasten Stopp-Knopf und Textfeld', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($, 38)
    expect(await ui.find({ key: 'halt:sub-1' })).toBeDefined()
    expect(await ui.find({ key: 'say:sub-1:0' })).toBeDefined()
    await ui.unmount()
  })
})

describe('Sichtbarkeit beim Korrigieren', () => {
  test('der Agent mit offenem Detailkasten bleibt als Kasten sichtbar', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'B.', description: 'Tests prüfen', subagentType: 'general-purpose' } as never)
    await $.agent.spawn({ prompt: 'C.', description: 'Doku holen', subagentType: 'general-purpose' } as never)
    await step($, { agentId: 'sub-2' })
    await step($, { agentId: 'sub-3' })
    const ui = await $.ui.mount(pane(73, 46))
    await ui.press({ key: 'detail:sub-3' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/weitere/)
    expect(await ui.find({ key: 'ag:sub-3' })).toBeDefined()
    await ui.unmount()
  })
})

describe('Modellwahl, Zeile und Fokus', () => {
  test('die Modellwahl heißt Unteragenten-Modell', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.label).toBe('Unteragenten-Modell: Standard ▾')
    await ui.unmount()
  })

  test('die Zeile „an Unteragenten“ bricht bei schmaler Leiste um', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(62))
    expect(await screen(ui)).toMatch(/"key":"label","flexDirection":"row","flexWrap":"wrap"/)
    await ui.unmount()
  })
})

describe('Berater per Knopf', () => {
  test('lehnt Claude Code das Modell ab, zeigt die Leiste weiter aus und nennt den Grund', de, async ($, on) => {
    const seen = engine(on, [], { advisorFails: 'Invalid advisor model: API error: 400 · model not changed' })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'advisor:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'advisor', args: 'opus' })
    expect((await ui.find({ key: 'advisor:toggle' }))?.props.label).toBe('einschalten')
    expect(seen.toasts.join(' ')).toMatch(/Claude Code hat den Berater nicht umgestellt/)
    await ui.unmount()
  })

  test('ohne Rang für das Hauptmodell bleibt der Berater aus', de, async ($, on) => {
    const seen = engine(on, [], { advisorFails: "Advisor disabled \u2014 base model 'claude-haiku' has no advisor rank in the model catalog." })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'advisor:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect((await ui.find({ key: 'advisor:toggle' }))?.props.label).toBe('einschalten')
    expect(seen.toasts.join(' ')).toMatch(/Claude Code hat den Berater nicht umgestellt/)
    await ui.unmount()
  })

  test('der Knopf schaltet den Berater über /advisor ein und wieder aus', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'advisor:toggle' }))?.props.label).toBe('einschalten')
    await ui.press({ key: 'advisor:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'advisor', args: 'opus' })
    expect((await ui.find({ key: 'advisor:toggle' }))?.props.label).toBe('ausschalten')
    expect(await screen(ui)).toMatch(/Opus/)
    await ui.press({ key: 'advisor:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'advisor', args: 'off' })
    expect((await ui.find({ key: 'advisor:toggle' }))?.props.label).toBe('einschalten')
    await ui.unmount()
  })

  test('kommt die Einstellung verzögert an, wartet die Leiste darauf und zeigt dann den neuen Stand', de, async ($, on) => {
    engine(on, [], { lag: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'advisor:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect((await ui.find({ key: 'advisor:toggle' }))?.props.label).toBe('ausschalten')
    await ui.unmount()
  })

  test('lehnt Claude Code den Befehl ab, bleibt die Eingabe unberührt und eine Meldung erscheint', de, async ($, on) => {
    const seen = engine(on, [], { command: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'advisor:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.fills).toEqual([])
    expect(seen.toasts.join(' ')).toMatch(/advisor/)
    await ui.unmount()
  })

  test('ohne /advisor zeigt die Leiste keinen Berater-Knopf', de, async ($, on) => {
    engine(on, [], { noAdvisor: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ key: 'advisor:toggle' })).toBeUndefined()
    await ui.unmount()
  })

  test('ein Umschalten von Hand kommt beim nächsten Zug in der Leiste an', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    seen.settings.advisorModel = 'opus'
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'advisor:toggle' }))?.props.label).toBe('ausschalten')
    await ui.unmount()
  })
})

describe('Aussehen in der Leiste', () => {
  const command = ($: Engine, args: string) =>
    $.command.run({ command: 'agent-tree', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })

  async function openLook($: Engine, columns = 90) {
    const ui = await $.ui.mount(pane(columns))
    await ui.press({ key: 'look:open' })
    await ui.redraw()
    return ui
  }

  test('der Knopf Aussehen hat die Taste a und öffnet alle Möglichkeiten', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'look:open' }))?.props.hotkey).toBe('a')
    await ui.press({ key: 'look:open' })
    await ui.redraw()
    for (const row of ['style', 'colors', 'light'] as const) {
      for (const id of LOOK_OPTIONS[row]) expect(await ui.find({ key: `look:${row}:${id}` })).toBeDefined()
    }
    expect((await ui.find({ key: 'look:style:line' }))?.props.variant).toBe('primary')
    expect(await ui.find({ key: 'look:default' })).toBeDefined()
    expect((await ui.find({ key: 'look:close' }))?.props.hotkey).toBe('x')
    await ui.press({ key: 'look:close' })
    await ui.redraw()
    expect(await ui.find({ key: 'look:style:line' })).toBeUndefined()
    await ui.unmount()
  })

  test('ein Stil wirkt sofort und wird gespeichert', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openLook($)
    await ui.press({ key: 'look:style:braille' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/⡏/)
    expect(text).toMatch(/⣿/)
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: { ...DEFAULT_LOOK, style: 'braille' } })
    await ui.unmount()
  })

  test('ein Farbschema färbt mit seinen Werten', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openLook($)
    await ui.press({ key: 'look:colors:light' })
    await ui.redraw()
    expect(await screen(ui)).toContain(PALETTES.light.agent)
    expect(await screen(ui)).not.toContain(PALETTES.original.agent)
    await ui.unmount()
  })

  test('eine gespeicherte Wahl gilt beim Start', de, async ($, on) => {
    engine(on, [], {}, { look: { style: 'ascii', colors: 'retro' } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toContain(PALETTES.retro.agent)
    expect(text).toMatch(/#{5}/)
    await ui.unmount()
  })

  test('zurück auf Standard setzt alles zurück', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openLook($)
    await ui.press({ key: 'look:style:hud' })
    await ui.press({ key: 'look:colors:mono' })
    await ui.press({ key: 'look:default' })
    await ui.redraw()
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: DEFAULT_LOOK })
    expect(await screen(ui)).toContain(PALETTES.original.agent)
    await ui.unmount()
  })

  test('der Befehl stellt Stil, Farben und Licht um', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    expect((await command($, 'stil braille')).text).toMatch(/Braille/)
    expect((await command($, 'farben retro')).text).toMatch(/Retro/)
    expect((await command($, 'licht gold')).text).toMatch(/Gold/)
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: { style: 'braille', colors: 'retro', light: 'gold' } })
  })

  test('ein unbekannter Name nennt die Möglichkeiten', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const text = (await command($, 'stil zickzack')).text ?? ''
    expect(text).toMatch(/Linie/)
    expect(text).toMatch(/ASCII/)
    expect(seen.storeSets.filter(s => s.key === 'look')).toEqual([])
  })

  test('bei 38 Spalten sind alle Knöpfe der Auswahl da', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openLook($, 38)
    for (const row of ['style', 'colors', 'light'] as const) {
      for (const id of LOOK_OPTIONS[row]) expect(await ui.find({ key: `look:${row}:${id}` })).toBeDefined()
    }
    await ui.unmount()
  })

  test('mit Bewegung färbt die Lichtfarbe eine Zelle des Balkens', de, async ($, on) => {
    engine(on, [], {}, { look: { light: 'gold' } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toContain('#F2C14E')
    await ui.unmount()
  })

  test('die Lichtfarbe liegt auf drei Zellen des Balkens und auf dem fließenden Punkt am Stamm', de, async ($, on) => {
    engine(on, [], {}, { look: { light: 'gold' } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    const gold = [...text.matchAll(/"color":"#F2C14E"\},"children":\["([^"]*)"\]/g)].map(m => m[1]).join('')
    expect(gold).toBe('●███')
    await ui.unmount()
  })

  test('die Auswahl zeigt das Licht als Vorschau, auch wenn nichts läuft', de, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'look:open' })
    await ui.redraw()
    await ui.press({ key: 'look:light:gold' })
    await ui.redraw()
    expect(await screen(ui)).toContain('#F2C14E')
    await ui.unmount()
  })

  test('ohne Bewegung kein Lichtstreifen', { options: { language: 'de', animate: false } }, async ($, on) => {
    engine(on, [], {}, { look: { light: 'gold' } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).not.toContain('#F2C14E')
    expect(text).not.toMatch(/[▓▒]/)
    await ui.unmount()
  })

  test('Mono behält die Statuszeichen', de, async ($, on) => {
    engine(on, [], {}, { look: { colors: 'mono' } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toContain(PALETTES.mono.agent)
    expect(text).toMatch(/◐ läuft/)
    await ui.unmount()
  })

  test('kann der Speicher nicht gelesen werden, gilt beim Speichern das aktuelle Aussehen', de, async ($, on) => {
    const refuse = { storeGet: false }
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'look:open' })
    await ui.redraw()
    await ui.press({ key: 'look:style:braille' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    refuse.storeGet = true
    await ui.press({ key: 'look:colors:retro' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: { style: 'braille', colors: 'retro', light: 'standard' } })
    await ui.unmount()
  })

  test('der Trennpunkt bricht mit dem Aussehen-Knopf um', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/"key":"look-group"/)
    await ui.unmount()
  })

  test('Aussehen zurück per Befehl, ein unbekanntes Argument nennt die gültigen', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    await command($, 'stil braille')
    await command($, 'aussehen zurück')
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: DEFAULT_LOOK })
    const help = (await command($, 'stopt')).text ?? ''
    expect(help).toMatch(/stop/)
    expect(help).toMatch(/clear/)
    expect(help).not.toMatch(/geöffnet/)
  })

  test('eine Wahl ändert im Speicher nur ihre Zeile', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    seen.stored.look = { style: 'braille', colors: 'original', light: 'standard' }
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'look:open' })
    await ui.redraw()
    await ui.press({ key: 'look:colors:retro' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: { style: 'braille', colors: 'retro', light: 'standard' } })
    await ui.unmount()
  })

  test('Pixel zeichnet Rahmen aus Halbblöcken und kräftige Äste', de, async ($, on) => {
    engine(on, [], {}, { look: { style: 'pixel' } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toMatch(/▗▄/)
    expect(text).toMatch(/▝▀/)
    expect(text).toMatch(/[━┃]/)
    await ui.unmount()
  })

  test('HUD zeichnet nur Ecken', de, async ($, on) => {
    engine(on, [], {}, { look: { style: 'hud' } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toMatch(/┌╴/)
    expect(text).toMatch(/╶┐/)
    await ui.unmount()
  })
})

describe('Stern-Hinweis', () => {
  const star = (toasts: string[]) => toasts.filter(t => t.includes('github.com/MikeGT4/agent-tree'))

  test('bittet beim zweiten Sitzungsstart genau einmal um einen Stern', de, async ($, on) => {
    const e = engine(on)
    await startSession($)
    expect(star(e.toasts)).toEqual([])
    await startSession($)
    await startSession($)
    expect(star(e.toasts).length).toBe(1)
  })

  test('in Sitzungen ohne Bedienung bittet er nicht', de, async ($, on) => {
    const e = engine(on)
    for (let i = 0; i < 3; i++) await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
    expect(star(e.toasts)).toEqual([])
  })
})

describe('Denkstufe der Hauptsitzung', () => {
  test('die Hauptsitzung hat einen Knopf für ihre Denkstufe, die Auswahl zeigt nur Stufen', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    const ui = await $.ui.mount(pane(90))
    const button = await ui.find({ key: 'pick:main' })
    expect(button?.props.hotkey).toBe('e')
    expect(button?.props.label).toMatch(/Effort .*high ▾/)
    await ui.press({ key: 'pick:main' })
    expect(await screen(ui)).toMatch(/Denkstufe der Hauptsitzung:/)
    for (const key of ['effort:main:default', 'effort:main:low', 'effort:main:medium', 'effort:main:high', 'effort:main:xhigh', 'effort:main:max', 'picker:close']) {
      expect(await ui.find({ key })).toBeDefined()
    }
    expect(await ui.find({ key: 'choose:main:opus' })).toBeUndefined()
    await ui.unmount()
  })

  test('die gewählte Stufe geht ab der nächsten Anfrage der Hauptsitzung hinaus und wird gespeichert', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:main' })
    await ui.press({ key: 'effort:main:medium' })
    expect(await ui.find({ key: 'effort:main:low' })).toBeUndefined()
    expect(seen.storeSets.filter(s => s.key === 'mainEffort').at(-1)).toEqual({ key: 'mainEffort', value: 'medium' })
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('medium')
    await ui.redraw()
    expect((await ui.find({ key: 'pick:main' }))?.props.label).toMatch(/Effort .*medium ▾/)
    await ui.unmount()
  })

  test('Unteragenten behalten ihre eigene Stufe', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:main' })
    await ui.press({ key: 'effort:main:low' })
    await ui.unmount()
    await $.agent.spawn({ prompt: 'P.', description: 'Lesen', subagentType: 'Explore' } as never)
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('medium')
  })

  test('Standard gibt die Stufe an Claude Code zurück', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:main' })
    await ui.press({ key: 'effort:main:max' })
    await ui.press({ key: 'pick:main' })
    await ui.press({ key: 'effort:main:default' })
    await ui.unmount()
    expect(seen.storeSets.filter(s => s.key === 'mainEffort').at(-1)).toEqual({ key: 'mainEffort', value: null })
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('high')
  })

  test('ein Modell ohne Denkstufe bekommt keine', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:main' })
    await ui.press({ key: 'effort:main:low' })
    await ui.unmount()
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($, { noEffort: true })
    expect(seen.stepEfforts.at(-1)).toBeUndefined()
  })

  test('eine gespeicherte Stufe gilt nach dem Start und meldet sich', de, async ($, on) => {
    const seen = engine(on, [], {}, { mainEffort: 'low' })
    await startSession($)
    expect(seen.toasts.join(' ')).toMatch(/Denkstufe der Hauptsitzung: Low/)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('low')
  })

  test('Sitzungen ohne Bedienung übernehmen keine gespeicherte Stufe', de, async ($, on) => {
    const seen = engine(on, [], {}, { mainEffort: 'low' })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('high')
  })

  test('auf Englisch', { options: { language: 'en' } }, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:main' })
    expect(await screen(ui)).toMatch(/Main session effort:/)
    await ui.unmount()
  })
})

describe('Nach /clear in einer neuen Sitzung', () => {
  test('Berater, Limits und alle Wahlen bleiben, obwohl die neue Sitzung leer beginnt', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    seen.settings.advisorModel = 'opus'
    await oneAgentWithAdvisor($)
    await $.session.measure({
      context: { window: 200000, tokens: 50000, percent: 25 },
      rateLimits: [{ kind: 'seven_day', percentUsed: 84, resetsAt: new Date(2026, 10, 2, 9, 0).toISOString() }],
      cost: { usd: 1.5 },
      changed: ['context', 'rateLimits'],
    } as never)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.press({ key: 'choose:new:sonnet' })
    await ui.press({ key: 'pick:main' })
    await ui.press({ key: 'effort:main:medium' })
    await ui.unmount()
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    seen.sessionReplaced()
    await $.turn.start({ text: 'Neu', turnId: 't9' })
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('medium')
    const after = await $.ui.mount(pane(90))
    const text = await screen(after)
    expect(text).toMatch(/Woche \S+ 84 %/)
    expect(text).toMatch(/Opus/)
    expect(text).not.toMatch(/Code lesen/)
    expect((await after.find({ key: 'pick:new' }))?.props.label).toMatch(/Sonnet/)
    await after.unmount()
  })
})
