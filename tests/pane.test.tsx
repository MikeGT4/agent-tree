// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { DEFAULT_LOOK, LOOK_OPTIONS, PALETTES } from '../hooks/looks.ts'
import { LOGO_COLORS, LOGO_EMPTY, LOGO_FLASH } from '../hooks/logo.ts'
import { createTree, pathKey } from '../hooks/model.ts'
import { VERSION } from '../hooks/news.ts'
import { wordsFor } from '../hooks/words.ts'
import type { AgentTreeState } from '../types'

const usage = { input_tokens: 2000, output_tokens: 40, cache_read_input_tokens: 30000, cache_creation_input_tokens: 0 }
const answering = (model: string) => ({ sonnet: 'claude-sonnet-5-5' } as Record<string, string>)[model] ?? model

type Appended = { agentId?: string; message: { type: string; content: { type: string; text: string }[] } }

function engine(on: On, listed: unknown[] = [], refuse: { send?: boolean; command?: boolean; lag?: boolean; noAdvisor?: boolean; storeGet?: boolean; onSend?: () => Promise<unknown>; clearResets?: boolean; advisorFails?: string; fillFails?: boolean; denyEdit?: boolean; failEdit?: boolean; denyHandback?: boolean; fast?: boolean; fastFails?: boolean; model?: string; modelOptions?: string[]; modelFails?: boolean; modelLocked?: boolean; codeMode?: boolean; stepTools?: string[]; mainStepTools?: string[]; theme?: string; storeSet?: boolean } = {}, saved: Record<string, unknown> = {}) {
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
    if (refuse.storeSet) throw new Error('store')
    const { key, value } = e as { key: string; value: unknown }
    stored[key] = value
    storeSets.push({ key, value })
    return { value: undefined } as never
  })
  on('store.keys', () => ({ value: Object.keys(stored) }) as never)
  on('store.delete', (_, e) => {
    delete stored[(e as { key: string }).key]
    return { value: undefined } as never
  })
  on('process.run', (_, e) => {
    const argv = (e as { argv: string[] }).argv
    if (argv[0] !== 'git') throw new Error('nicht erlaubt')
    return { value: { exitCode: 0, stdout: argv[1] === 'rev-parse' ? 'main\n' : ' M a.md\n', stderr: '' } } as never
  })
  const settings: Record<string, unknown> = {}
  const commands: { command: string; args: string }[] = []
  const fills: string[] = []
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  if (refuse.codeMode !== undefined) {
    const names = refuse.codeMode ? ['Bash', 'Read', 'REPL', 'Poll'] : ['Bash', 'Read']
    on('tool.list', () => ({ value: names.map(name => ({ name, description: name, isMcp: false })) }) as never)
  }
  on('command.list', () =>
    ({ value: refuse.noAdvisor ? [] : [{ name: 'advisor', description: 'Advisor', source: 'builtin' }] }) as never,
  )
  const rows: { key: string; label: string; kind: string; value: unknown; options?: string[]; provider: { plugin: string; tier: string }; isLocked: boolean }[] =
    refuse.fast === undefined
      ? []
      : [{ key: 'fast', label: 'Fast mode (Opus 5.5)', kind: 'boolean', value: refuse.fast, provider: { plugin: 'engine', tier: 'core' }, isLocked: false }]
  if (refuse.theme !== undefined) rows.push({ key: 'theme', label: 'Theme', kind: 'choice', value: refuse.theme, options: ['dark', 'light'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false })
  const menuDefault = 'Default (recommended)'
  const modelIds: Record<string, string> = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5', fable: 'claude-fable-5-2' }
  if (refuse.model !== undefined) {
    rows.push({
      key: 'model',
      label: 'Model',
      kind: 'choice',
      value: refuse.model === 'default' ? menuDefault : refuse.model,
      options: refuse.modelOptions ?? ['default', 'sonnet', 'opus', 'haiku', 'fable', 'best', 'sonnet[1m]', 'opus[1m]', 'fable[1m]', 'opusplan'],
      provider: { plugin: 'engine', tier: 'core' },
      isLocked: refuse.modelLocked === true,
    })
    on('session.model', () => {
      const held = String(rows.find(r => r.key === 'model')?.value)
      return { value: modelIds[held] ?? 'claude-opus-5-5' } as never
    })
  }
  on('config.list', () => ({ value: rows.map(row => ({ ...row })) }) as never)
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
    if (e.command === 'fast') {
      const row = rows.find(r => r.key === 'fast')
      if (row && !refuse.fastFails) row.value = e.args === 'on'
      return {} as never
    }
    if (e.command === 'model') {
      const row = rows.find(r => r.key === 'model')
      if (row && !refuse.modelFails) row.value = e.args === 'default' ? menuDefault : e.args
      return {} as never
    }
    const apply = () => {
      if (e.command === 'advisor' && e.args === 'off') delete settings.advisorModel
      else if (e.command === 'advisor') settings.advisorModel = e.args
    }
    if (refuse.lag) deferred = apply
    else apply()
    return { text: 'ok' } as never
  })
  on('prompt.fill', (_, e) => {
    if (refuse.fillFails) throw new Error('kein Feld')
    fills.push((e as { text: string }).text)
    return { isFilled: true } as never
  })
  const appended: Appended[] = []
  const sent: { to: unknown; text: string }[] = []
  on('session.append', async (_, e, next) => {
    const row = e as unknown as Appended
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
  on('ui.invalidate', (_, e, next) => next(e))
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.status', (_, e) => {
    status.push(e.text ?? '')
    return { value: undefined } as never
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let newSession = false
  const written = new Set<string>()
  const ownKey = (e: unknown) => ((e as { plugin?: string }).plugin === 'agent-tree' ? (e as { key?: string }).key : undefined)
  on('state.get', async (_, e, next) => {
    const key = ownKey(e)
    const real = await next(e)
    return refuse.clearResets && newSession && key && !written.has(key) ? ({ value: { value: undefined, version: 0 } } as never) : real
  })
  let lastTree = createTree(0)
  on('state.set', async (_, e, next) => {
    const key = ownKey(e)
    if (key && newSession) written.add(key)
    const held = (e as { value?: { shape?: string; value?: AgentTreeState } }).value
    if (key === 'tree' && held?.value) lastTree = held.shape !== undefined ? held.value : (held as AgentTreeState)
    return next(e)
  })
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  let sessionNumber = 1
  on('session.id', () => ({ value: `s${sessionNumber}` }) as never)
  const sessionReplaced = () => {
    newSession = true
    written.clear()
    sessionNumber += 1
  }
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('agent.list', () => ({ value: listed }) as never)
  on('agent.spawn', async (_, e) => {
    spawnModels.push(e.model)
    spawnCount += 1
    const resumed = (e as { resume?: { agentId: string } }).resume?.agentId
    return { model: 'claude-haiku-4-5-20251001', agentId: resumed ?? `sub-${spawnCount}` }
  })
  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_, e) => ({ text: e.answer }) as never)
  on('tool.call', async (_, e) => {
    const edit = (e as { tool?: string }).tool === 'Edit'
    if (edit && refuse.denyEdit) return { deny: 'User rejected' } as never
    if (refuse.denyHandback && (e as { tool?: string }).tool === 'SubagentHandback') return { deny: 'Regel' } as never
    if (edit && refuse.failEdit) return { result: 'String to replace not found', isError: true } as never
    return { result: 'ok', text: 'ok' } as never
  })
  on('turn.step', async function* (_, e) {
    stepModels.push(e.model)
    stepEfforts.push(e.effort)
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: (e.agentId ? (refuse.stepTools ?? []) : (refuse.mainStepTools ?? [])).map(name => ({ name, input: {} })),
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
  return { status, spawnModels, stepModels, stepEfforts, appended, sent, storeSets, settings, commands, fills, focused, stored, toasts, rows, storeGetFails, sessionReplaced, tree: () => lastTree }
}

async function step($: Engine, options: { agentId?: string; advisor?: boolean; chunks?: unknown[]; noEffort?: boolean; model?: string } = {}) {
  const stream = $.turn.step({
    turnId: 't1',
    index: 0,
    model: options.model ?? (options.agentId ? 'claude-haiku-4-5-20251001' : 'claude-opus-5-5'),
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

const de = { options: { language: 'de', intro: false, tips: false } }

async function screen(ui: { drawn: () => Promise<unknown> }): Promise<string> {
  return JSON.stringify(await ui.drawn())
}

type Pressable = { press: (target: { key: string }) => Promise<unknown>; drawn: () => Promise<unknown> }

async function steer(ui: Pressable, key: string) {
  const target = key.slice(key.indexOf(':') + 1)
  const drawn = JSON.stringify(await ui.drawn())
  if (!drawn.includes(`"key":"${key}"`) && drawn.includes(`"key":"select:${target}"`)) await ui.press({ key: `select:${target}` })
  return ui.press({ key })
}

async function sayCommand($: Engine, text: string, agentId = 'sub-1') {
  return $.command.run({ command: 'agent-tree', args: `an ${agentId} ${text}`, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as never)
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
    expect(await screen(ui)).toMatch(/liest auth\.ts/)
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
    await steer(ui, 'pick:new')
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
    await steer(ui, 'pick:new')
    await ui.press({ key: 'choose:new:haiku' })
    expect(seen.storeSets.filter(s => s.key === 'model').at(-1)).toEqual({ key: 'model', value: 'haiku' })
    await steer(ui, 'pick:new')
    await ui.press({ key: 'choose:new:default' })
    expect(seen.storeSets.filter(s => s.key === 'model').at(-1)).toEqual({ key: 'model', value: null })
    await ui.unmount()
  })

  test('die Wahl für einen einzelnen Agenten wird nicht gespeichert', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:sub-1')
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
    await steer(ui, 'pick:new')
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
    await steer(ui, 'pick:new')
    await ui.press({ key: 'effort:new:low' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('medium')
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    await step($, { agentId: 'sub-2' })
    expect(seen.stepEfforts.at(-1)).toBe('low')
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('high')
  })

  test('ein Modell ohne Denkstufe bekommt keine', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:new')
    await ui.press({ key: 'effort:new:low' })
    await ui.unmount()
    await $.agent.spawn({ prompt: 'P', description: 'Neu', subagentType: 'Plan' } as never)
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('low')
    await step($, { agentId: 'sub-1', noEffort: true })
    expect(seen.stepEfforts.at(-1)).toBeUndefined()
  })

  test('die Denkstufe eines Agenten geht der für alle Unteragenten vor, mit Hinweis auf die nächste Nachricht', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:new')
    await ui.press({ key: 'effort:new:low' })
    await steer(ui, 'pick:sub-1')
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
    await steer(ui, 'pick:new')
    await ui.press({ key: 'effort:new:max' })
    await steer(ui, 'pick:new')
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
    await steer(ui, 'pick:sub-1')
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Modell für Explore · Code lesen/)
    await ui.press({ key: 'choose:sub-1:sonnet' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    await step($, { agentId: 'sub-1' })
    await step($)
    expect(seen.stepModels.slice(-3)).toEqual(['sonnet', 'claude-sonnet-5-5', 'claude-opus-5-5'])
    const again = await $.ui.mount(pane(90))
    await steer(again, 'detail:sub-1')
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
    await steer(ui, 'pick:sub-1')
    held = true
    await ui.press({ key: 'choose:sub-1:sonnet' })
    await steer(ui, 'pick:sub-2')
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
    const ui = await $.ui.mount(pane(90, 42))
    expect(await screen(ui)).toMatch(/Prüfung 6/)
    expect(await screen(ui)).not.toMatch(/Prüfung 1/)
    expect(await screen(ui)).toMatch(/\+3 weitere beendet/)
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('bei 33 Zeilen Höhe stehen Unteragenten als Zeilen und das Protokoll bleibt', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90, 33))
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
    expect(await screen(ui)).toMatch(/" *Neu *"/)
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
    expect(await screen(ui)).toMatch(/" *Hintergrund *"/)
    expect(await screen(ui)).toMatch(/1 Antwort/)
    expect(await screen(ui)).not.toMatch(/aus früheren Runden/)
    await ui.unmount()
  })

  test('/clear beginnt den Baum neu, laufende Agenten bleiben stehen', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'P', description: 'Schon fertig', subagentType: 'Plan' } as never)
    await $.turn.complete({ turnId: 't1', agentId: 'sub-2', answer: 'ok', reason: 'answer', isAborted: false, durationMs: 5 } as never)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toMatch(/Code lesen/)
    expect(text).not.toMatch(/Schon fertig/)
    expect(text).not.toMatch(/Prüf das Auth-Modul/)
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
    await steer(ui, 'pick:new')
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
    await steer(ui, 'pick:new')
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

  test('die Limits auf Englisch', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
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
    await steer(ui, 'pick:sub-1')
    await ui.press({ key: 'effort:sub-1:low' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    const again = await $.ui.mount(pane(90))
    expect(await screen(again)).toMatch(/▮▯▯▯▯ low/)
    await again.unmount()
  })

  test('ein auf ein Modell mit Denkstufe umgestellter Agent bekommt die gewählte Stufe', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:new')
    await ui.press({ key: 'effort:new:low' })
    await ui.unmount()
    await $.agent.spawn({ prompt: 'Lies den Code.', description: 'Code lesen', subagentType: 'Explore' } as never)
    const again = await $.ui.mount(pane(90))
    await steer(again, 'pick:sub-1')
    await again.press({ key: 'choose:sub-1:opus' })
    await again.unmount()
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

  const introOn = { options: { language: 'de', intro: true, tips: false } }
  const plantDots = /[█▀]/
  const introStart = async ($: Engine, on: On, saved: Record<string, unknown> = {}) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const seen = engine(on, [], {}, saved)
    return { clock, seen }
  }

  test('beim Start baut sich das Logo auf, nach 2 s steht die normale Leiste', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(1200)
    await ui.redraw()
    const growing = await screen(ui)
    expect(growing).toMatch(plantDots)
    expect(growing).toMatch(/AGENT TREE/)
    expect(growing).not.toMatch(/Sitzungsprotokoll/)
    await clock.advance(1000)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('ein Klick überspringt das Intro', introOn, async ($, on) => {
    await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'intro:skip' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('nach einem Update steht nach dem Intro die Karte mit dem Neuen, bis OK gedrückt wird', introOn, async ($, on) => {
    const { clock } = await introStart($, on, { seenVersion: '0.7.7' })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(2200)
    await ui.redraw()
    const card = await screen(ui)
    expect(card).toContain(`AGENT TREE ${VERSION}`)
    expect(card).toMatch(/wurde aktualisiert/)
    expect(card).toMatch(/0\.7\.7 /)
    expect(card).toMatch(/lokales Modell für einfache Aufgaben/)
    expect(card).not.toMatch(/Verlauf: Klick zeigt deine Frage oder den Bericht/)
    expect(card).not.toMatch(/Läuft im Code Mode/)
    expect(card).not.toMatch(/Sitzungsprotokoll/)
    expect(card).toMatch(/\bOK\b/)
    await clock.advance(60_000)
    await ui.redraw()
    expect(await screen(ui)).toContain(`AGENT TREE ${VERSION}`)
    await ui.press({ key: 'notice:skip' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('ohne Intro kommt die Karte direkt, weiter führt zur Leiste', de, async ($, on) => {
    await introStart($, on, { seenVersion: '0.7.6' })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    const card = await screen(ui)
    expect(card).toContain(`AGENT TREE ${VERSION}`)
    expect(card).toMatch(/lokales Modell für einfache Aufgaben/)
    expect(card).not.toMatch(/Läuft im Code Mode/)
    await ui.press({ key: 'notice:skip' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('wird die Karte nie gezeichnet, gilt die Version nicht als gesehen', de, async ($, on) => {
    const { clock, seen } = await introStart($, on, { seenVersion: '0.7.7' })
    await startSession($)
    await clock.advance(6000)
    expect(seen.storeSets.some(set => set.key === 'seenVersion')).toBe(false)
  })

  test('die gezeichnete Karte merkt die Version', de, async ($, on) => {
    const { seen } = await introStart($, on, { seenVersion: '0.7.7' })
    await startSession($)
    expect(seen.storeSets.some(set => set.key === 'seenVersion')).toBe(false)
    const ui = await $.ui.mount(pane(90))
    expect(seen.storeSets).toContainEqual({ key: 'seenVersion', value: VERSION })
    await ui.unmount()
  })

  test('bei einer Erstinstallation keine Karte, die Version wird gemerkt', de, async ($, on) => {
    const { seen } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    expect(seen.storeSets).toContainEqual({ key: 'seenVersion', value: VERSION })
    await ui.unmount()
  })

  test('bei gleicher Version keine Karte und kein neuer Eintrag', de, async ($, on) => {
    const { seen } = await introStart($, on, { seenVersion: VERSION })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    expect(seen.storeSets.some(set => set.key === 'seenVersion')).toBe(false)
    await ui.unmount()
  })

  test('ein bisheriger Nutzer ohne gemerkte Version sieht die Karte ohne alte Nummer', de, async ($, on) => {
    await introStart($, on, { star: 2 })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    const card = await screen(ui)
    expect(card).toContain(`AGENT TREE ${VERSION}`)
    expect(card).not.toMatch(/0\.7\.7 /)
    expect(card).not.toMatch(/▶/)
    await ui.unmount()
  })

  test('Tippen beendet die Karte', de, async ($, on) => {
    await introStart($, on, { seenVersion: '0.7.7' })
    on('prompt.edit', (_$, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toContain(`AGENT TREE ${VERSION}`)
    const host = $.prompt as unknown as { edit: (input: unknown) => Promise<unknown> }
    await host.edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'h' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('ab Werk kommt das Logo', { options: { language: 'de', tips: false } }, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(1200)
    await ui.redraw()
    const shown = await screen(ui)
    expect(shown).toMatch(plantDots)
    expect(shown).not.toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('mit ausgeschalteter Option kein Intro', de, async ($, on) => {
    await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('mit reduzierter Bewegung kein Intro', introOn, async ($, on) => {
    const { seen } = await introStart($, on)
    seen.settings.prefersReducedMotion = true
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('ohne Bewegung kein Intro', { options: { language: 'de', intro: true, animate: false, tips: false } }, async ($, on) => {
    await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('ohne Bedienung kein Intro', introOn, async ($, on) => {
    await introStart($, on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('ein erneuter Start durch Neuladen spielt kein zweites Intro', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(2100)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    await startSession($)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('eine Sitzung mit laufenden Agenten zeigt kein Intro', introOn, async ($, on) => {
    await introStart($, on)
    await $.agent.spawn({ prompt: 'Lies den Code.', description: 'Code lesen', subagentType: 'Explore' } as never)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('ohne Zeichnen endet das Intro nach 5 s', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    await clock.advance(5100)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('während des Intros gibt es genau einen Knopf, die Logozeilen sind Text', introOn, async ($, on) => {
    await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.map(b => String(b.key))).toEqual(['intro:skip'])
    expect(buttons[0]?.props.label).toBe('überspringen')
    expect((await ui.findAll({ type: 'Box' })).filter(f => String(f.key).startsWith('intro-row')).length).toBeGreaterThan(5)
    await ui.unmount()
  })

  test('das Logo behält seine Farben in jedem Aussehen, die Startzeilen folgen dem Aussehen', introOn, async ($, on) => {
    const look = { style: 'line', colors: 'light', light: 'standard' } as const
    const { clock } = await introStart($, on, { look })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(1100)
    await ui.redraw()
    const colors = new Set((await ui.findAll({ type: 'Text' })).map(f => f.props.color).filter(Boolean))
    const allowed = new Set([...Object.values(LOGO_COLORS), LOGO_EMPTY, LOGO_FLASH, PALETTES.light.dim])
    expect(colors.has(LOGO_COLORS.O)).toBe(true)
    expect(colors.has(LOGO_COLORS.N)).toBe(true)
    expect([...colors].every(c => allowed.has(c as string))).toBe(true)
    await ui.unmount()
  })

  test('unter der Mindestbreite kein Intro', introOn, async ($, on) => {
    await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(39))
    expect(await screen(ui)).not.toMatch(plantDots)
    await ui.unmount()
  })

  const runCommand = ($: Engine, args: string) =>
    $.command.run({ command: 'agent-tree', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })

  const brailleCount = (text: string) => [...text].filter(c => c === '█' || c === '▀').length

  test('/agent-tree intro spielt das Intro, auch bei ausgeschalteter Option', de, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    expect((await runCommand($, 'intro')).text).toMatch(/Intro läuft/)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(1200)
    await ui.redraw()
    expect(await screen(ui)).toMatch(plantDots)
    expect(await screen(ui)).not.toMatch(/Sitzungsprotokoll/)
    await clock.advance(1000)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('/agent-tree intro mit Zusatz gibt es nicht und spielt nichts', de, async ($, on) => {
    await introStart($, on)
    await startSession($)
    const answer = (await runCommand($, 'intro kaskade')).text
    expect(answer).toMatch(/gibt es nicht/)
    expect(answer).toMatch(/intro,/)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('Tippen in der Eingabe beendet das Intro, der Text bleibt, wie er ist', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    on('prompt.edit', (_$, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(300)
    await ui.redraw()
    expect(brailleCount(await screen(ui))).toBeGreaterThan(0)
    const host = $.prompt as unknown as { edit: (input: unknown) => Promise<unknown> }
    const edited = await host.edit({ origin: { kind: 'composer' }, text: 'Ha', cursor: 2, start: 2, end: 2, inputText: 'l' })
    expect(edited).toEqual({ text: 'Hal', cursor: 3 })
    await clock.advance(1)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('/agent-tree intro nennt das Modell, auch wenn das Start-Intro aus war', de, async ($, on) => {
    const { clock } = await introStart($, on)
    on('session.model', () => ({ value: 'claude-haiku-5-5' }))
    await startSession($)
    await runCommand($, 'intro')
    const ui = await $.ui.mount(pane(90))
    await clock.advance(1500)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Modell Haiku 5\.5/)
    await ui.unmount()
  })

  test('ein Intro, das nicht in die Leiste passt, treibt ihre Animation nicht an', de, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    await $.agent.spawn({ prompt: 'Lies den Code.', description: 'Code lesen', subagentType: 'Explore' } as never)
    await runCommand($, 'intro')
    const ui = await $.ui.mount(pane(39))
    await ui.redraw()
    const before = await screen(ui)
    expect(before).toMatch(/Code lesen/)
    await clock.advance(40)
    await ui.redraw()
    expect(await screen(ui)).toBe(before)
    await ui.unmount()
  })

  test('am Ende bleibt das Logo stehen, bis die Leiste übernimmt', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(1100)
    await ui.redraw()
    const grown = brailleCount(await screen(ui))
    expect(grown).toBeGreaterThan(50)
    for (let ms = 1100; ms < 1960; ms += 40) {
      await clock.advance(40)
      await ui.redraw()
      expect(brailleCount(await screen(ui))).toBe(grown)
    }
    await clock.advance(100)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('das Intro zeichnet sich von selbst neu, auch ohne Bewegung', { options: { language: 'de', intro: false, animate: false } }, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    await runCommand($, 'intro')
    const ui = await $.ui.mount(pane(90))
    const first = await screen(ui)
    for (let i = 0; i < 15; i++) await clock.advance(40)
    expect(brailleCount(await screen(ui))).toBeGreaterThan(0)
    expect(await screen(ui)).not.toBe(first)
    for (let i = 0; i < 45; i++) await clock.advance(40)
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('das Intro bleibt in der Höhe der Leiste und schneidet lange Zeilen', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    on('session.usage', () =>
      ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 35 }, { kind: 'seven_day', percentUsed: 8 }, { kind: 'spend_limit', percentUsed: 12 }] } }) as never,
    )
    await startSession($)
    await runCommand($, 'intro')
    const tooLow = await $.ui.mount(pane(90, 14))
    await clock.advance(1500)
    await tooLow.redraw()
    expect((await tooLow.findAll({ type: 'Box' })).filter(f => String(f.key).startsWith('intro-row'))).toHaveLength(0)
    await tooLow.unmount()
    for (const [cols, rows] of [[90, 20], [40, 20]] as const) {
      await runCommand($, 'intro')
      const ui = await $.ui.mount(pane(cols, rows))
      await clock.advance(1500)
      await ui.redraw()
      const rowsDrawn = (await ui.findAll({ type: 'Box' })).filter(f => String(f.key).startsWith('intro-row'))
      expect(rowsDrawn.length).toBeGreaterThan(0)
      expect(rowsDrawn.length).toBeLessThanOrEqual(rows - 3)
      const shown = [...rowsDrawn, ...(await ui.findAll({ type: 'Text' }))]
      expect(shown.every(f => [...f.text].length <= cols)).toBe(true)
      await ui.unmount()
    }
  })

  test('unter 14 Zeilen kein Intro', introOn, async ($, on) => {
    await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90, 13))
    expect(brailleCount(await screen(ui))).toBe(0)
    await ui.unmount()
  })

  test('eingebettet bleibt das Intro niedrig', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const inline = pane(90, 38)
    const ui = await $.ui.mount({ ...inline, props: { ...inline.props, placement: 'inline' } } as never)
    await clock.advance(1200)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/AGENT TREE/)
    const rowsDrawn = (await ui.findAll({ type: 'Box' })).filter(f => String(f.key).startsWith('intro-row'))
    expect(rowsDrawn.length).toBeGreaterThan(0)
    expect(rowsDrawn.length).toBeLessThanOrEqual(20)
    await ui.unmount()
  })

  test('ein neues Abspielen mitten im Intro beginnt von vorn', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(1200)
    await runCommand($, 'intro')
    await clock.advance(40)
    await ui.redraw()
    expect(await screen(ui)).not.toMatch(/AGENT TREE/)
    await clock.advance(1500)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/AGENT TREE/)
    await clock.advance(700)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('die Startzeilen bleiben während des Intros gleich', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(200)
    await $.turn.start({ text: 'Hallo', turnId: 't1' })
    await step($)
    await clock.advance(1300)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/AGENT TREE/)
    expect(await screen(ui)).not.toMatch(/Modell Opus/)
    await ui.unmount()
  })

  test('ein startender Agent beendet das Intro', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(300)
    await $.agent.spawn({ prompt: 'Lies den Code.', description: 'Code lesen', subagentType: 'Explore' } as never)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Code lesen/)
    await ui.unmount()
  })

  test('eine unterdrückte erste Runde holt das Intro beim Neuladen nicht nach', introOn, async ($, on) => {
    await introStart($, on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('ein Neuladen mitten im Intro beginnt es nicht neu', introOn, async ($, on) => {
    const { clock } = await introStart($, on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(500)
    await startSession($)
    await clock.advance(1600)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('englische Beschriftung, wenn die Sprache Englisch ist', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    for (const word of [/Main session/, /Reports/, /Session log/, /Calls 1/, /Sub-agent model: Default ▾/, /to sub-agents/]) expect(text).toMatch(word)
    expect(text).not.toMatch(/Hauptsitzung|Unteragenten|Sitzungsprotokoll|Aufrufe/)
    expect(seen.status.at(-1)).toBe('Sub-agents [1/1] · advisor [1×]')
    await ui.unmount()
  })

  test('Tasten an den Knöpfen: m, 0 bis 4, x', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'pick:new' }))?.props.hotkey).toBe('m')
    await steer(ui, 'pick:new')
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
    expect((await ui.find({ type: 'Text', text: /^ *Code lesen *$/ }))?.props.size).toBe('footnote')
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
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/Auftrag: Lies den Code\./)
    expect(text).toMatch(/Werkzeuge: 1 · liest auth\.ts/)
    expect(text).toMatch(/Zuletzt: noch keine Antwort/)
    expect((await ui.find({ key: 'halt:sub-1' }))?.props.hotkey).toBe('s')
    await steer(ui, 'detail:close')
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
    await steer(ui, 'detail:early-1')
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
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    await steer(ui, 'halt:sub-1')
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
    await ui.press({ key: 'detail:close' })
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
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    await steer(ui, 'halt:sub-1')
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
    expect((await ui.find({ key: 'select:sub-1' }))?.props.label).toBe('performance-opti…')
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
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    return ui
  }

  const text = (row: Appended | undefined) => row?.message.content[0]?.text ?? ''

  test('Code Mode: der Stopp endet den Agenten ohne SubagentHandback', de, async ($, on) => {
    engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    await steer(ui, 'halt:sub-1')
    await ui.redraw()
    const denied = await $.tool.call({ tool: 'Bash', command: 'ping -c 20 127.0.0.1', agentId: 'sub-1' } as never)
    expect(JSON.stringify(denied)).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    const chunks: unknown[] = []
    const first = await step($, { agentId: 'sub-1', chunks })
    expect(chunks.map(c => (c as { kind: string }).kind)).toEqual(['text', 'stop'])
    expect([first.stopReason, first.toolUses]).toEqual(['end_turn', []])
    await $.turn.complete({ answer: first.answer, durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    await ui.press({ key: 'detail:close' })
    expect(await screen(ui)).toMatch(/○ gestoppt/)
    await ui.unmount()
  })

  test('Code Mode: eine Korrektur an einen laufenden Agenten geht per send, ohne Werkzeugnamen', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nur lesen')
    await ui.unmount()
    expect(seen.appended.filter(row => row.agentId === 'sub-1').length).toBe(0)
    expect(seen.sent.length).toBe(1)
    expect(JSON.stringify(seen.sent[0]?.to)).toContain('sub-1')
    expect(seen.sent[0]?.text).toContain('Nur lesen')
    expect(seen.sent[0]?.text).toMatch(/in deinem Abschlussbericht/)
    expect(seen.sent[0]?.text).not.toMatch(/SubagentHandback/)
  })

  test('Code Mode: ein Codeblock steht als Schritt auf der Karte, und der Titel trägt das Kennzeichen', de, async ($, on) => {
    engine(on, [], { codeMode: true, stepTools: ['REPL', 'Poll'] })
    await oneAgentWithAdvisor($)
    await step($, { agentId: 'sub-1' })
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toMatch(/CODE MODE/)
    expect(text).toMatch(/führt Code aus/)
    await ui.unmount()
  })

  test('Code Mode: die Korrektur geht per send ans Kind, der laufende Eltern-Agent bekommt nur eine Notiz', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Prüfe.', description: 'Unterauftrag', subagentType: 'general-purpose', parentAgentId: 'sub-1' } as never)
    await step($, { agentId: 'sub-2' })
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-2')
    await ui.redraw()
    await sayCommand($, 'Nur lesen', 'sub-2')
    await ui.unmount()
    expect(seen.appended.some(row => row.agentId === 'sub-2')).toBe(false)
    expect(seen.appended.some(row => row.agentId === 'sub-1' && (row.message.content[0]?.text ?? '').includes('Nur lesen'))).toBe(true)
    expect(seen.sent.map(row => JSON.stringify(row.to))).toEqual(['"sub-2"'])
  })

  test('Code Mode: endet der Agent vor dem Lesen, bleibt die Korrektur geschickt und nichts geht nach', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nur lesen')
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/Korrektur: geschickt/)
    expect(seen.sent.length).toBe(1)
    expect(seen.status.some(line => /nicht zugestellt/.test(line))).toBe(false)
    await ui.unmount()
  })

  test('Code Mode: auch der kompakte Titel trägt das Kennzeichen', de, async ($, on) => {
    engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90, 30))
    expect(await screen(ui)).toMatch(/CODE MODE/)
    await ui.unmount()
  })

  test('Code Mode: eine ungelesene Korrektur gilt nach einem Stopp als nicht zugestellt', de, async ($, on) => {
    engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    const first = await step($, { agentId: 'sub-1' })
    await $.turn.complete({ answer: first.answer, durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: nicht zugestellt/)
    await ui.unmount()
  })

  test('Code Mode: nach dem Stopp bleiben Aufrufe aus weiterlaufendem Code gesperrt', de, async ($, on) => {
    engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    await steer(ui, 'halt:sub-1')
    const first = await step($, { agentId: 'sub-1' })
    await $.turn.complete({ answer: first.answer, durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const late = await $.tool.call({ tool: 'Bash', command: 'echo spaet', agentId: 'sub-1' } as never)
    expect(JSON.stringify(late)).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    await ui.unmount()
  })

  test('ohne Code Mode laufen Aufrufe eines gestoppten Agenten wie bisher an der Sperre vorbei', de, async ($, on) => {
    engine(on, [], { codeMode: false })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    await steer(ui, 'halt:sub-1')
    await step($, { agentId: 'sub-1' })
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    const second = await step($, { agentId: 'sub-1' })
    await $.turn.complete({ answer: second.answer, durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const late = await $.tool.call({ tool: 'Read', file_path: '/x/c.ts', agentId: 'sub-1' } as never)
    expect(JSON.stringify(late)).not.toMatch(/gestoppt/)
    await ui.unmount()
  })

  test('meldet die Werkzeugliste kein Code-Werkzeug, erkennt der erste Codeblock in einem Schritt den Code Mode', de, async ($, on) => {
    engine(on, [], { codeMode: false, stepTools: ['REPL'] })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).not.toMatch(/CODE MODE/)
    await $.turn.start({ text: 'Prüf das Auth-Modul', turnId: 't1' })
    await $.agent.spawn({ prompt: 'Lies den Code.', description: 'Code lesen', subagentType: 'Explore' } as never)
    await step($, { agentId: 'sub-1' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/CODE MODE/)
    expect(text).toMatch(/führt Code aus/)
    await ui.unmount()
  })

  test('ein am Codeblock erkannter Code Mode bleibt, wenn die Werkzeugliste erneut ohne Code-Werkzeug kommt', de, async ($, on) => {
    engine(on, [], { codeMode: false, stepTools: ['REPL'] })
    await oneAgentWithAdvisor($)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/CODE MODE/)
    await ui.unmount()
  })

  test('ein Codeblock der Hauptsitzung erkennt den Code Mode, der Stopp eines Unteragenten kommt dann ohne Werkzeugaufruf', de, async ($, on) => {
    engine(on, [], { codeMode: false, mainStepTools: ['REPL'] })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/CODE MODE/)
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    await steer(ui, 'halt:sub-1')
    const chunks: unknown[] = []
    await step($, { agentId: 'sub-1', chunks })
    expect(chunks.map(c => (c as { kind: string }).kind)).toEqual(['text', 'stop'])
    await ui.unmount()
  })

  test('Code Mode: Aufrufe eines normal beendeten Agenten bleiben erlaubt', de, async ($, on) => {
    engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const later = await $.tool.call({ tool: 'Bash', command: 'echo weiter', agentId: 'sub-1' } as never)
    expect(JSON.stringify(later)).not.toMatch(/gestoppt/)
  })

  test('ohne Code Mode kein Kennzeichen und kein Codeschritt', de, async ($, on) => {
    engine(on, [], { codeMode: false, stepTools: ['Bash'] })
    await oneAgentWithAdvisor($)
    await step($, { agentId: 'sub-1' })
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).not.toMatch(/CODE MODE/)
    expect(text).not.toMatch(/führt Code aus/)
    await ui.unmount()
  })

  test('eine Korrektur an einen laufenden Agenten geht per send, die Hauptsitzung erfährt sie', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nur lesen')
    await ui.unmount()
    expect(seen.sent.length).toBe(1)
    expect(JSON.stringify(seen.sent[0]?.to)).toContain('sub-1')
    expect(seen.sent[0]?.text).toContain('Nur lesen')
    expect(seen.sent[0]?.text).toMatch(/Bericht über SubagentHandback/)
    expect(seen.appended.filter(row => row.agentId).length).toBe(0)
    expect(seen.appended.length).toBe(1)
    expect(text(seen.appended[0])).toContain('Code lesen')
    expect(text(seen.appended[0])).toContain('Nur lesen')
  })

  test('nach dem nächsten Schritt ist die Korrektur gelesen und hält die Rückgabe nicht mehr an', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nur lesen')
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
    await sayCommand($, 'Bitte noch die Tests')
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: geschickt/)
    await ui.unmount()
    expect(seen.sent.length).toBe(1)
    expect(JSON.stringify(seen.sent[0]?.to)).toContain('sub-1')
    expect(seen.sent[0]?.text).toContain('Bitte noch die Tests')
    expect(seen.sent[0]?.text).toMatch(/Bericht über SubagentHandback/)
    expect(seen.appended.filter(row => row.agentId === 'sub-1').length).toBe(0)
  })

  test('eine ungelesene Korrektur hält SubagentHandback einmal an', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nur lesen')
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
    await sayCommand($, 'Nur lesen')
    await steer(ui, 'halt:sub-1')
    await ui.unmount()
    const handback = await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    expect(JSON.stringify(handback)).not.toMatch(/neue Nachricht/)
  })

  test('leerer Text schickt nichts', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, '   ')
    await ui.redraw()
    expect(seen.appended.length + seen.sent.length).toBe(0)
    expect(await screen(ui)).not.toMatch(/Korrektur an/)
    await ui.unmount()
  })

  test('lehnt Claude Code die Zustellung ab, meldet sich die Korrektur in der Statuszeile und im Protokoll', de, async ($, on) => {
    const seen = engine(on, [], { send: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nur lesen')
    await ui.redraw()
    expect(seen.appended.length + seen.sent.length).toBe(0)
    expect(seen.status.at(-1)).toMatch(/Korrektur nicht zugestellt/)
    await ui.press({ key: 'detail:close' })
    expect(await screen(ui)).toMatch(/Korrektur an Explore nicht zugestellt/)
    await ui.unmount()
  })

  test('ein langer Text geht ganz an den Agenten', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'x'.repeat(5000))
    await ui.unmount()
    expect(seen.sent[0]?.text).toContain('x'.repeat(5000))
  })
})

describe('Textfeld, Status und Stopp am Kasten', () => {
  async function openDetail($: Engine, columns = 90) {
    const ui = await $.ui.mount(pane(columns))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    return ui
  }

  test('in der Zeilenansicht bleibt das Zeichen der Korrektur trotz langer Beschreibung sichtbar', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const wide = await openDetail($)
    await sayCommand($, 'Nur lesen')
    await wide.unmount()
    const ui = await $.ui.mount(pane(38))
    const label = String((await ui.find({ key: 'select:sub-1' }))?.props.label ?? '')
    expect(label).toMatch(/^(▸ )?◐ läuft ✉ · /)
    await ui.unmount()
  })

  const finished = { answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' } as const

  test('nach einem angeforderten Stopp geht nichts weiter an den Agenten', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await ui.unmount()
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(1)
  })

  test('eine eingereihte Korrektur hält den Abschluss einmal an, nach dem Lesen geht er durch', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await ui.unmount()
    const held = await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    expect(JSON.stringify(held)).toMatch(/Bevor du abschließt/)
    await step($, { agentId: 'sub-1' })
    const handback = await $.tool.call({ tool: 'SubagentHandback', message: 'OK, b.ts genommen', agentId: 'sub-1' } as never)
    expect(JSON.stringify(handback)).not.toMatch(/deny/)
  })

  test('endet ein Agent vor dem Lesen, bleibt die Korrektur geschickt und nichts geht nach; geweckt liest er sie', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await $.turn.complete(finished)
    await $.turn.complete(finished)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: geschickt/)
    expect(seen.sent.length).toBe(1)
    expect(seen.appended.some(row => (row.message.content[0]?.text ?? '').includes('nicht mehr angekommen'))).toBe(false)
    await step($, { agentId: 'sub-1' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: gelesen/)
    await ui.unmount()
  })

  test('ein Schritt während des Sendens der zweiten Korrektur zählt sie nicht als gelesen, beim Ende bleibt sie geschickt', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Erstens A')
    refuse.onSend = () => step($, { agentId: 'sub-1' })
    await sayCommand($, 'Zweitens B')
    refuse.onSend = undefined
    await $.turn.complete(finished)
    await ui.redraw()
    expect(seen.sent.length).toBe(2)
    const text = await screen(ui)
    expect(text).toMatch(/Korrektur: geschickt[^"]*Zweitens B/)
    expect(text).not.toMatch(/nicht zugestellt/)
    await ui.unmount()
  })

  test('scheitert dieselbe Korrektur beim zweiten Mal, bleibt die erste beim Ende geschickt', de, async ($, on) => {
    const refuse = { send: false }
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    refuse.send = true
    await sayCommand($, 'Nimm b.ts')
    refuse.send = false
    await $.turn.complete(finished)
    await ui.redraw()
    expect(seen.sent.length).toBe(1)
    expect(await screen(ui)).toMatch(/Korrektur: geschickt/)
    expect(seen.appended.some(row => (row.message.content[0]?.text ?? '').includes('nicht mehr angekommen'))).toBe(false)
    await ui.unmount()
  })

  test('mehrere Korrekturen gehen einzeln per send, beim Ende geht nichts nach', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Erstens A')
    await sayCommand($, 'Zweitens B')
    await ui.unmount()
    expect([seen.sent[0]?.text, seen.sent[1]?.text].join('|')).toMatch(/Erstens A[\s\S]*\|[\s\S]*Zweitens B/)
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(2)
  })

  test('nach /agent-tree clear gilt eine ungelesene Korrektur an einen laufenden Agenten beim Ende nicht als verloren', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await ui.unmount()
    await $.command.run({ command: 'agent-tree', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(1)
    expect(seen.status.some(line => /nicht zugestellt/.test(line))).toBe(false)
    expect(seen.appended.some(row => (row.message.content[0]?.text ?? '').includes('nicht mehr angekommen'))).toBe(false)
  })

  test('Code Mode: Korrektur, Stoppwunsch, der Agent endet selbst: geweckt wird er sofort gestoppt', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(finished)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: nicht zugestellt/)
    const before = seen.stepModels.length
    const chunks: unknown[] = []
    await $.turn.start({ text: 'Nimm b.ts', turnId: 't2', agentId: 'sub-1' } as never)
    const woken = await step($, { agentId: 'sub-1', chunks })
    expect(chunks.map(c => (c as { kind: string }).kind)).toEqual(['text', 'stop'])
    expect(woken.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    expect(seen.stepModels.length - before).toBe(0)
    await $.turn.complete({ ...finished, answer: woken.answer })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/○ gestoppt/)
    await ui.unmount()
  })

  test('Korrektur, Stoppwunsch, der Agent berichtet selbst: der Schritt mit der wartenden Nachricht wird gestoppt', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    const before = seen.stepModels.length
    const woken = await step($, { agentId: 'sub-1' })
    expect(woken.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    expect(seen.stepModels.length - before).toBe(0)
    await ui.unmount()
  })

  test('Stoppwunsch überholt: nach eigener Abgabe und Ende wird ein Weckruf binnen 60 s gestoppt', de, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    await $.turn.complete(finished)
    await clock.advance(59_000)
    const before = seen.stepModels.length
    const woken = await step($, { agentId: 'sub-1' })
    expect(woken.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    expect(seen.stepModels.length - before).toBe(0)
    await ui.unmount()
  })

  test('Stopp beim Wecken ohne turn.start: die Karte zeigt gestoppt, eine neue Nachricht des Nutzers läuft', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(finished)
    const woken = await step($, { agentId: 'sub-1' })
    expect(woken.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    await $.turn.complete({ ...finished, answer: woken.answer })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/○ gestoppt/)
    expect(JSON.stringify(seen.tree()?.log.at(-1))).toMatch(/"status":"stopped"/)
    const before = seen.stepModels.length
    await sayCommand($, 'Jetzt c.ts')
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('Stopp beim Wecken, das Ende des Weckrufs kommt nie an: eine neue Nachricht des Nutzers läuft trotzdem', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(finished)
    await step($, { agentId: 'sub-1' })
    const before = seen.stepModels.length
    await sayCommand($, 'Jetzt c.ts')
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('nach einem Stopp beim Wecken läuft ein späterer Weckruf ohne Zutun des Nutzers normal', de, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(finished)
    const woken = await step($, { agentId: 'sub-1' })
    await $.turn.complete({ ...finished, answer: woken.answer })
    await clock.advance(120_000)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/läuft/)
    const call = await $.tool.call({ tool: 'Bash', command: 'echo weiter', agentId: 'sub-1' } as never)
    expect(JSON.stringify(call)).not.toMatch(/gestoppt/)
    await ui.unmount()
  })

  test('ein geweckter Agent ohne Startsignal steht beim ersten Schritt wieder als laufend da und lässt sich stoppen', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await $.turn.complete(finished)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/● fertig/)
    await step($, { agentId: 'sub-1' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/läuft/)
    await steer(ui, 'halt:sub-1')
    const before = seen.stepModels.length
    const stopped = await step($, { agentId: 'sub-1' })
    expect(stopped.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    expect(seen.stepModels.length - before).toBe(0)
    await ui.unmount()
  })

  test('die eigene Abgabe im Stopp zählt als Werkzeugaufruf', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'Mein Bericht', agentId: 'sub-1' } as never)
    expect(seen.tree()?.agents[0]?.toolCount).toBe(2)
    await ui.unmount()
  })

  test('Abgabe im Stopp, Ende mit Fehler, Fortsetzung und normales Ende: der nächste Weckruf läuft', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'Mein Bericht', agentId: 'sub-1' } as never)
    await $.turn.complete({ ...finished, answer: '', reason: 'error' })
    await $.turn.start({ text: 'weiter', turnId: 't2', agentId: 'sub-1' } as never)
    await step($, { agentId: 'sub-1' })
    await $.turn.complete(finished)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('scheitert das Senden nach einem überholten Stopp, bleibt der Halt für den wartenden Weckruf bestehen', de, async ($, on) => {
    const refuse = { send: false }
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(finished)
    refuse.send = true
    await sayCommand($, 'Jetzt c.ts')
    refuse.send = false
    const before = seen.stepModels.length
    const woken = await step($, { agentId: 'sub-1' })
    expect(woken.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    expect(seen.stepModels.length - before).toBe(0)
    await ui.unmount()
  })

  test('Stoppwunsch überholt: nach 60 s läuft ein geweckter Agent normal', de, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(finished)
    await clock.advance(61_000)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(2)
    await ui.unmount()
  })

  test('Stoppwunsch überholt: schreibt der Nutzer dem Agenten danach selbst, läuft er', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(finished)
    await sayCommand($, 'Mach doch weiter')
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('Stoppwunsch überholt: endet der Agent mit Fehler, wird ein späterer Weckruf nicht gestoppt', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete({ ...finished, answer: '', reason: 'error' })
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('Stoppwunsch überholt: nach /agent-tree clear klebt der Stopp nicht an einem Agenten, der nicht mehr im Baum steht', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(finished)
    await ui.unmount()
    await $.command.run({ command: 'agent-tree', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
    const woken = await step($, { agentId: 'sub-1' })
    expect(woken.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    await $.turn.complete({ ...finished, answer: woken.answer })
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    const later = await $.tool.call({ tool: 'Read', file_path: '/x/c.ts', agentId: 'sub-1' } as never)
    expect(JSON.stringify(later)).not.toMatch(/gestoppt/)
  })

  test('scheitert der Agent, während die Korrektur gesendet wird, gilt sie als nicht zugestellt', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    refuse.onSend = () => $.turn.complete({ ...finished, answer: '', reason: 'error' })
    await sayCommand($, 'Nimm b.ts')
    refuse.onSend = undefined
    await ui.redraw()
    expect(seen.sent.length).toBe(1)
    const text = await screen(ui)
    expect(text).toMatch(/Korrektur: nicht zugestellt/)
    expect(text).not.toMatch(/Korrektur: geschickt/)
    await ui.unmount()
  })

  test('einem Agenten im Stopp wird nichts mehr geschickt, die Nachricht gilt sofort als nicht zugestellt', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await steer(ui, 'halt:sub-1')
    const said = await sayCommand($, 'Nimm b.ts')
    await ui.redraw()
    expect(seen.sent.length).toBe(0)
    expect(seen.appended.length).toBe(0)
    expect(said.text).toMatch(/nicht zugestellt/)
    expect(await screen(ui)).toMatch(/Korrektur: nicht zugestellt/)
    expect(seen.status.some(line => /Korrektur nicht zugestellt/.test(line))).toBe(true)
    await ui.unmount()
  })

  test('lehnt ein anderer Hook die eigene Abgabe ab, bleibt der Stopp bestehen', de, async ($, on) => {
    const seen = engine(on, [], { denyHandback: true })
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await steer(ui, 'halt:sub-1')
    const own = await $.tool.call({ tool: 'SubagentHandback', message: 'Mein Bericht', agentId: 'sub-1' } as never)
    expect(JSON.stringify(own)).toMatch(/Regel/)
    const before = seen.stepModels.length
    const next = await step($, { agentId: 'sub-1' })
    expect(next.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    expect(seen.stepModels.length - before).toBe(0)
    await ui.unmount()
  })

  test('an einen fehlgeschlagenen Agenten geht nichts nach, die Korrektur gilt als nicht zugestellt', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await $.turn.complete({ ...finished, answer: '', reason: 'error' })
    await ui.redraw()
    expect(seen.sent.length).toBe(1)
    expect(await screen(ui)).toMatch(/Korrektur: nicht zugestellt/)
    await ui.unmount()
  })

  test('gilt die Korrektur an ein Kind als nicht zugestellt, erfährt das auch der laufende Eltern-Agent', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Prüfe.', description: 'Unterauftrag', subagentType: 'general-purpose', parentAgentId: 'sub-1' } as never)
    await step($, { agentId: 'sub-2' })
    await sayCommand($, 'Nur lesen', 'sub-2')
    await $.turn.complete({ ...finished, agentId: 'sub-2', answer: '', reason: 'error' })
    expect(seen.appended.some(row => row.agentId === 'sub-1' && (row.message.content[0]?.text ?? '').includes('nicht mehr angekommen'))).toBe(true)
    expect(seen.appended.some(row => !row.agentId && (row.message.content[0]?.text ?? '').includes('nicht mehr angekommen'))).toBe(true)
  })

  test('ein beendeter Eltern-Agent bekommt keine Verlustnotiz', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Prüfe.', description: 'Unterauftrag', subagentType: 'general-purpose', parentAgentId: 'sub-1' } as never)
    await step($, { agentId: 'sub-2' })
    await sayCommand($, 'Nur lesen', 'sub-2')
    await $.turn.complete(finished)
    const before = seen.appended.length
    await $.turn.complete({ ...finished, agentId: 'sub-2', answer: '', reason: 'error' })
    expect(seen.appended.slice(before).some(row => row.agentId === 'sub-1')).toBe(false)
    expect(seen.appended.slice(before).some(row => !row.agentId && (row.message.content[0]?.text ?? '').includes('nicht mehr angekommen'))).toBe(true)
    expect(seen.status.some(line => /Korrektur nicht zugestellt/.test(line))).toBe(true)
  })

  test('endet der Eltern-Agent, während die Korrektur an sein Kind läuft, bekommt er keine Notiz', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Prüfe.', description: 'Unterauftrag', subagentType: 'general-purpose', parentAgentId: 'sub-1' } as never)
    await step($, { agentId: 'sub-2' })
    refuse.onSend = () => $.turn.complete(finished)
    await sayCommand($, 'Nur lesen', 'sub-2')
    expect(seen.sent.some(row => JSON.stringify(row.to).includes('sub-1'))).toBe(false)
    expect(seen.appended.some(row => row.agentId === 'sub-1')).toBe(false)
  })

  test('nach einem Stopp bleibt keine ungelesene Korrektur als geschickt stehen', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    await $.turn.complete(finished)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: nicht zugestellt/)
    expect(seen.sent.length).toBe(1)
    await ui.unmount()
  })

  test('in der Zeilenansicht steht beim Stoppen „hält an“', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(38))
    await steer(ui, 'halt:sub-1')
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(String((await ui.find({ key: 'select:sub-1' }))?.props.label ?? '')).toMatch(/hält an/)
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
    await sayCommand($, 'Nimm b.ts')
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    await $.turn.complete(finished)
    expect(seen.sent.length).toBe(1)
  })

  test('scheitert eine zweite Korrektur, bleibt die erste offen', de, async ($, on) => {
    const refuse = { send: false }
    engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Erste Korrektur')
    refuse.send = true
    await sayCommand($, 'Zweite Korrektur')
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: geschickt[^"]*Erste Korrektur/)
    await ui.press({ key: 'detail:close' })
    expect(await screen(ui)).toMatch(/nicht zugestellt: Zweite Korrektur/)
    await ui.unmount()
  })

  test('ein per send neu gestarteter Agent liest die Korrektur schon im ersten Schritt', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    await $.turn.complete(finished)
    refuse.onSend = () => step($, { agentId: 'sub-1' })
    const ui = await openDetail($)
    await sayCommand($, 'Nimm b.ts')
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
    await steer(ui, 'detail:sub-2')
    await ui.redraw()
    await sayCommand($, 'Nur lesen', 'sub-2')
    await ui.unmount()
    expect(seen.appended.some(row => row.agentId === 'sub-1' && (row.message.content[0]?.text ?? '').includes('Nur lesen'))).toBe(true)
    expect(seen.sent.some(row => JSON.stringify(row.to).includes('sub-1'))).toBe(false)
  })

  test('der Kasten zeigt geschickt und gelesen, der Detailkasten nennt den Stand', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openDetail($)
    await sayCommand($, 'Nur lesen')
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
    await ui.press({ key: 'select:sub-1' })
    expect(await ui.find({ key: 'halt:sub-1' })).toBeDefined()
    await steer(ui, 'halt:sub-1')
    await ui.redraw()
    expect(await ui.find({ key: 'halt:sub-1' })).toBeUndefined()
    expect(await screen(ui)).toMatch(/hält an …/)
    const denied = await $.tool.call({ tool: 'Read', file_path: '/x/b.ts', agentId: 'sub-1' } as never)
    expect(JSON.stringify(denied)).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    await ui.unmount()
  })

})

describe('Sichtbarkeit beim Korrigieren', () => {
  test('der Agent mit offenem Detailkasten bleibt als Kasten sichtbar', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'B.', description: 'Tests prüfen', subagentType: 'general-purpose' } as never)
    await $.agent.spawn({ prompt: 'C.', description: 'Doku holen', subagentType: 'general-purpose' } as never)
    for (const name of ['D', 'E', 'F']) await $.agent.spawn({ prompt: `${name}.`, description: `Teil ${name}`, subagentType: 'general-purpose' } as never)
    for (const id of ['sub-2', 'sub-3', 'sub-4', 'sub-5', 'sub-6']) await step($, { agentId: id })
    const tall = await $.ui.mount(pane(73, 90))
    await steer(tall, 'detail:sub-6')
    await tall.unmount()
    const ui = await $.ui.mount(pane(73, 46))
    expect(await screen(ui)).toMatch(/weitere/)
    expect(await ui.find({ key: 'ag:sub-6' })).toBeDefined()
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

  test('das Modell des Beraters lässt sich über ein Drop-down wählen', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'advisor:menu' })
    await ui.redraw()
    for (const name of ['sonnet', 'opus', 'fable']) expect(await ui.find({ key: `advisorpick:${name}` })).toBeDefined()
    expect(await ui.find({ key: 'advisorpick:haiku' })).toBeUndefined()
    await ui.press({ key: 'advisorpick:sonnet' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'advisor', args: 'sonnet' })
    expect(await ui.find({ key: 'advisorpick:sonnet' })).toBeUndefined()
    expect((await ui.find({ key: 'advisor:menu' }))?.props.label).toBe('Sonnet ▾')
    await ui.press({ key: 'advisor:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'advisor', args: 'off' })
    await ui.press({ key: 'advisor:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'advisor', args: 'sonnet' })
    await ui.unmount()
  })

  test('auch in der schmalen Leiste gibt es die Modellwahl des Beraters', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(62))
    await ui.press({ key: 'advisor:menu' })
    await ui.redraw()
    await ui.press({ key: 'advisorpick:fable' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'advisor', args: 'fable' })
    await ui.unmount()
  })

  test('nur Modelle aus Claude Codes Menü stehen zur Wahl', de, async ($, on) => {
    engine(on, [], { model: 'default', modelOptions: ['default', 'sonnet', 'opus'] })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'advisor:menu' })
    await ui.redraw()
    expect(await ui.find({ key: 'advisorpick:fable' })).toBeUndefined()
    expect(await ui.find({ key: 'advisorpick:opus' })).toBeDefined()
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

describe('Fast Mode per Knopf', () => {
  test('der Knopf zeigt den Stand aus Claude Codes Einstellungsmenü und liegt auf der Taste f', de, async ($, on) => {
    engine(on, [], { fast: false })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const button = await ui.find({ key: 'fast:toggle' })
    expect(button?.props.label).toBe('↯ Fast Mode: aus')
    expect(button?.props.hotkey).toBe('f')
    await ui.unmount()
  })

  test('ist der Fast Mode beim Start an, steht der Knopf auf an', de, async ($, on) => {
    engine(on, [], { fast: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: an')
    await ui.unmount()
  })

  test('ohne Fast-Mode-Zeile in Claude Code zeigt die Leiste keinen Knopf', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ key: 'fast:toggle' })).toBeUndefined()
    await ui.unmount()
  })

  test('der Knopf schaltet den Fast Mode über /fast ein und wieder aus', de, async ($, on) => {
    const seen = engine(on, [], { fast: false })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'fast:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'fast', args: 'on' })
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: an')
    await ui.press({ key: 'fast:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'fast', args: 'off' })
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: aus')
    expect(seen.toasts.join(' ')).not.toMatch(/Fast Mode/)
    await ui.unmount()
  })

  test('stellt Claude Code nicht um, bleibt der Knopf beim alten Stand und eine Meldung erscheint', de, async ($, on) => {
    const seen = engine(on, [], { fast: false, fastFails: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'fast:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.commands.at(-1)).toEqual({ command: 'fast', args: 'on' })
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: aus')
    expect(seen.toasts.join(' ')).toMatch(/Claude Code hat den Fast Mode nicht umgestellt/)
    await ui.unmount()
  })

  test('lehnt Claude Code den Befehl /fast ab, erscheint eine Meldung', de, async ($, on) => {
    const seen = engine(on, [], { fast: false, command: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'fast:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.toasts.join(' ')).toMatch(/\/fast ist in dieser Sitzung nicht verfügbar/)
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: aus')
    await ui.unmount()
  })

  test('ein Umschalten von Hand kommt beim nächsten Zug in der Leiste an', de, async ($, on) => {
    const seen = engine(on, [], { fast: false })
    await oneAgentWithAdvisor($)
    for (const row of seen.rows) row.value = true
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: an')
    await ui.unmount()
  })

  test('ein getipptes /fast lässt das Mod unberührt, der Knopf folgt mit dem nächsten Zug', de, async ($, on) => {
    engine(on, [], { fast: false })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await $.command.run({ command: 'fast', args: 'on', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: aus')
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: an')
    await ui.unmount()
  })

  test('verschwindet die Zeile aus dem Einstellungsmenü, verschwindet der Knopf', de, async ($, on) => {
    const seen = engine(on, [], { fast: true })
    await oneAgentWithAdvisor($)
    seen.rows.length = 0
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ key: 'fast:toggle' })).toBeUndefined()
    await ui.unmount()
  })

  test('auf Englisch heißt der Stand on und off', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    engine(on, [], { fast: false })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast mode: off')
    await ui.press({ key: 'fast:toggle' })
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast mode: on')
    await ui.unmount()
  })

  test('die Hilfe führt die Taste f, sobald es den Knopf gibt', de, async ($, on) => {
    engine(on, [], { fast: false })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    expect(await screen(ui)).toContain('f: Fast Mode')
    await ui.unmount()
  })

  test('die Hilfe nennt die eigene Version, das Neue und das Kennzeichen des Code Mode', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain(`Zuletzt neu, Stand ${VERSION}`)
    expect(text).toContain('lokales Modell für einfache Aufgaben')
    expect(text).toContain('„CODE MODE“ im Titel: die Sitzung läuft im Code Mode.')
    await ui.unmount()
  })

  test('die Stern-Bitte kommt in den ersten zwei Sitzungen ohne Kreuz, dann in jeder vierten mit Kreuz, bis man sie wegklickt', de, async ($, on) => {
    engine(on)
    const help = async () => {
      await startSession($)
      const ui = await $.ui.mount(pane(90, 400))
      await ui.press({ key: 'tab:help' })
      await ui.redraw()
      return { ui, text: await screen(ui), off: await ui.find({ key: 'star:off' }) }
    }
    for (let i = 1; i <= 2; i++) {
      const { ui, text, off } = await help()
      expect(text).toContain('Stern auf GitHub')
      expect(off).toBeUndefined()
      await ui.unmount()
    }
    {
      const { ui, text } = await help()
      expect(text).not.toContain('Stern auf GitHub')
      await ui.unmount()
    }
    const fourth = await help()
    expect(fourth.text).toContain('Stern auf GitHub')
    expect(fourth.off).toBeDefined()
    await fourth.ui.press({ key: 'star:off' })
    await fourth.ui.redraw()
    expect(await screen(fourth.ui)).not.toContain('Stern auf GitHub')
    await fourth.ui.unmount()
    for (let i = 1; i <= 7; i++) await startSession($)
    const later = await help()
    expect(later.text).not.toContain('Stern auf GitHub')
    await later.ui.unmount()
  })

  test('passt der Inhalt nicht ins Fenster, steht rechts ein Scrollbalken', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(50, 10))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    const bar = await ui.find({ key: 'scrollbar' })
    expect(bar?.props.height).toBe(10)
    expect(bar?.props.left).toBe(49)
    expect(await screen(ui)).toContain('┃')
    await ui.unmount()
  })

  test('passt alles ins Fenster, gibt es keinen Scrollbalken', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90, 400))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    expect(await ui.find({ key: 'scrollbar' })).toBeUndefined()
    await ui.unmount()
  })

  test('ohne den Knopf führt die Hilfe die Taste f nicht', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    expect(await screen(ui)).not.toContain('f: Fast Mode')
    await ui.unmount()
  })

  test('nach /clear bleibt der Knopf mit seinem Stand stehen', de, async ($, on) => {
    engine(on, [], { fast: true })
    await oneAgentWithAdvisor($)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'fast:toggle' }))?.props.label).toBe('↯ Fast Mode: an')
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

  test('Teile lassen sich aus- und wieder einblenden, die Wahl wird gespeichert', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await openLook($)
    for (const part of ['advisor', 'local', 'log', 'limits']) expect((await ui.find({ key: `lookpart:${part}` }))?.props.variant).toBe('primary')
    expect(await ui.find({ key: 'advisor:toggle' })).toBeDefined()
    await ui.press({ key: 'lookpart:advisor' })
    await ui.press({ key: 'lookpart:log' })
    await ui.redraw()
    expect(await ui.find({ key: 'advisor:toggle' })).toBeUndefined()
    expect(await screen(ui)).not.toMatch(/Sitzungsprotokoll/)
    expect((await ui.find({ key: 'lookpart:advisor' }))?.props.variant).toBeUndefined()
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: { ...DEFAULT_LOOK, hidden: ['advisor', 'log'] } })
    await ui.press({ key: 'lookpart:advisor' })
    await ui.redraw()
    expect(await ui.find({ key: 'advisor:toggle' })).toBeDefined()
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: { ...DEFAULT_LOOK, hidden: ['log'] } })
    await ui.unmount()
  })

  test('ausgeblendete Teile bleiben beim nächsten Start aus', de, async ($, on) => {
    engine(on, [], {}, { look: { ...DEFAULT_LOOK, hidden: ['advisor', 'log'] } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ key: 'advisor:toggle' })).toBeUndefined()
    expect(await screen(ui)).not.toMatch(/Sitzungsprotokoll/)
    await ui.unmount()
  })

  test('im hellen Farbthema hat die Leiste ein eigenes Aussehen, das dunkle bleibt', de, async ($, on) => {
    const seen = engine(on, [], { theme: 'light' }, { look: { ...DEFAULT_LOOK, colors: 'retro' } })
    await oneAgentWithAdvisor($)
    const ui = await openLook($)
    expect(await screen(ui)).toContain('helle Farbthema')
    expect(await screen(ui)).toContain(PALETTES.retro.agent)
    await ui.press({ key: 'look:colors:light' })
    await ui.redraw()
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look:light', value: { ...DEFAULT_LOOK, colors: 'light' } })
    expect(seen.stored.look).toEqual({ ...DEFAULT_LOOK, colors: 'retro' })
    await ui.unmount()
  })

  test('im dunklen Farbthema gilt das dunkle Aussehen, nicht das helle', de, async ($, on) => {
    engine(on, [], { theme: 'dark' }, { look: { ...DEFAULT_LOOK, colors: 'retro' }, 'look:light': { ...DEFAULT_LOOK, colors: 'light' } })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toContain(PALETTES.retro.agent)
    await ui.unmount()
  })

  test('steht das Farbthema auf auto, gilt ein gemeinsames Aussehen ohne Hinweis', de, async ($, on) => {
    const seen = engine(on, [], { theme: 'auto' })
    await oneAgentWithAdvisor($)
    const ui = await openLook($)
    expect(await screen(ui)).not.toContain('Farbthema')
    await ui.press({ key: 'look:colors:mono' })
    expect(seen.storeSets.at(-1)).toEqual({ key: 'look', value: { ...DEFAULT_LOOK, colors: 'mono' } })
    await ui.unmount()
  })

  test('× schließt auch die Modellwahl des Beraters', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'advisor:menu' })
    await ui.redraw()
    expect(await ui.find({ key: 'advisorpick:opus' })).toBeDefined()
    await ui.press({ key: 'look:open' })
    await ui.press({ key: 'look:close' })
    await ui.redraw()
    expect(await ui.find({ key: 'advisorpick:opus' })).toBeUndefined()
    await ui.unmount()
  })

  test('lässt sich eine Einstellung nicht speichern, sagt die Leiste das einmal', de, async ($, on) => {
    const seen = engine(on, [], { storeSet: true })
    await oneAgentWithAdvisor($)
    const ui = await openLook($)
    await ui.press({ key: 'look:style:hud' })
    await ui.press({ key: 'look:colors:mono' })
    await ui.redraw()
    expect(seen.toasts.filter(t => t.includes('nicht speichern'))).toHaveLength(1)
    expect(await screen(ui)).toContain(PALETTES.mono.agent)
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

  test('ohne Bewegung kein Lichtstreifen', { options: { language: 'de', animate: false, tips: false } }, async ($, on) => {
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

describe('Modell der Hauptsitzung', () => {
  const settle = async (ui: { redraw: () => Promise<unknown> }) => {
    for (let i = 0; i < 3; i++) await ui.redraw()
  }

  test('die Überschrift des Hauptkastens öffnet die Auswahl mit Modellzeile und Denkstufen', de, async ($, on) => {
    engine(on, [], { model: 'default' })
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    const ui = await $.ui.mount(pane(90))
    const title = await ui.find({ key: 'model:main' })
    expect(title?.props.label).toBe('Opus 5.5 · Hauptsitzung ▾')
    expect(title?.props.hotkey).toBeUndefined()
    await ui.press({ key: 'model:main' })
    await settle(ui)
    expect(await screen(ui)).toMatch(/Modell der Hauptsitzung:/)
    for (const key of ['choose:main:default', 'choose:main:haiku', 'choose:main:sonnet', 'choose:main:opus', 'choose:main:fable', 'effort:main:default', 'effort:main:max', 'picker:close']) {
      expect(await ui.find({ key })).toBeDefined()
    }
    expect((await ui.find({ key: 'choose:main:default' }))?.props.variant).toBe('primary')
    expect((await ui.find({ key: 'choose:main:opus' }))?.props.variant).toBeUndefined()
    expect(await screen(ui)).toMatch(/wie \/model/)
    await ui.unmount()
  })

  test('ohne Modellzeile in Claude Codes Einstellungsmenü bleibt die Überschrift Text', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ key: 'model:main' })).toBeUndefined()
    expect(await screen(ui)).toMatch(/Opus 5\.5 · Hauptsitzung/)
    expect(await screen(ui)).not.toMatch(/Hauptsitzung ▾/)
    await ui.unmount()
  })

  test('eine gesperrte Modellzeile ergibt keine Auswahl', de, async ($, on) => {
    engine(on, [], { model: 'default', modelLocked: true })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ key: 'model:main' })).toBeUndefined()
    await steer(ui, 'pick:main')
    expect(await ui.find({ key: 'choose:main:sonnet' })).toBeUndefined()
    await ui.unmount()
  })

  test('die Wahl geht als /model an Claude Code, die Überschrift folgt und die Auswahl schließt', de, async ($, on) => {
    const seen = engine(on, [], { model: 'default' })
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'choose:main:sonnet' })
    await settle(ui)
    expect(seen.commands.at(-1)).toEqual({ command: 'model', args: 'sonnet' })
    expect((await ui.find({ key: 'model:main' }))?.props.label).toBe('Sonnet 5.5 · Hauptsitzung ▾')
    expect(await ui.find({ key: 'choose:main:sonnet' })).toBeUndefined()
    expect(seen.toasts.join(' ')).not.toMatch(/Modell/)
    await steer(ui, 'pick:main')
    expect((await ui.find({ key: 'choose:main:sonnet' }))?.props.variant).toBe('primary')
    expect((await ui.find({ key: 'choose:main:default' }))?.props.variant).toBeUndefined()
    await ui.unmount()
  })

  test('Standard schickt /model default', de, async ($, on) => {
    const seen = engine(on, [], { model: 'haiku' })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'model:main' }))?.props.label).toBe('Haiku 5.5 · Hauptsitzung ▾')
    await steer(ui, 'pick:main')
    expect((await ui.find({ key: 'choose:main:haiku' }))?.props.variant).toBe('primary')
    await ui.press({ key: 'choose:main:default' })
    await settle(ui)
    expect(seen.commands.at(-1)).toEqual({ command: 'model', args: 'default' })
    expect((await ui.find({ key: 'model:main' }))?.props.label).toBe('Opus 5.5 · Hauptsitzung ▾')
    expect(seen.toasts.join(' ')).not.toMatch(/Modell/)
    await ui.unmount()
  })

  test('die Auswahl bietet nur Modelle an, die Claude Codes Menü führt', de, async ($, on) => {
    engine(on, [], { model: 'default', modelOptions: ['default', 'sonnet', 'opus', 'opus[1m]'] })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    expect(await ui.find({ key: 'choose:main:sonnet' })).toBeDefined()
    expect(await ui.find({ key: 'choose:main:opus' })).toBeDefined()
    expect(await ui.find({ key: 'choose:main:haiku' })).toBeUndefined()
    expect(await ui.find({ key: 'choose:main:fable' })).toBeUndefined()
    expect((await ui.find({ key: 'choose:main:opus[1m]' }))?.props.label).toBe('Opus 1M')
    await ui.unmount()
  })

  test('die 1M-Fassung lässt sich wählen und wird über /model gesetzt', de, async ($, on) => {
    const seen = engine(on, [], { model: 'default' })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'choose:main:opus[1m]' })
    await settle(ui)
    expect(seen.commands.at(-1)).toEqual({ command: 'model', args: 'opus[1m]' })
    await steer(ui, 'pick:main')
    expect((await ui.find({ key: 'choose:main:opus[1m]' }))?.props.variant).toBe('primary')
    expect((await ui.find({ key: 'choose:main:opus' }))?.props.variant).toBeUndefined()
    await ui.unmount()
  })

  test('eine Fassung mit großem Kontextfenster ist selbst hervorgehoben', de, async ($, on) => {
    engine(on, [], { model: 'fable[1m]' })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    expect((await ui.find({ key: 'choose:main:fable[1m]' }))?.props.variant).toBe('primary')
    expect((await ui.find({ key: 'choose:main:fable' }))?.props.variant).toBeUndefined()
    expect((await ui.find({ key: 'choose:main:default' }))?.props.variant).toBeUndefined()
    await ui.unmount()
  })

  test('stellt Claude Code das Modell nicht um, bleiben Überschrift und Hervorhebung beim alten Stand', de, async ($, on) => {
    const seen = engine(on, [], { model: 'default', modelFails: true })
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'choose:main:sonnet' })
    await settle(ui)
    expect(seen.commands.at(-1)).toEqual({ command: 'model', args: 'sonnet' })
    expect((await ui.find({ key: 'model:main' }))?.props.label).toBe('Opus 5.5 · Hauptsitzung ▾')
    await steer(ui, 'pick:main')
    expect((await ui.find({ key: 'choose:main:default' }))?.props.variant).toBe('primary')
    expect((await ui.find({ key: 'choose:main:sonnet' }))?.props.variant).toBeUndefined()
    await ui.unmount()
  })

  test('lehnt Claude Code den Befehl /model ab, erscheint eine Meldung', de, async ($, on) => {
    const seen = engine(on, [], { model: 'default', command: true })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'choose:main:sonnet' })
    await settle(ui)
    expect(seen.toasts.join(' ')).toMatch(/\/model ist in dieser Sitzung nicht verfügbar/)
    await ui.unmount()
  })

  test('ein Wechsel von Hand kommt beim nächsten Zug in der Auswahl an', de, async ($, on) => {
    const seen = engine(on, [], { model: 'default' })
    await startSession($)
    for (const row of seen.rows) if (row.key === 'model') row.value = 'opus'
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    expect((await ui.find({ key: 'choose:main:opus' }))?.props.variant).toBe('primary')
    await ui.unmount()
  })

  test('die Wahl für einen Unteragenten schickt kein /model', de, async ($, on) => {
    const seen = engine(on, [], { model: 'default' })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:new')
    await ui.press({ key: 'choose:new:sonnet' })
    await settle(ui)
    expect(seen.commands.filter(c => c.command === 'model')).toEqual([])
    await ui.unmount()
  })

  test('englisch heißt die Zeile Main session model', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    engine(on, [], { model: 'default' })
    await startSession($)
    await $.turn.start({ text: 'Go', turnId: 't1' })
    await step($)
    const ui = await $.ui.mount(pane(90))
    expect((await ui.find({ key: 'model:main' }))?.props.label).toBe('Opus 5.5 · Main session ▾')
    await steer(ui, 'pick:main')
    expect(await screen(ui)).toMatch(/Main session model:/)
    expect(await screen(ui)).toMatch(/like \/model/)
    await ui.unmount()
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
    await steer(ui, 'pick:main')
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
    await steer(ui, 'pick:main')
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
    await steer(ui, 'pick:main')
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
    await steer(ui, 'pick:main')
    await ui.press({ key: 'effort:main:max' })
    await steer(ui, 'pick:main')
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
    await steer(ui, 'pick:main')
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

  test('auf Englisch', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
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
    await steer(ui, 'pick:new')
    await ui.press({ key: 'choose:new:sonnet' })
    await steer(ui, 'pick:main')
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
    expect(text).toMatch(/Code lesen/)
    expect((await after.find({ key: 'pick:new' }))?.props.label).toMatch(/Sonnet/)
    await after.unmount()
  })
})

describe('Schreiben an Unteragenten', () => {
  const run = ($: Engine, args: string) =>
    $.command.run({ command: 'agent-tree', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as never)

  test('✎ am Kasten legt den Befehl in die Eingabe, ein Entwurf bleibt dahinter', de, async ($, on) => {
    const seen = engine(on)
    on('prompt.read', () => ({ value: { text: 'Bitte kürzer', cursor: 12 } }) as never)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    expect(await ui.find({ key: 'write:sub-1' })).toBeDefined()
    await steer(ui, 'write:sub-1')
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.fills.at(-1)).toBe('/agent-tree an sub-1 Bitte kürzer')
    expect(seen.toasts.join(' ')).toMatch(/Nachricht an Explore · Code lesen eintippen, Enter schickt sie/)
    await ui.unmount()
  })

  test('ein früheres Ziel in der Eingabe wird ersetzt, nicht doppelt vorangestellt', de, async ($, on) => {
    const seen = engine(on)
    on('prompt.read', () => ({ value: { text: '/agent-tree an sub-9 Hallo', cursor: 26 } }) as never)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'write:sub-1')
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.fills.at(-1)).toBe('/agent-tree an sub-1 Hallo')
    await ui.unmount()
  })

  test('auch ein fertiger Agent hat den Knopf', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    expect(await ui.find({ key: 'write:sub-1' })).toBeDefined()
    await ui.unmount()
  })

  test('/agent-tree an <Kennung> <Text> schickt die Nachricht an den laufenden Agenten', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const result = await run($, 'an sub-1 Bitte nur die Datei auth.ts lesen')
    expect(result.text).toMatch(/Nachricht an Explore · Code lesen geschickt/)
    expect(seen.sent.some(row => JSON.stringify(row.to).includes('sub-1') && row.text.includes('Bitte nur die Datei auth.ts lesen'))).toBe(true)
  })

  test('unbekannte Kennung und fehlender Text werden genannt', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    expect((await run($, 'an zzz Hallo')).text).toMatch(/Kein Agent mit der Kennung zzz/)
    expect((await run($, 'an sub-1')).text).toMatch(/Text fehlt/)
  })

  test('lehnt Claude Code die Zustellung ab, sagt der Befehl das', de, async ($, on) => {
    engine(on, [], { send: true })
    await oneAgentWithAdvisor($)
    expect((await run($, 'an sub-1 Hallo')).text).toMatch(/nicht zugestellt/)
  })

  test('auf Englisch mit to', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    const seen = engine(on)
    on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'write:sub-1')
    for (let i = 0; i < 3; i++) await ui.redraw()
    expect(seen.fills.at(-1)).toBe('/agent-tree to sub-1 ')
    await ui.unmount()
    expect((await run($, 'to sub-1 Shorter please')).text).toMatch(/Message sent to Explore · Code lesen/)
  })
})

describe('Tasten und Übergabe nach /clear', () => {
  test('eine Denkstufe für einen laufenden Agenten steht als „→ Stufe“ am Kasten, bis eine Nachricht sie wirksam macht', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:sub-1')
    await ui.press({ key: 'effort:sub-1:high' })
    await ui.press({ key: 'picker:close' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/medium → high/)
    await $.session.append({ agentId: 'sub-1', message: { type: 'user', content: [{ type: 'text', text: 'x' }] } } as never).catch(() => undefined)
    await ui.unmount()
    await $.command.run({ command: 'agent-tree', args: 'an sub-1 Bitte kürzer', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as never)
    const stream = $.turn.step({ turnId: 't1', index: 3, model: 'claude-haiku-4-5-20251001', effort: 'medium', messageCount: 9, agentId: 'sub-1' })
    let read = await stream.next()
    while (!read.done) read = await stream.next()
    const after = await $.ui.mount(pane(90))
    const text = await screen(after)
    expect(text).not.toMatch(/medium → high/)
    expect(text).toMatch(/high/)
    await after.unmount()
  })

  test('startet nach /clear zuerst ein Agent, nimmt er die übernommene Wahl, und der nächste Zug löscht ihn nicht', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:new')
    await ui.press({ key: 'choose:new:sonnet' })
    await ui.unmount()
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    seen.sessionReplaced()
    await $.agent.spawn({ prompt: 'P.', description: 'Nach dem Leeren', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('sonnet')
    await $.turn.start({ text: 'Weiter', turnId: 't9' })
    const after = await $.ui.mount(pane(90))
    expect(await screen(after)).toMatch(/Nach dem Leeren/)
    await after.unmount()
  })

  test('der Knopf „überspringen“ und alle Tasten laufen über genau einen Hook', de, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'effort:main:low' })
    expect(await ui.find({ key: 'effort:main:low' })).toBeUndefined()
    await ui.press({ key: 'look:open' })
    expect(await ui.find({ key: 'look:default' })).toBeDefined()
    await ui.unmount()
  })
})

describe('Zweites /clear, Intro, Aussehen und Eingaben', () => {
  const run = ($: Engine, args: string) =>
    $.command.run({ command: 'agent-tree', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as never)
  const clearSession = async ($: Engine, seen: { sessionReplaced: () => void }, id = 's1') => {
    await $.session.end({ reason: 'clear', sessionId: id, resume: { id } } as never)
    seen.sessionReplaced()
  }
  const blocks = (text: string) => [...text].filter(c => c === '█' || c === '▀').length

  test('zweimal /clear ohne Eingabe dazwischen behält alle Wahlen', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'effort:main:low' })
    await steer(ui, 'pick:new')
    await ui.press({ key: 'choose:new:sonnet' })
    await ui.unmount()
    await clearSession($, seen, 's1')
    await clearSession($, seen, 's2')
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('low')
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('sonnet')
  })

  test('nach /clear wirkt ein Druck in der Leiste sofort', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    await clearSession($, seen)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    expect(await ui.find({ key: 'effort:main:low' })).toBeDefined()
    await ui.unmount()
  })

  test('nach /clear bleibt das gespeicherte Aussehen sofort sichtbar und die Statuszeile leert sich', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true }, { look: { style: 'ascii', colors: 'retro', light: 'standard' } })
    await oneAgentWithAdvisor($)
    expect(seen.status.at(-1)).toMatch(/Unteragenten \[1\/1\]/)
    await clearSession($, seen)
    expect(seen.status.at(-1) ?? '').not.toMatch(/Unteragenten/)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toContain(PALETTES.retro.main)
    await ui.unmount()
  })

  test('nach /clear und einem Neuladen spielt das Intro nicht mitten in der Unterhaltung', { options: { language: 'de', intro: true, tips: false } }, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const seen = engine(on, [], { clearResets: true })
    await startSession($)
    const first = await $.ui.mount(pane(90))
    await clock.advance(2500)
    await first.redraw()
    expect(blocks(await screen(first))).toBe(0)
    await first.unmount()
    await clearSession($, seen)
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await clock.advance(300)
    await ui.redraw()
    expect(blocks(await screen(ui))).toBe(0)
    await ui.unmount()
  })

  test('zwei Ereignisse gleichzeitig nach /clear nehmen beide die übernommene Wahl und bleiben im Baum', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:new')
    await ui.press({ key: 'choose:new:sonnet' })
    await ui.unmount()
    await clearSession($, seen)
    await Promise.all([
      $.agent.spawn({ prompt: 'A', description: 'Eins', subagentType: 'Plan' } as never),
      $.agent.spawn({ prompt: 'B', description: 'Zwei', subagentType: 'Plan' } as never),
    ])
    expect(seen.spawnModels.slice(-2)).toEqual(['sonnet', 'sonnet'])
    const after = await $.ui.mount(pane(90))
    const text = await screen(after)
    expect(text).toMatch(/Eins/)
    expect(text).toMatch(/Zwei/)
    await after.unmount()
  })

  test('/agent-tree intro auf einer offenen Leiste spielt das Logo ohne Zeichnen von außen', { options: { language: 'de', intro: false, tips: false } }, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await run($, 'intro')
    await clock.advance(400)
    expect(blocks(await screen(ui))).toBeGreaterThan(0)
    await ui.unmount()
  })

  test('ein Agent ohne Denkstufe zeigt keinen Pfeil', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await $.agent.spawn({ prompt: 'P', description: 'Ohne', subagentType: 'Plan' } as never)
    await step($, { agentId: 'sub-1', noEffort: true })
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:sub-1')
    await ui.press({ key: 'effort:sub-1:high' })
    await ui.press({ key: 'picker:close' })
    await ui.redraw()
    expect(await screen(ui)).not.toMatch(/→ high/)
    await ui.unmount()
  })

  test('/agent-tree look ohne „zurück“ löscht das Aussehen nicht', de, async ($, on) => {
    const seen = engine(on, [], {}, { look: { style: 'ascii', colors: 'retro', light: 'gold' } })
    await startSession($)
    for (const args of ['look', 'aussehen', 'look gold']) expect((await run($, args)).text).toMatch(/gibt es nicht/)
    expect(seen.storeSets.filter(s => s.key === 'look')).toEqual([])
    expect((await run($, 'aussehen zurück')).text).toMatch(/zurück auf Standard/)
  })

  test('nach einer Notiz an die Hauptsitzung gilt ihre gewählte Stufe als gesendet', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'effort:main:low' })
    await ui.unmount()
    await run($, 'an sub-1 Bitte kürzer')
    const stream = $.turn.step({ turnId: 't1', index: 1, model: 'claude-opus-5-5', effort: 'high', messageCount: 5 })
    let read = await stream.next()
    while (!read.done) read = await stream.next()
    const after = await $.ui.mount(pane(90))
    expect((await after.find({ key: 'pick:main' }))?.props.label).toBe('Effort low ▾')
    await after.unmount()
  })

  test('ein Schritt, bevor die Korrektur gespeichert ist, zählt sie nicht als gelesen', de, async ($, on) => {
    let release: () => void = () => undefined
    const held = new Promise<void>(resolve => {
      release = resolve
    })
    const seen = engine(on, [], { onSend: () => held })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    const sending = run($, 'an sub-1 Bitte kürzer')
    try {
      for (let i = 0; i < 100_000 && seen.sent.length === 0; i++) await Promise.resolve()
      expect(seen.sent.length).toBe(1)
      await ui.redraw()
      expect(await screen(ui)).not.toMatch(/Korrektur: geschickt/)
      await step($, { agentId: 'sub-1' })
    } finally {
      release()
    }
    expect((await sending).text).toMatch(/geschickt/)
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: geschickt/)
    const handback = await $.tool.call({ tool: 'SubagentHandback', message: 'Bericht', agentId: 'sub-1' } as never)
    expect(JSON.stringify(handback)).toMatch(/deny/)
    await ui.unmount()
  })
})

describe('Wahlen und Stopps laufender Agenten über /clear', () => {
  const run = ($: Engine, args: string) =>
    $.command.run({ command: 'agent-tree', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as never)
  const clearSession = async ($: Engine, seen: { sessionReplaced: () => void }, id = 's1') => {
    await $.session.end({ reason: 'clear', sessionId: id, resume: { id } } as never)
    seen.sessionReplaced()
  }
  const toolStep = async ($: Engine, agentId: string | undefined, effort: 'medium' | 'high') => {
    const stream = $.turn.step({ turnId: 't1', index: 1, model: agentId ? 'claude-sonnet-5-5' : 'claude-opus-5-5', effort, messageCount: 5, ...(agentId ? { agentId } : {}) })
    let read = await stream.next()
    while (!read.done) read = await stream.next()
  }
  const newAgentsOn = async ($: Engine, level: string) => {
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:new')
    await ui.press({ key: `effort:new:${level}` })
    await ui.unmount()
  }

  test('ein laufender Agent behält seine Stufe über /agent-tree clear und /clear', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await newAgentsOn($, 'low')
    await $.agent.spawn({ prompt: 'P', description: 'Mit Low', subagentType: 'Plan' } as never)
    await newAgentsOn($, 'default')
    await $.agent.spawn({ prompt: 'P', description: 'Ohne Wahl', subagentType: 'Plan' } as never)
    await newAgentsOn($, 'high')
    await run($, 'clear')
    await step($, { agentId: 'sub-1' })
    await step($, { agentId: 'sub-2' })
    expect(seen.stepEfforts.slice(-2)).toEqual(['low', 'medium'])
    await clearSession($, seen)
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    await step($, { agentId: 'sub-1' })
    await step($, { agentId: 'sub-2' })
    expect(seen.stepEfforts.slice(-2)).toEqual(['low', 'medium'])
    await $.agent.spawn({ prompt: 'P', description: 'Neu', subagentType: 'Plan' } as never)
    await step($, { agentId: 'sub-3' })
    expect(seen.stepEfforts.at(-1)).toBe('high')
  })

  test('ein von der Liste aufgenommener Agent bekommt die Stufe für neue Agenten nicht', de, async ($, on) => {
    const seen = engine(on, [{ id: 'bg-1', status: 'running', type: 'Explore', description: 'Hintergrund' }])
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await newAgentsOn($, 'low')
    await $.turn.complete({ turnId: 't1', answer: 'ok', reason: 'end_turn', isAborted: false, durationMs: 10 } as never)
    await step($, { agentId: 'bg-1' })
    expect(seen.stepEfforts.at(-1)).toBe('medium')
  })

  test('eine Fortsetzung bekommt die Stufe für neue Agenten nicht, auch ohne Knoten', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await newAgentsOn($, 'low')
    await $.agent.spawn({ prompt: 'Weiter', description: 'Alt', subagentType: 'Plan', resume: { agentId: 'old-7' } } as never)
    await step($, { agentId: 'old-7' })
    expect(seen.stepEfforts.at(-1)).toBe('medium')
  })

  test('ein Ereignis der endenden Sitzung verbraucht die Übergabe nicht', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'effort:main:low' })
    await steer(ui, 'pick:new')
    await ui.press({ key: 'choose:new:sonnet' })
    await ui.unmount()
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    await step($, { agentId: 'sub-1' })
    seen.sessionReplaced()
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    await step($)
    expect(seen.stepEfforts.at(-1)).toBe('low')
    await $.agent.spawn({ prompt: 'P', description: 'Neu', subagentType: 'Plan' } as never)
    expect(seen.spawnModels.at(-1)).toBe('sonnet')
  })

  test('nach /clear zeichnet eine offene Leiste ohne laufende Agenten neu', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Code lesen/)
    await $.turn.complete({ turnId: 't1', agentId: 'sub-1', answer: 'ok', reason: 'answer', isAborted: false, durationMs: 5 } as never)
    await clearSession($, seen)
    expect(await screen(ui)).not.toMatch(/Code lesen/)
    await ui.unmount()
  })

  test('ein aufgenommener Agent mit gewählter Stufe zeigt die ausstehende Änderung', de, async ($, on) => {
    engine(on, [{ id: 'bg-1', status: 'running', type: 'Explore', description: 'Hintergrund' }])
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await $.turn.complete({ turnId: 't1', answer: 'ok', reason: 'end_turn', isAborted: false, durationMs: 10 } as never)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:bg-1')
    await ui.press({ key: 'effort:bg-1:high' })
    await ui.press({ key: 'picker:close' })
    await toolStep($, 'bg-1', 'medium')
    await ui.redraw()
    expect(await screen(ui)).toMatch(/medium → high/)
    await ui.unmount()
  })

  test('eine Zeile von außen an die Hauptsitzung zählt als Eingabe für ihre Stufe', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await step($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:main')
    await ui.press({ key: 'effort:main:low' })
    await ui.unmount()
    await $.session.append({ message: { type: 'user', role: 'user', content: [{ type: 'text', text: 'Hinweis' }] }, door: 'delivery' } as never)
    await toolStep($, undefined, 'high')
    const after = await $.ui.mount(pane(90))
    expect((await after.find({ key: 'pick:main' }))?.props.label).toBe('Effort low ▾')
    await after.unmount()
  })

  test('ein verschachtelter Agent zeigt die ausstehende Stufe', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await $.agent.spawn({ prompt: 'P', description: 'Eltern', subagentType: 'Plan' } as never)
    await $.agent.spawn({ prompt: 'K', description: 'Kind', subagentType: 'Explore', parentAgentId: 'sub-1' } as never)
    await step($, { agentId: 'sub-2' })
    const ui = await $.ui.mount(pane(120))
    await steer(ui, 'pick:sub-2')
    await ui.press({ key: 'effort:sub-2:high' })
    await ui.press({ key: 'picker:close' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/medium → high/)
    await ui.unmount()
  })

  test('Standard für einen Agenten nimmt seine festgehaltene Stufe zurück', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await newAgentsOn($, 'low')
    await $.agent.spawn({ prompt: 'P', description: 'Neu', subagentType: 'Plan' } as never)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:sub-1')
    await ui.press({ key: 'effort:sub-1:default' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('medium')
  })

  test('das Protokoll nennt die Stufe für neue Unteragenten', de, async ($, on) => {
    engine(on)
    await startSession($)
    await newAgentsOn($, 'low')
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toMatch(/Denkstufe für neue Unteragenten: Low/)
    await ui.unmount()
  })

  test('ein nach /agent-tree clear wieder aufgenommener Agent zeigt die Stufe, mit der er läuft', de, async ($, on) => {
    engine(on, [{ id: 'sub-1', status: 'running', type: 'Plan', description: 'Mit Low' }])
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await newAgentsOn($, 'low')
    await $.agent.spawn({ prompt: 'P', description: 'Mit Low', subagentType: 'Plan' } as never)
    await step($, { agentId: 'sub-1' })
    await newAgentsOn($, 'high')
    await run($, 'clear')
    await $.turn.complete({ turnId: 't1', answer: 'ok', reason: 'end_turn', isAborted: false, durationMs: 10 } as never)
    await toolStep($, 'sub-1', 'high')
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toMatch(/Mit Low/)
    expect(text).not.toMatch(/high → low/)
    expect(text).toMatch(/▮▯▯▯▯ low/)
    await ui.unmount()
  })

  test('ein angeforderter Stopp bleibt über /agent-tree clear und /clear bestehen', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    await steer(ui, 'halt:sub-1')
    await ui.unmount()
    await run($, 'clear')
    await clearSession($, seen)
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const before = seen.stepModels.length
    const chunks: unknown[] = []
    await step($, { agentId: 'sub-1', chunks })
    expect(seen.stepModels.length - before).toBe(0)
    expect(JSON.stringify(chunks)).toMatch(/SubagentHandback/)
  })


  test('ein verborgener Agent, den die Liste nicht führt, behält seine Stufe nach dem nächsten Zug', de, async ($, on) => {
    const seen = engine(on, [])
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await newAgentsOn($, 'low')
    await $.agent.spawn({ prompt: 'P', description: 'Workflow-Agent', subagentType: 'Plan' } as never)
    await run($, 'clear')
    await $.turn.complete({ turnId: 't1', answer: 'ok', reason: 'end_turn', isAborted: false, durationMs: 10 } as never)
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('low')
  })

  test('nach /clear bleibt ein laufender Agent ansprechbar und meldet seine echten Werkzeugaufrufe beim Stopp', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    await $.tool.call({ tool: 'Read', input: { file_path: '/a.ts' }, agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Read', input: { file_path: '/b.ts' }, agentId: 'sub-1' } as never)
    await clearSession($, seen)
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    expect((await run($, 'an sub-1 Bitte kürzer')).text).toMatch(/geschickt/)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    await steer(ui, 'halt:sub-1')
    await ui.unmount()
    const chunks: unknown[] = []
    await step($, { agentId: 'sub-1', chunks })
    expect(JSON.stringify(chunks)).toMatch(/nach 3 Werkzeugaufrufen/)
  })

  test('eine Zeile an einen laufenden Agenten zählt auch nach /clear als Eingabe', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    await step($, { agentId: 'sub-1' })
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'pick:sub-1')
    await ui.press({ key: 'effort:sub-1:high' })
    await ui.press({ key: 'picker:close' })
    await ui.unmount()
    await $.session.append({ message: { type: 'user', role: 'user', content: [{ type: 'text', text: 'Hinweis' }] }, door: 'delivery', agentId: 'sub-1' } as never)
    await clearSession($, seen)
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    await toolStep($, 'sub-1', 'medium')
    const after = await $.ui.mount(pane(90))
    expect(await screen(after)).not.toMatch(/medium → high/)
    await after.unmount()
  })

  test('ein Schritt einer Schleife, die nie gestartet wurde, bekommt die Stufe für neue Agenten nicht', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await newAgentsOn($, 'low')
    await step($, { agentId: 'fork-compaction-1' })
    expect(seen.stepEfforts.at(-1)).toBe('medium')
  })

  test('ein später Schritt der endenden Sitzung stellt die alte Statuszeile nicht wieder her', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    expect(seen.status.at(-1)).toBe('')
    await $.session.measure({ context: { window: 200000, tokens: 4000, percent: 2 }, rateLimits: [], cost: { usd: 0.1 }, changed: ['context', 'cost'] } as never)
    expect(seen.status.at(-1)).toBe('')
  })

  test('ohne Eingabefeld meldet der Schreib-Knopf das, auch wenn Claude Code das Füllen ablehnt', de, async ($, on) => {
    const seen = engine(on, [], { fillFails: true })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'write:sub-1')
    await ui.unmount()
    expect(seen.toasts.at(-1) ?? '').not.toMatch(/Enter schickt/)
  })

  test('ein beendeter Agent, der nach /agent-tree clear fortgesetzt wird, behält seine festgehaltene Stufe', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    await $.turn.start({ text: 'Los', turnId: 't1' })
    await newAgentsOn($, 'low')
    await $.agent.spawn({ prompt: 'P', description: 'Teammitglied', subagentType: 'Plan' } as never)
    await step($, { agentId: 'sub-1' })
    await $.turn.complete({ turnId: 't1', agentId: 'sub-1', answer: 'ok', reason: 'answer', isAborted: false, durationMs: 5 } as never)
    await newAgentsOn($, 'high')
    await run($, 'clear')
    await $.agent.spawn({ prompt: 'Weiter', description: 'Teammitglied', subagentType: 'Plan', resume: { agentId: 'sub-1' } } as never)
    await step($, { agentId: 'sub-1' })
    expect(seen.stepEfforts.at(-1)).toBe('low')
  })

  test('ein Agent, der kurz nach /clear noch in der alten Sitzung endet, kommt nicht als laufend in die neue', de, async ($, on) => {
    const seen = engine(on, [], { clearResets: true })
    await oneAgentWithAdvisor($)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    await $.turn.complete({ turnId: 't1', agentId: 'sub-1', answer: 'ok', reason: 'answer', isAborted: false, durationMs: 5 } as never)
    seen.sessionReplaced()
    await $.turn.start({ text: 'Weiter', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).not.toMatch(/Code lesen/)
    await ui.unmount()
  })
})


async function twoAgents($: Engine) {
  await startSession($)
  await $.turn.start({ text: 'Bau das', turnId: 't1' })
  await step($)
  await $.agent.spawn({ prompt: 'A', description: 'Agent A', subagentType: 'general-purpose' } as never)
  await $.agent.spawn({ prompt: 'B', description: 'Agent B', subagentType: 'general-purpose' } as never)
  await step($, { agentId: 'sub-1' })
  await step($, { agentId: 'sub-2' })
}

const clashOf = (s: AgentTreeState, id: string) => s.agents.find(n => n.id === id)?.clash

describe('Gleiche Datei', () => {
  test('gleicher Name in zwei Ordnern warnt nicht', de, async ($, on) => {
    const { tree } = engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/index.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/test/index.ts', agentId: 'sub-2' } as never)
    const s = tree()
    expect([clashOf(s, 'sub-1'), clashOf(s, 'sub-2')]).toEqual([undefined, undefined])
  })

  test('dieselbe Datei warnt beide laufenden Agenten', de, async ($, on) => {
    const { tree } = engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-2' } as never)
    const s = tree()
    expect(clashOf(s, 'sub-1')).toEqual({ file: 'api.ts', with: 'sub-2' })
    expect(clashOf(s, 'sub-2')).toEqual({ file: 'api.ts', with: 'sub-1' })
  })

  test('absoluter und relativer Pfad derselben Datei warnen', de, async ($, on) => {
    const { tree } = engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/src/api.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: 'src/api.ts', agentId: 'sub-2' } as never)
    const s = tree()
    expect(clashOf(s, 'sub-1')).toEqual({ file: 'api.ts', with: 'sub-2' })
    expect(clashOf(s, 'sub-2')).toEqual({ file: 'api.ts', with: 'sub-1' })
  })

  test('Hauptsitzung und Agent an derselben Datei', de, async ($, on) => {
    const { tree } = engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-1' } as never)
    expect(clashOf(tree(), 'sub-1')).toEqual({ file: 'api.ts', with: 'main' })
  })

  test('endet einer, verschwindet die Warnung beim anderen', de, async ($, on) => {
    const { tree } = engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-2' } as never)
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-2', reason: 'answer' })
    expect(clashOf(tree(), 'sub-1')).toBeUndefined()
  })

  test('meldet sich vor dem zweiten Schreiben, einmal je Datei', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    const { tree } = engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-1' } as never)
    const held = (await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-2' } as never)) as { deny?: string }
    expect(held.deny).toBe('Agent Tree: Agent A already changed api.ts during this run. Read the file again, then make your change.')
    expect(clashOf(tree(), 'sub-2')).toEqual({ file: 'api.ts', with: 'sub-1' })
    const again = (await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-2' } as never)) as { deny?: string }
    expect(again.deny).toBeUndefined()
  })

  test('nach dem Ende des ersten Agenten kein Halt', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-1' } as never)
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const free = (await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-2' } as never)) as { deny?: string }
    expect(free.deny).toBeUndefined()
  })

  test('Hauptsitzung wird vor einer Datei des Agenten gewarnt', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Write', file_path: '/p/src/api.ts', agentId: 'sub-1' } as never)
    const held = (await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts' } as never)) as { deny?: string }
    expect(held.deny).toContain('Agent A already changed api.ts')
  })

  test('Lesen hält nicht an', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-1' } as never)
    const read = (await $.tool.call({ tool: 'Read', file_path: '/p/src/api.ts', agentId: 'sub-2' } as never)) as { deny?: string }
    expect(read.deny).toBeUndefined()
  })

  test('kein Pfad im Zustand', de, async ($, on) => {
    const { tree } = engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/geheim/api.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Read', file_path: '/p/geheim/b.ts', agentId: 'sub-2' } as never)
    const text = JSON.stringify(tree())
    expect(text).toContain('api.ts')
    expect(text.includes('geheim')).toBe(false)
  })
})

async function agentWithModel($: Engine, model: string) {
  await startSession($)
  await $.turn.start({ text: 'Bau das', turnId: 't1' })
  await step($)
  await $.session.measure({ context: { window: 200000, tokens: 50000, percent: 25 }, rateLimits: [], cost: { usd: 1.5 }, changed: ['context'] } as never)
  await $.agent.spawn({ prompt: 'A', description: 'Agent A', subagentType: 'general-purpose' } as never)
  await step($, { agentId: 'sub-1', model })
}

describe('Kontext je Agent in der Leiste', () => {
  test('gleiches Modell wie die Hauptsitzung: Prozent statt Tokenzahl', de, async ($, on) => {
    engine(on)
    await agentWithModel($, 'claude-opus-5-5')
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toContain('16 %')
    expect(text.includes('läuft · 32k')).toBe(false)
    await ui.unmount()
  })

  test('anderes Modell: Tokenzahl wie bisher', de, async ($, on) => {
    engine(on)
    await agentWithModel($, 'claude-haiku-5-5')
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toContain('läuft · 32k')
    expect(text.includes('16 %')).toBe(false)
    await ui.unmount()
  })

  test('jedes Farbschema hat eine Warnfarbe', () => {
    for (const palette of Object.values(PALETTES)) expect(typeof (palette as { warn?: string }).warn).toBe('string')
  })
})

const en = { options: { language: 'en', intro: false, tips: false } }
const has = (text: string, key: string) => text.includes(`"key":"${key}"`)

describe('Aktionszeile', () => {
  test('ohne Auswahl: Hinweis und keine Hebel im Baum', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).toContain('Kasten anklicken')
    expect([has(text, 'halt:sub-1'), has(text, 'write:sub-1'), has(text, 'select:sub-1')]).toEqual([false, false, true])
    await ui.unmount()
  })

  test('gewählter Agent: Knöpfe in Worten', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    const text = await screen(ui)
    for (const key of ['halt:sub-1', 'write:sub-1', 'pick:sub-1', 'detail:sub-1']) expect(has(text, key)).toBe(true)
    expect(text).toContain('Stoppen')
    expect(text).toContain('Schreiben')
    await ui.unmount()
  })

  test('Rückmeldung nach der Modellwahl', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    await ui.press({ key: 'pick:sub-1' })
    await ui.press({ key: 'choose:sub-1:opus' })
    const text = await screen(ui)
    expect(text).toContain('Modell auf Opus gestellt')
    expect(text).toContain('nächsten Schritt')
    await ui.unmount()
  })

  test('schmale Leiste: alle Knöpfe da', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(40))
    await ui.press({ key: 'select:sub-1' })
    const text = await screen(ui)
    for (const key of ['halt:sub-1', 'write:sub-1', 'pick:sub-1', 'detail:sub-1']) expect(has(text, key)).toBe(true)
    await ui.unmount()
  })

  test('Zeilenmodus: Auswahl über die Zeile des Agenten', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(30))
    expect(has(await screen(ui), 'select:sub-1')).toBe(true)
    await ui.press({ key: 'select:sub-1' })
    const text = await screen(ui)
    for (const key of ['halt:sub-1', 'write:sub-1', 'pick:sub-1', 'detail:sub-1']) expect(has(text, key)).toBe(true)
    await ui.unmount()
  })

  test('gewählter Agent nach /agent-tree clear entfernt: Hinweis statt Knöpfe', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    expect(has(await screen(ui), 'detail:sub-1')).toBe(true)
    await $.command.run({ command: 'agent-tree', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
    const text = await screen(ui)
    expect(has(text, 'detail:sub-1')).toBe(false)
    expect(text).toContain('Kasten anklicken')
    await ui.unmount()
  })

  test('Workflow gewählt: keine Knöpfe', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: 'Bau das', turnId: 't1' })
    await step($)
    await $.agent.spawn({ prompt: 'P.', description: 'Teil 1', subagentType: 'general-purpose', workflow: { runId: 'wf_x', agentIndex: 0 } } as never)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:wf:wf_x' })
    const text = await screen(ui)
    expect(text).toContain('Workflow')
    expect([has(text, 'halt:sub-1'), has(text, 'write:sub-1'), has(text, 'pick:sub-1')]).toEqual([false, false, false])
    await ui.unmount()
  })

  test('gleiche Datei: Warnung in der Zeile', de, async ($, on) => {
    engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/api.ts', agentId: 'sub-2' } as never)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    const text = await screen(ui)
    expect(text).toContain('⚠ Agent B ändert api.ts auch')
    await ui.unmount()
  })

  test('englisch: Hinweis und Knöpfe auf Englisch', en, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).toContain('Click a box')
    await ui.press({ key: 'select:sub-1' })
    const text = await screen(ui)
    expect(text).toContain('Stop')
    expect(text).toContain('Write')
    await ui.unmount()
  })
})

describe('Detailkasten', () => {
  async function details($: Engine) {
    await oneAgentWithAdvisor($)
    await $.tool.call({ tool: 'Edit', file_path: '/x/api.ts', agentId: 'sub-1' } as never)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    return ui
  }

  test('zeigt gelesene und geänderte Dateien', de, async ($, on) => {
    engine(on)
    const ui = await details($)
    const text = await screen(ui)
    expect(text).toContain('Gelesen: auth.ts')
    expect(text).toContain('Geändert: api.ts')
    await ui.unmount()
  })

  test('hat kein Eingabefeld und keinen Stopp-Knopf', de, async ($, on) => {
    engine(on)
    const ui = await details($)
    const text = await screen(ui)
    expect(text.includes('"key":"say:')).toBe(false)
    expect(has(text, 'stop:sub-1')).toBe(false)
    await ui.unmount()
  })
})

describe('Auswahl über Runden', () => {
  test('ein gewählter Agent aus einer früheren Runde fällt auf den Hinweis zurück', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    expect(has(await screen(ui), 'detail:sub-1')).toBe(true)
    await $.turn.complete({ answer: 'fertig', durationMs: 900, isAborted: false, turnId: 't1', reason: 'answer' })
    await $.turn.start({ text: 'Nächste Runde', turnId: 't2' })
    await ui.redraw()
    const text = await screen(ui)
    expect(has(text, 'detail:sub-1')).toBe(false)
    expect(text).toContain('Kasten anklicken')
    await ui.unmount()
  })
})

async function agents($: Engine, count: number) {
  await startSession($)
  await $.turn.start({ text: 'Bau das', turnId: 't1' })
  await step($)
  for (let i = 1; i <= count; i++) await $.agent.spawn({ prompt: `P${i}`, description: `Agent ${i}`, subagentType: 'general-purpose' } as never)
  for (let i = 1; i <= count; i++) await step($, { agentId: `sub-${i}` })
}

describe('Platz und Hebel in der Leiste', () => {
  test('ein gewählter Kasten behält seine Nachbarn in der Reihe', de, async ($, on) => {
    engine(on)
    await agents($, 3)
    for (const rows of [40, 44, 47]) {
      const ui = await $.ui.mount(pane(67, rows))
      if (!has(await screen(ui), 'actions:close')) await ui.press({ key: 'select:sub-3' })
      const text = await screen(ui)
      expect([rows, has(text, 'actions:close'), ...['sub-1', 'sub-2', 'sub-3'].map(id => has(text, `select:${id}`))]).toEqual([rows, true, true, true, true])
      await ui.unmount()
    }
  })

  test('ein gewählter Kasten hinter der Grenze wird eingeblendet', de, async ($, on) => {
    engine(on)
    await agents($, 6)
    const tall = await $.ui.mount(pane(67, 90))
    await tall.press({ key: 'select:sub-5' })
    await tall.unmount()
    const ui = await $.ui.mount(pane(67, 47))
    expect(has(await screen(ui), 'select:sub-5')).toBe(true)
    await ui.unmount()
  })

  test('Details stehen anstelle des Protokolls', de, async ($, on) => {
    engine(on)
    await agents($, 3)
    await $.tool.call({ tool: 'Read', file_path: '/p/src/auth.ts', agentId: 'sub-1' } as never)
    const ui = await $.ui.mount(pane(67, 47))
    await ui.press({ key: 'select:sub-1' })
    await ui.press({ key: 'detail:sub-1' })
    const text = await screen(ui)
    expect(text).toContain('Gelesen: auth.ts')
    expect(text.includes('Sitzungsprotokoll')).toBe(false)
    await ui.unmount()
  })

  test('Details stehen kompakt unter der Aktionszeile, ohne Limits und Hilfezeile', de, async ($, on) => {
    engine(on)
    await agents($, 3)
    await $.tool.call({ tool: 'Read', file_path: '/p/src/auth.ts', agentId: 'sub-1' } as never)
    await $.session.measure({
      context: { window: 200000, tokens: 50000, percent: 25 },
      rateLimits: [{ kind: 'seven_day', percentUsed: 30, resetsAt: new Date(2026, 10, 11, 22, 0).toISOString() }],
      cost: { usd: 1.5 },
      changed: ['context', 'rateLimits'],
    } as never)
    const ui = await $.ui.mount(pane(67, 46))
    await ui.press({ key: 'select:sub-1' })
    expect(await screen(ui)).toContain('Woche')
    await ui.press({ key: 'detail:sub-1' })
    const text = await screen(ui)
    expect(text.includes('Woche')).toBe(false)
    expect(text.split('general-purpose · Agent 1').length - 1).toBe(1)
    expect(has(text, 'detail:close')).toBe(true)
    expect(text.includes('ctrl+x tab')).toBe(false)
    await ui.press({ key: 'detail:close' })
    expect(await screen(ui)).toContain('ctrl+x tab')
    await ui.unmount()
  })

  test('× in der Titelzeile schließt Auswahl, Wahl und Details', de, async ($, on) => {
    engine(on)
    await agents($, 2)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    await ui.press({ key: 'detail:sub-1' })
    let text = await screen(ui)
    expect(has(text, 'actions:close')).toBe(true)
    await ui.press({ key: 'actions:close' })
    text = await screen(ui)
    expect([has(text, 'actions:close'), has(text, 'detail:close'), has(text, 'halt:sub-1')]).toEqual([false, false, false])
    expect(text).toContain('Kasten anklicken')
    await ui.press({ key: 'select:sub-2' })
    await ui.press({ key: 'pick:sub-2' })
    await ui.press({ key: 'actions:close' })
    expect(has(await screen(ui), 'choose:sub-2:opus')).toBe(false)
    await ui.unmount()
  })

  test('abgelehnte Änderung zählt nicht und warnt nicht', de, async ($, on) => {
    const { tree } = engine(on, [], { denyEdit: true })
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/denyEdit/api.ts' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/denyEdit/api.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/denyEdit/api.ts', agentId: 'sub-2' } as never)
    const s = tree()
    expect([clashOf(s, 'sub-1'), clashOf(s, 'sub-2'), s.agents.find(n => n.id === 'sub-1')?.changed]).toEqual([undefined, undefined, undefined])
  })

  test('gescheiterte Änderung zählt nicht und warnt nicht', de, async ($, on) => {
    const { tree } = engine(on, [], { failEdit: true })
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/failEdit/api.ts' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/failEdit/api.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/failEdit/api.ts', agentId: 'sub-2' } as never)
    const s = tree()
    expect([clashOf(s, 'sub-1'), clashOf(s, 'sub-2'), s.agents.find(n => n.id === 'sub-1')?.changed]).toEqual([undefined, undefined, undefined])
  })


  test('drei an einer Datei: endet die Hauptsitzung, warnen die beiden anderen weiter', de, async ($, on) => {
    const { tree } = engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/drei/x.ts' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/drei/x.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/drei/x.ts', agentId: 'sub-2' } as never)
    await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', reason: 'answer' } as never)
    const s = tree()
    expect([clashOf(s, 'sub-1'), clashOf(s, 'sub-2')]).toEqual([{ file: 'x.ts', with: 'sub-2' }, { file: 'x.ts', with: 'sub-1' }])
  })

  test('Auswahlwechsel schließt die Details des alten Agenten', de, async ($, on) => {
    engine(on)
    await agents($, 2)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    await ui.press({ key: 'detail:sub-1' })
    await ui.press({ key: 'select:sub-2' })
    const text = await screen(ui)
    expect([has(text, 'detail:close'), has(text, 'halt:sub-2')]).toEqual([false, true])
    await ui.unmount()
  })

  test('beendeter Agent: kein Pfeil und kein Hinweis zur Modellwahl', de, async ($, on) => {
    engine(on)
    await agents($, 1)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    await ui.press({ key: 'pick:sub-1' })
    await ui.press({ key: 'choose:sub-1:sonnet' })
    await $.turn.complete({ answer: 'fertig', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' } as never)
    await ui.redraw()
    const text = await screen(ui)
    expect([text.includes('→ Sonnet'), text.includes('nächsten Schritt')]).toEqual([false, false])
    await ui.unmount()
  })

  test('Modellwechsel passt in den Kasten', de, async ($, on) => {
    engine(on)
    await agents($, 1)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    await ui.press({ key: 'pick:sub-1' })
    await ui.press({ key: 'choose:sub-1:sonnet' })
    expect(await screen(ui)).toContain('Haiku → Sonnet')
    await ui.unmount()
  })

  test('Denkstufe mit eigenem Knopf, er öffnet die Wahl', de, async ($, on) => {
    engine(on)
    await agents($, 1)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    const text = await screen(ui)
    expect(has(text, 'level:sub-1')).toBe(true)
    expect(text).toContain('Denkstufe: Medium ▾')
    await ui.press({ key: 'level:sub-1' })
    expect(has(await screen(ui), 'effort:sub-1:high')).toBe(true)
    await ui.unmount()
  })

  test('die Wahl für einen Agenten steht unter der Aktionszeile', de, async ($, on) => {
    engine(on)
    await agents($, 1)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-1' })
    await ui.press({ key: 'pick:sub-1' })
    const text = await screen(ui)
    expect(text.indexOf('"key":"choose:sub-1:opus"')).toBeGreaterThan(text.indexOf('"key":"halt:sub-1"'))
    await ui.unmount()
  })

  test('eine neue Sitzung vergisst die Dateien der alten', de, async ($, on) => {
    const { tree } = engine(on)
    await startSession($)
    await $.turn.start({ text: 'Bau das', turnId: 't1' })
    await step($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/neu/api.ts' } as never)
    await agents($, 1)
    await $.tool.call({ tool: 'Edit', file_path: '/p/neu/api.ts', agentId: 'sub-1' } as never)
    expect(clashOf(tree(), 'sub-1')).toBeUndefined()
  })
})

describe('Tabs', () => {
  const TAB_KEYS = ['tab:tree', 'tab:reports', 'tab:files', 'tab:log', 'tab:usage', 'tab:terminals', 'tab:help']

  test('die Leiste zeigt sieben Tabs als Reiter, der Baum ist gewählt', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    for (const key of TAB_KEYS) expect(await ui.find({ key })).toBeDefined()
    const text = await screen(ui)
    for (const word of ['Baum', 'Berichte', 'Dateien', 'Verlauf', 'Kosten', 'Fenster', '?']) expect(text).toContain(word)
    expect(text).toContain('"key":"tab-tops"')
    expect(text).toContain('"key":"main"')
    await ui.unmount()
  })

  test('ein anderer Tab nimmt den Baum weg, der Tab Baum holt ihn zurück', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    expect(await screen(ui)).not.toContain('"key":"main"')
    await ui.press({ key: 'tab:tree' })
    await ui.redraw()
    expect(await screen(ui)).toContain('"key":"main"')
    await ui.unmount()
  })

  test('mit den kurzen Namen bleiben alle sieben Reiter bis 55 Spalten gerahmt', de, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(55))
    expect(await screen(ui)).toContain('"key":"tab-tops"')
    await ui.unmount()
  })

  test('bei schmaler Leiste wird aus den Reitern ein Streifen', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(44))
    for (const key of TAB_KEYS) expect(await ui.find({ key })).toBeDefined()
    expect(await screen(ui)).not.toContain('"key":"tab-tops"')
    await ui.unmount()
  })

  test('auch bei niedriger Leiste bleiben die Reiter mit ihrem Rahmen', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90, 30))
    for (const key of TAB_KEYS) expect(await ui.find({ key })).toBeDefined()
    expect(await screen(ui)).toContain('"key":"tab-tops"')
    await ui.unmount()
  })

  test('vor dem Titel steht kein Logo', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text).not.toContain('"key":"mark"')
    expect(text).not.toMatch(/[▀▄]/)
    await ui.unmount()
  })

  test('die Farblegende steht im Tab Hilfe und nicht mehr im Kopf', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await screen(ui)).not.toContain('"key":"legend"')
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    expect(await screen(ui)).toContain('"key":"legend"')
    await ui.unmount()
  })

  test('am Tab Dateien steht ein Warnzeichen, solange zwei Agenten dieselbe Datei ändern', de, async ($, on) => {
    engine(on)
    await twoAgents($)
    const ui = await $.ui.mount(pane(90))
    expect(JSON.stringify(await ui.find({ key: 'tab:files' }))).not.toContain('⚠')
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/index.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/index.ts', agentId: 'sub-2' } as never)
    await ui.redraw()
    expect(JSON.stringify(await ui.find({ key: 'tab:files' }))).toContain('⚠')
    await ui.unmount()
  })

  test('am Tab Berichte steht ein Punkt, bis die neue Antwort gesehen ist', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(JSON.stringify(await ui.find({ key: 'tab:reports' }))).not.toContain('●')
    await $.turn.complete({ answer: 'Fertig.', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    expect(JSON.stringify(await ui.find({ key: 'tab:reports' }))).toContain('●')
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    await ui.press({ key: 'tab:tree' })
    await ui.redraw()
    expect(JSON.stringify(await ui.find({ key: 'tab:reports' }))).not.toContain('●')
    await ui.unmount()
  })
})

describe('Tab Verlauf', () => {
  test('zeigt alle Einträge, die neuesten zuerst', de, async ($, on) => {
    engine(on)
    await agents($, 3)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"log-view"')
    expect(text.indexOf('gestartet: Agent 3')).toBeGreaterThan(-1)
    expect(text.indexOf('gestartet: Agent 3')).toBeLessThan(text.indexOf('gestartet: Agent 1'))
    await ui.unmount()
  })

  test('der Filter zeigt nur eine Quelle, alle hebt ihn auf', de, async ($, on) => {
    engine(on)
    await agents($, 2)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Runde 1/)
    await ui.press({ key: 'logfilter:agent' })
    await ui.redraw()
    const filtered = await screen(ui)
    expect(filtered).toMatch(/gestartet: Agent 2/)
    expect(filtered).not.toMatch(/Runde 1/)
    await ui.press({ key: 'logfilter:all' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Runde 1/)
    await ui.unmount()
  })

  test('ein Filter ohne Treffer behauptet nicht, es sei nichts geschehen', de, async ($, on) => {
    engine(on)
    await agents($, 2)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.press({ key: 'logfilter:advisor' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/0 Einträge/)
    expect(text).not.toMatch(/noch nichts geschehen/)
    await ui.unmount()
  })

  test('ohne Einträge steht dort, dass noch nichts geschehen ist', de, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/noch nichts geschehen/)
    await ui.unmount()
  })
})

describe('Tab Dateien', () => {
  test('zeigt je Agent alle geänderten und gelesenen Dateien, nicht nur die letzten sechs', de, async ($, on) => {
    engine(on)
    await twoAgents($)
    for (let i = 1; i <= 8; i++) await $.tool.call({ tool: 'Edit', file_path: `/p/src/teil${i}.ts`, agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Read', file_path: '/p/src/lesen.ts', agentId: 'sub-2' } as never)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:files' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"files-view"')
    for (let i = 1; i <= 8; i++) expect(text).toContain(`teil${i}.ts`)
    for (const word of ['Agent A', 'Agent B', 'lesen.ts', 'Geändert (8)', 'Gelesen (1']) expect(text).toContain(word)
    expect(text).toMatch(/Gelesen \(1, ~\d[^)]*\): lesen\.ts ~\d/)
    expect(text).toContain('Geändert (0)')
    expect(text).not.toContain('Geändert (0):')
    await ui.unmount()
  })

  test('doppelt geänderte Dateien stehen oben mit beiden Agenten', de, async ($, on) => {
    engine(on)
    await twoAgents($)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/index.ts', agentId: 'sub-1' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/p/src/index.ts', agentId: 'sub-2' } as never)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:files' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"files-clash"')
    expect(text).toMatch(/index\.ts · Agent A \+ Agent B/)
    expect(text.indexOf('"key":"files-clash"')).toBeLessThan(text.indexOf('"key":"files:sub-1"'))
    await ui.unmount()
  })

  test('ohne Dateien steht dort ein Hinweis', de, async ($, on) => {
    engine(on)
    await twoAgents($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:files' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/noch keine Dateien/)
    await ui.unmount()
  })
})

describe('Der ganze Kasten ist die Klickfläche', () => {
  test('die Klickfläche eines Kastens umfasst alle seine Zeilen', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const button = JSON.stringify(await ui.find({ key: 'select:sub-1' }))
    for (const word of ['Explore', 'Haiku', 'Code lesen', 'liest auth.ts', 'läuft']) expect(button).toContain(word)
    await ui.unmount()
  })

  test('jeder Kasten bleibt ein einziger Knopf', de, async ($, on) => {
    engine(on)
    await twoAgents($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    expect(text.split('"key":"select:sub-1"').length - 1).toBe(1)
    expect(text.split('"type":"Button"').length - 1).toBe((await ui.findAll({ type: 'Button' })).length)
    const buttons = (await ui.findAll({ type: 'Button' })).map(b => String(b.props.key ?? b.key ?? ''))
    expect(buttons.filter(key => key.includes('sub-1'))).toEqual(['select:sub-1'])
    await ui.unmount()
  })

  test('ein Druck auf die Klickfläche wählt den Agenten', de, async ($, on) => {
    engine(on)
    await twoAgents($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'select:sub-2' })
    await ui.redraw()
    expect(String((await ui.find({ key: 'select:sub-2' }))?.props.label ?? '')).toMatch(/^▸ /)
    await ui.unmount()
  })
})

describe('Tab Verbrauch', () => {
  test('in der Tabelle steht die Aufgabe vor dem Agententyp, damit sie in schmalen Leisten lesbar bleibt', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(69))
    await ui.press({ key: 'tab:usage' })
    await ui.redraw()
    expect(await screen(ui)).toContain(' Code lesen · Explore')
    await ui.unmount()
  })

  test('zeigt die Limits, den Kontext der Hauptsitzung und je Agent Modell, Kontext und Werkzeuge', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const rateLimits = [
      { kind: 'five_hour', percentUsed: 13 },
      { kind: 'seven_day', percentUsed: 84 },
    ]
    await $.session.measure({ context: { window: 200000, tokens: 50000, percent: 25 }, rateLimits, cost: { usd: 1.5 }, changed: ['context', 'rateLimits'] } as never)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:usage' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"usage-view"')
    for (const word of ['13 %', '84 %', 'Kontext 50k', 'Code lesen', 'Haiku', 'Werkzeuge']) expect(text).toContain(word)
    await ui.unmount()
  })

  test('zeigt je Agent die Denkstufe und darunter die Auswertung mit echtem Verbrauch, Hauptsitzung und Limits', de, async ($, on) => {
    engine(on, [{ id: 'sub-1', description: 'Code lesen', type: 'Explore', status: 'running', usage: [{ ...usage, model: 'claude-haiku-4-5-20251001' }], cost: { usd: 0.25 } }] as never)
    await oneAgentWithAdvisor($)
    await $.turn.complete({ turnId: 't1', answer: 'fertig' } as never)
    const rateLimits = [{ kind: 'seven_day', percentUsed: 40 }]
    await $.session.measure({ context: { window: 200000, tokens: 50000, percent: 25 }, rateLimits, cost: { usd: 1.5 }, changed: ['context', 'rateLimits'] } as never)
    const ui = await $.ui.mount(pane(100))
    await ui.press({ key: 'tab:usage' })
    await ui.redraw()
    const text = await screen(ui)
    for (const word of ['Stufe', 'Medium', 'Auswertung', '1 Agent', '32k Tokens', '0,25 $', '40 %']) expect(text).toContain(word)
    expect(text.indexOf('Auswertung')).toBeLessThan(text.indexOf('40 %'))
    expect(text.indexOf('Code lesen')).toBeLessThan(text.indexOf('Auswertung'))
    await ui.unmount()
  })

  test('ohne Unteragenten steht dort, dass es noch keine gibt', de, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:usage' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/noch keine Unteragenten/)
    await ui.unmount()
  })
})

describe('Tab Fenster', () => {
  const otherPeer = (at: number) => ({
    id: 'other',
    folder: 'claude_hermes',
    rootKey: 'fremd',
    branch: 'main',
    running: 1,
    costUsd: 0.42,
    at,
    changed: [{ key: pathKey('/x/auth.ts'), name: 'auth.ts', at }],
    notes: [{ path: '/home/u/claude_hermes/CLAUDE.md', name: 'CLAUDE.md', at }],
  })

  test('zeigt dieses und die anderen offenen Terminals, eine Markdown-Änderung von dort und legt die Frage in die Eingabe', de, async ($, on) => {
    const t = engine(on)
    mock.clock(on, { now: 5_000_000 })
    t.stored['peer:other'] = otherPeer(5_000_000)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:terminals' })
    await ui.redraw()
    const text = await screen(ui)
    for (const word of ['Dieses Terminal', 'Andere Terminals', 'claude_hermes', 'main', '1 Agent läuft', '0,42 $', 'Markdown in anderen Terminals geändert', 'CLAUDE.md', 'Hier prüfen']) expect(text).toContain(word)
    expect(Object.keys(t.stored).filter(k => k.startsWith('peer:')).length).toBe(2)
    expect(t.toasts.some(x => x.includes('claude_hermes hat CLAUDE.md geändert'))).toBe(true)
    await ui.press({ key: `notetake:${pathKey('other|/home/u/claude_hermes/CLAUDE.md|5000000')}` })
    await ui.redraw()
    expect(t.fills.at(-1)).toContain('/home/u/claude_hermes/CLAUDE.md')
    expect(await screen(ui)).not.toContain('Hier prüfen')
    await ui.unmount()
  })

  test('warnt, wenn ein anderes Terminal dieselbe Datei geändert hat, und vergisst alte Einträge', de, async ($, on) => {
    const t = engine(on)
    const now = 5_000_000
    mock.clock(on, { now })
    t.stored['peer:other'] = otherPeer(now)
    t.stored['peer:alt'] = { ...otherPeer(now - 2 * 60 * 60_000), id: 'alt' }
    await oneAgentWithAdvisor($)
    await $.tool.call({ tool: 'Edit', file_path: '/x/auth.ts', old_string: 'a', new_string: 'b' } as never)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:terminals' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('Gleiche Datei in zwei Terminals')
    expect(text).toContain('auth.ts · hier und in claude_hermes')
    expect(t.stored['peer:alt']).toBeUndefined()
    expect(t.toasts.some(x => x.includes('auth.ts wurde auch im Terminal claude_hermes geändert'))).toBe(true)
    await ui.unmount()
  })

  test('das Limit sagt, wann es bei diesem Tempo voll ist, auch in der schmalen Leiste, und vergisst es ohne neue Messung', de, async ($, on) => {
    engine(on)
    const clock = mock.clock(on, { now: 5_000_000 })
    await startSession($)
    const measure = (percentUsed: number) =>
      $.session.measure({ context: { window: 200000, tokens: 50000, percent: 25 }, rateLimits: [{ kind: 'five_hour', percentUsed }], changed: ['rateLimits'] } as never)
    await measure(50)
    await clock.advance(10 * 60_000)
    await measure(70)
    const ui = await $.ui.mount(pane(56))
    await ui.redraw()
    expect(await screen(ui)).toContain('voll in ~15 min')
    await clock.advance(31 * 60_000)
    await ui.redraw()
    expect(await screen(ui)).not.toContain('voll in ~')
    await ui.unmount()
  })

  test('ohne andere Terminals steht dort, dass keins offen ist', de, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:terminals' })
    await ui.redraw()
    expect(await screen(ui)).toContain('kein anderes Terminal mit Agent Tree offen')
    await ui.unmount()
  })
})

describe('Lokales Modell', () => {
  const localOn = { options: { language: 'de', intro: false, tips: false, localModel: 'qwen2.5-coder:7b', localUrl: 'http://127.0.0.1:11434/v1/' } }

  test('ab Werk aus: kein Werkzeug, im Reiter Kosten steht, wie man es einschaltet', de, async ($, on) => {
    engine(on)
    const registered: unknown[] = []
    on('tool.register', (_, e) => {
      registered.push(e)
      return { value: { tool: 'x' } } as never
    })
    await startSession($)
    expect(registered).toEqual([])
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:usage' })
    await ui.redraw()
    expect(await screen(ui)).toContain('Lokales Modell aus')
    await ui.unmount()
  })

  test('eingeschaltet meldet es ein Werkzeug an, fragt den Server im OpenAI-Format und zählt mit', localOn, async ($, on) => {
    engine(on)
    const registered: { name?: string }[] = []
    on('tool.register', (_, e) => {
      registered.push(e as { name?: string })
      return { value: { tool: 'mcp__agent-tree__local_model' } } as never
    })
    const asked: { url: string; body: string }[] = []
    on('http.fetch', (_, e) => {
      const r = e as { url: string; init?: { body?: string } }
      asked.push({ url: r.url, body: r.init?.body ?? '' })
      return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ choices: [{ message: { content: 'kurz gefasst' } }], usage: { total_tokens: 1200 } }) } } as never
    })
    await startSession($)
    expect(registered.map(r => r.name)).toEqual(['local_model'])
    const answered = (await $.tool.call({ tool: 'mcp__agent-tree__local_model', prompt: 'Fasse zusammen: lang', system: 'kurz' } as never)) as { result?: unknown }
    expect(answered.result).toBe('kurz gefasst')
    const completion = asked.find(a => a.url.endsWith('/chat/completions'))
    expect(completion?.url).toBe('http://127.0.0.1:11434/v1/chat/completions')
    expect(JSON.parse(completion?.body ?? '{}')).toEqual({ model: 'qwen2.5-coder:7b', stream: false, messages: [{ role: 'system', content: 'kurz' }, { role: 'user', content: 'Fasse zusammen: lang' }] })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:usage' })
    await ui.redraw()
    const text = await screen(ui)
    for (const word of ['Lokales Modell', 'qwen2.5-coder:7b', 'auf Zuruf', '1 Aufruf', '1,2k Tokens']) expect(text).toContain(word)
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    const log = await screen(ui)
    expect(log).toContain('Lokales Modell qwen2.5-coder:7b: 1200 Tokens')
    expect(log).toContain('Fasse zusammen: lang')
    await ui.press({ key: 'logfilter:local' })
    await ui.redraw()
    expect(await screen(ui)).toContain('Lokales Modell qwen2.5-coder:7b')
    await ui.unmount()
  })

  test('der Kasten im Baum: einrichten, suchen, Modell wählen, Stufe wechseln, gespeichert', de, async ($, on) => {
    const t = engine(on)
    const registered: { name?: string; description?: string }[] = []
    on('tool.register', (_, e) => {
      registered.push(e as { name?: string; description?: string })
      return { value: { tool: 'mcp__agent-tree__local_model' } } as never
    })
    on('http.fetch', (_, e) => {
      const url = (e as { url: string }).url
      if (url === 'http://127.0.0.1:11434/v1/models') return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ data: [{ id: 'gemma3:12b' }, { id: 'qwen2.5:3b' }] }) } } as never
      throw new Error('kein Server')
    })
    const copied: string[] = []
    on('ui.copy', (_, e) => {
      copied.push((e as { text: string }).text)
      return { value: undefined } as never
    })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.redraw()
    expect(await screen(ui)).toContain('Lokales Modell einrichten')
    await ui.press({ key: 'local:open' })
    await ui.redraw()
    let text = await screen(ui)
    expect(text).toContain('2 Modelle gefunden, wählen')
    expect(text).toContain('qwen2.5:3b · 127.0.0.1:11434')
    await ui.press({ key: 'localpick:1' })
    await ui.redraw()
    text = await screen(ui)
    expect(text).toContain('qwen2.5:3b ▾')
    expect(text).toContain('auf Zuruf ▾')
    expect(t.stored.localChoice).toEqual({ model: 'qwen2.5:3b', url: 'http://127.0.0.1:11434/v1', mode: 'ask' })
    expect(registered.at(-1)?.description).toContain('only when the user asks')
    await ui.press({ key: 'local:mode' })
    await ui.redraw()
    expect(await screen(ui)).toContain('selbstständig ▾')
    expect(registered.at(-1)?.description).toContain('Prefer it for longer texts')
    await ui.press({ key: 'local:mode' })
    await ui.redraw()
    expect(await screen(ui)).toContain('aus ▾')
    expect(registered.at(-1)?.description).toContain('Do not call this tool')
    await ui.press({ key: 'local:open' })
    await ui.press({ key: 'local:guide' })
    await ui.press({ key: 'local:setup' })
    expect(copied).toEqual(['https://github.com/MikeGT4/agent-tree/blob/main/docs/LOCAL.md'])
    expect(t.fills.at(-1)).toContain('Ollama')
    await ui.unmount()
  })

  test('ohne Server: Hinweis, Anleitung und Einrichten lassen', de, async ($, on) => {
    engine(on)
    on('http.fetch', () => {
      throw new Error('kein Server')
    })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'local:open' })
    await ui.redraw()
    const text = await screen(ui)
    for (const word of ['kein lokaler Server gefunden', 'erneut suchen', 'Anleitung', 'Einrichten lassen']) expect(text).toContain(word)
    await ui.unmount()
  })

  for (const [columns, rows] of [[56, 43], [67, 58], [90, 58]] as const) {
    test(`bei wenig Höhe und laufenden Agenten bleibt der geöffnete Kasten stehen (${columns} × ${rows})`, de, async ($, on) => {
      engine(on)
      on('http.fetch', () => {
        throw new Error('kein Server')
      })
      await agents($, 3)
      const ui = await $.ui.mount(pane(columns, rows))
      expect(has(await screen(ui), 'local:open')).toBe(true)
      await ui.press({ key: 'local:open' })
      await ui.redraw()
      const text = await screen(ui)
      expect(has(text, 'local:setup')).toBe(true)
      await ui.unmount()
    })
  }

  test('antwortet der Server nicht, bekommt Claude eine Absage mit der Bitte, es selbst zu tun', localOn, async ($, on) => {
    engine(on)
    on('tool.register', () => ({ value: { tool: 'mcp__agent-tree__local_model' } }) as never)
    on('http.fetch', () => ({ value: { status: 500, ok: false, headers: {}, text: '' } }) as never)
    await startSession($)
    const answered = (await $.tool.call({ tool: 'mcp__agent-tree__local_model', prompt: 'x' } as never)) as { deny?: string; isError?: boolean; text?: string }
    expect(JSON.stringify(answered)).toContain('HTTP 500')
  })
})

describe('Tab Hilfe', () => {
  test('zeigt Tasten, Zeichen, Befehle und den Weg zur Anleitung', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"help-view"')
    for (const word of ['Tasten', 's: stoppen', 'a: Aussehen', 'Größe', 'Linke Kante der Leiste mit der Maus ziehen', 'Zeichen', 'läuft', 'fehlgeschlagen', 'Befehle', '/agent-tree', 'Anleitung', 'tree/main/docs']) expect(text).toContain(word)
    await ui.unmount()
  })

  test('auf Englisch führt der Weg zur englischen Anleitung', { options: { language: 'en', intro: false, tips: false } }, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    const text = await screen(ui)
    for (const word of ['Keys', 'Size', 'Drag the left edge of the pane with the mouse', 'Signs', 'Commands', 'Guide', 'tree/main/docs']) expect(text).toContain(word)
    await ui.unmount()
  })

  test('eingebettet fehlt der Hinweis auf das Ziehen der Kante', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const docked = pane(90)
    const ui = await $.ui.mount({ ...docked, props: { ...docked.props, placement: 'inline' } } as never)
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"help-view"')
    expect(text).not.toContain('"key":"help-size"')
    expect(text).not.toContain('Kante der Leiste')
    await ui.unmount()
  })
})

describe('Tab Berichte', () => {
  const longTask = 'Lies den Code und liste jede Stelle auf, an der Sitzungen geprüft werden. '.repeat(4).trim()
  const longAnswer = `Zeile eins der Antwort.\n\n${'Ein langer Absatz. '.repeat(30).trim()}`
  const history = (on: On, answer: () => string = () => longAnswer) =>
    on('session.messages', (_, e) =>
      ({
        value: [
          { role: 'user', text: `${longTask} (${String((e as { agentId?: string }).agentId)})`, toolUses: [] },
          { role: 'assistant', text: `${answer()} (${String((e as { agentId?: string }).agentId)})`, toolUses: [] },
        ],
      }) as never,
    )

  test('zeigt Aufgabe und Antwort im Volltext, nicht nur den Auszug', de, async ($, on) => {
    engine(on)
    history(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"reports-view"')
    expect(text).toContain(`${longTask} (sub-1)`)
    expect(text).toContain(`${'Ein langer Absatz. '.repeat(30).trim()} (sub-1)`)
    await ui.unmount()
  })

  test('ein Klick auf einen anderen Agenten zeigt dessen Bericht', de, async ($, on) => {
    engine(on)
    history(on)
    await twoAgents($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    expect(await screen(ui)).toContain('(sub-2)')
    await ui.press({ key: 'report:sub-1' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('Ein langer Absatz. (sub-1)')
    expect(text).not.toContain('Ein langer Absatz. (sub-2)')
    await ui.unmount()
  })

  test('nach dem Ende des Agenten steht die endgültige Antwort da', de, async ($, on) => {
    engine(on)
    let answer = 'Zwischenstand'
    history(on, () => answer)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    expect(await screen(ui)).toContain('Zwischenstand (sub-1)')
    answer = 'Endergebnis'
    await $.turn.complete({ answer: 'Endergebnis', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    expect(await screen(ui)).toContain('Endergebnis (sub-1)')
    await ui.unmount()
  })

  test('die übergebene Antwort zählt, nicht der letzte Zwischentext', de, async ($, on) => {
    engine(on)
    on('session.messages', () =>
      ({
        value: [
          { role: 'user', text: 'Auftrag', toolUses: [] },
          { role: 'assistant', text: 'Bevor ich abgebe, prüfe ich noch etwas.', toolUses: [{ tool_use_id: 'u1', tool: 'SubagentHandback', input: { message: 'Endbericht mit drei Punkten' } }] },
        ],
      }) as never,
    )
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('Endbericht mit drei Punkten')
    expect(text).not.toContain('Bevor ich abgebe')
    await ui.unmount()
  })

  test('ist der Verlauf nicht lesbar, steht das dort', de, async ($, on) => {
    engine(on)
    on('session.messages', () => {
      throw new Error('kein Zugriff')
    })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/nicht lesbar/)
    await ui.unmount()
  })

  test('ohne Unteragenten steht dort, dass es noch keine gibt', de, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    expect(await screen(ui)).toMatch(/noch keine Unteragenten/)
    await ui.unmount()
  })

  test('die Reiterchen zeigen, welcher Agent fertig ist und welcher läuft', de, async ($, on) => {
    engine(on)
    history(on)
    await twoAgents($)
    await $.turn.complete({ answer: 'Fertig 1', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain(' ● Agent A ')
    expect(text).toContain(' ◐ Agent B ')
    expect(text).not.toContain('● general-purpose')
    await ui.unmount()
  })

  test('endet ein anderer Agent, bleibt der gezeigte Bericht im Volltext stehen', de, async ($, on) => {
    engine(on)
    history(on)
    await twoAgents($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    expect(await screen(ui)).toContain('Ein langer Absatz. (sub-2)')
    await $.turn.complete({ answer: 'Fertig 1', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('Ein langer Absatz. (sub-2)')
    expect(text).not.toMatch(/lädt/)
    await ui.unmount()
  })

  test('startet ein neuer Agent, bleibt der gezeigte Bericht im Volltext stehen', de, async ($, on) => {
    engine(on)
    history(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    await $.agent.spawn({ prompt: 'B', description: 'Agent B', subagentType: 'general-purpose' } as never)
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('Ein langer Absatz. (sub-1)')
    expect(text).not.toMatch(/lädt/)
    await ui.unmount()
  })

  test('wird der gezeigte Agent entfernt, lädt der Tab den Bericht des nächsten', { options: { language: 'de', intro: false, maxAgents: 5 } }, async ($, on) => {
    engine(on)
    history(on)
    await startSession($)
    await $.turn.start({ text: 'Bau das', turnId: 't1' })
    await step($)
    for (const name of ['A', 'B', 'C', 'D', 'E']) await $.agent.spawn({ prompt: name, description: `Agent ${name}`, subagentType: 'general-purpose' } as never)
    await $.turn.complete({ answer: 'A fertig', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    expect(await screen(ui)).toContain('Ein langer Absatz. (sub-1)')
    await $.agent.spawn({ prompt: 'F', description: 'Agent F', subagentType: 'general-purpose' } as never)
    await ui.redraw()
    const text = await screen(ui)
    expect(text).not.toContain('(sub-1)')
    expect(text).toContain('Ein langer Absatz. (sub-6)')
    expect(text).not.toMatch(/lädt/)
    await ui.unmount()
  })

  test('antwortet eine ältere Anfrage zuletzt, bleibt die neuere Antwort stehen', de, async ($, on) => {
    engine(on)
    let release: () => void = () => undefined
    const hold = new Promise<void>(resolve => {
      release = resolve
    })
    let calls = 0
    on('session.messages', async () => {
      calls += 1
      const mine = calls
      if (mine === 1) await hold
      return { value: [{ role: 'user', text: 'Auftrag', toolUses: [] }, { role: 'assistant', text: mine === 1 ? 'ALTER Zwischenstand' : 'NEUE Endantwort', toolUses: [] }] } as never
    })
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    for (let i = 0; i < 40; i++) await Promise.resolve()
    await $.turn.complete({ answer: 'Endantwort', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    await ui.redraw()
    expect(await screen(ui)).toContain('NEUE Endantwort')
    release()
    for (let i = 0; i < 40; i++) await Promise.resolve()
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('NEUE Endantwort')
    expect(text).not.toContain('ALTER Zwischenstand')
    await ui.unmount()
  })

  test('nach einer abgelehnten Übergabe zählt der neuere Text', de, async ($, on) => {
    engine(on)
    on('session.messages', () =>
      ({
        value: [
          { role: 'user', text: 'Auftrag', toolUses: [] },
          { role: 'assistant', text: 'Ich bin fertig.', toolUses: [{ tool_use_id: 'u1', tool: 'SubagentHandback', input: { message: 'ENTWURF: fertig' } }] },
          { role: 'user', text: '', toolUses: [] },
          { role: 'assistant', text: 'NEUER TEXT nach der Korrektur', toolUses: [{ tool_use_id: 'u2', tool: 'Read', input: { file_path: '/x' } }] },
        ],
      }) as never,
    )
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:reports' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('NEUER TEXT nach der Korrektur')
    expect(text).not.toContain('ENTWURF')
    await ui.unmount()
  })
})

describe('Vom Detailkasten zum ganzen Bericht', () => {
  test('der Knopf im Detailkasten öffnet den Tab Berichte für diesen Agenten', de, async ($, on) => {
    engine(on)
    on('session.messages', () => ({ value: [{ role: 'user', text: 'Voller Auftrag', toolUses: [] }, { role: 'assistant', text: 'Volle Antwort', toolUses: [] }] }) as never)
    await twoAgents($)
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    expect((await ui.find({ key: 'report:sub-1' }))?.props.label).toBe('ganzer Bericht ›')
    await ui.press({ key: 'report:sub-1' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"reports-view"')
    expect(text).toContain('Agent A')
    expect(text).toContain('Volle Antwort')
    await ui.unmount()
  })
})


describe('Stopp beim Wecken und Senden an endende Agenten', () => {
  const done1 = { answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' } as const
  async function detail($: Engine) {
    const ui = await $.ui.mount(pane(90))
    await steer(ui, 'detail:sub-1')
    await ui.redraw()
    return ui
  }

  test('nach dem Stopp beim Wecken läuft der Agent auf eine neue Nachricht wieder', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(done1)
    await $.turn.start({ text: 'Nimm b.ts', turnId: 't2', agentId: 'sub-1' } as never)
    const woken = await step($, { agentId: 'sub-1' })
    expect(woken.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    await $.turn.complete({ ...done1, answer: woken.answer })
    await sayCommand($, 'Jetzt c.ts')
    await $.turn.start({ text: 'Jetzt c.ts', turnId: 't3', agentId: 'sub-1' } as never)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('der Stopp beim Wecken übersteht /agent-tree clear', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(done1)
    await ui.unmount()
    await $.command.run({ command: 'agent-tree', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
    const before = seen.stepModels.length
    const woken = await step($, { agentId: 'sub-1' })
    expect(woken.answer).toMatch(/Im Agent Tree vom Nutzer gestoppt/)
    expect(seen.stepModels.length - before).toBe(0)
  })

  test('nach einem zugestellten Stopp läuft der Agent auf eine neue Nachricht wieder', de, async ($, on) => {
    const seen = engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await sayCommand($, 'Nimm b.ts')
    await steer(ui, 'halt:sub-1')
    const stopped = await step($, { agentId: 'sub-1' })
    await $.turn.complete({ ...done1, answer: stopped.answer })
    await sayCommand($, 'Jetzt c.ts')
    await $.turn.start({ text: 'Jetzt c.ts', turnId: 't3', agentId: 'sub-1' } as never)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('abgebrochen während des Sendens: nicht zugestellt', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    refuse.onSend = () => $.turn.complete({ ...done1, answer: '', isAborted: true })
    await sayCommand($, 'Nimm b.ts')
    refuse.onSend = undefined
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: nicht zugestellt/)
    await ui.unmount()
  })

  test('gescheitert während des Sendens: Statuszeile', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    refuse.onSend = () => $.turn.complete({ ...done1, answer: '', reason: 'error' })
    await sayCommand($, 'Nimm b.ts')
    refuse.onSend = undefined
    expect(seen.status.some(line => /Korrektur nicht zugestellt/.test(line))).toBe(true)
  })

  test('gescheitert während des Sendens: Antwort des Befehls', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    refuse.onSend = () => $.turn.complete({ ...done1, answer: '', reason: 'error' })
    const reply = await sayCommand($, 'Nimm b.ts')
    refuse.onSend = undefined
    expect(String((reply as { text?: string }).text)).toMatch(/nicht zugestellt/)
  })

  test('erkannter Code Mode steuert nach erneutem Start den Stopp', de, async ($, on) => {
    engine(on, [], { codeMode: false, stepTools: ['REPL'] })
    await oneAgentWithAdvisor($)
    await startSession($)
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    const chunks: unknown[] = []
    await step($, { agentId: 'sub-1', chunks })
    expect(chunks.map(c => (c as { kind: string }).kind)).toEqual(['text', 'stop'])
    await ui.unmount()
  })

  test('eine zugestellte Nachricht an einen gestoppten Agenten gilt als geschickt', de, async ($, on) => {
    engine(on, [], { codeMode: true })
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    const stopped = await step($, { agentId: 'sub-1' })
    await $.turn.complete({ ...done1, answer: stopped.answer })
    await sayCommand($, 'Jetzt c.ts')
    await ui.redraw()
    expect(await screen(ui)).toMatch(/Korrektur: geschickt/)
    await ui.unmount()
  })
})

describe('Gehaltener Stopp: Zeitfenster, Marken und Bereinigung', () => {
  const done1 = { answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' } as const
  const done2 = { ...done1, agentId: 'sub-2' } as const
  async function detail($: Engine, id = 'sub-1') {
    const ui = await $.ui.mount(pane(90))
    await steer(ui, `detail:${id}`)
    await ui.redraw()
    return ui
  }

  test('Weckruf während des Sendens nach überholtem Stopp läuft', de, async ($, on) => {
    const refuse: { onSend?: () => Promise<unknown> } = {}
    const seen = engine(on, [], refuse)
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(done1)
    const before = seen.stepModels.length
    refuse.onSend = () => step($, { agentId: 'sub-1' })
    await sayCommand($, 'Mach weiter')
    refuse.onSend = undefined
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('Nachricht zwischen Abgabe und Ende: Weckruf läuft', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    await sayCommand($, 'Doch weiter')
    await $.turn.complete(done1)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('clear zwischen Abgabe und Ende: Weckruf wird gestoppt', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    await ui.unmount()
    await $.command.run({ command: 'agent-tree', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
    await $.turn.complete(done1)
    const before = seen.stepModels.length
    const woken = await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(0)
  })

  test('Abgabe ohne Korrektur, Schritt vor dem Ende läuft', de, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(1)
    await ui.unmount()
  })

  test('abgelaufene Einträge anderer Agenten werden entfernt', de, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Zweiter.', description: 'Zweiter', subagentType: 'Explore' } as never)
    await step($, { agentId: 'sub-2' })
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(done1)
    await clock.advance(61_000)
    await steer(ui, 'detail:sub-2')
    await ui.redraw()
    await steer(ui, 'halt:sub-2')
    await $.turn.complete(done2)
    const wake = seen.tree().stopWake ?? {}
    expect(Object.keys(wake)).toEqual(['sub-2'])
    await ui.unmount()
  })
  test('nach Ablauf geweckt, normal beendet: ein weiterer Weckruf läuft', de, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    await $.tool.call({ tool: 'SubagentHandback', message: 'OK', agentId: 'sub-1' } as never)
    await $.turn.complete(done1)
    await clock.advance(61_000)
    await $.turn.start({ text: 'Weiter', turnId: 't2', agentId: 'sub-1' } as never)
    const first = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    const ranFirst = seen.stepModels.length - first
    await $.tool.call({ tool: 'SubagentHandback', message: 'Fertig', agentId: 'sub-1' } as never)
    await $.turn.complete({ ...done1, turnId: 't2', answer: 'Fertig' })
    await $.turn.start({ text: 'Noch was', turnId: 't3', agentId: 'sub-1' } as never)
    const second = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect([ranFirst, seen.stepModels.length - second]).toEqual([1, 1])
    await ui.unmount()
  })

  test('genau 60 s nach dem Ende wird der Weckruf noch gestoppt', de, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await detail($)
    await steer(ui, 'halt:sub-1')
    await $.turn.complete(done1)
    await clock.advance(60_000)
    const before = seen.stepModels.length
    await step($, { agentId: 'sub-1' })
    expect(seen.stepModels.length - before).toBe(0)
    await ui.unmount()
  })
})

describe('Verlauf 0.7.11: Untermenü, Aufklappen, Sprung', () => {
  const longQuestion = 'Genau und dann haben wir bei Hilfe siehst du ja die Zeichenerklärung, da ist ja Zeichen läuft, fertig, fehlgeschlagen und gestoppt, ganz am Ende steht ZIELWORT'

  test('die Filter stehen als gerahmte Leiste über der Zeile Sitzungsprotokoll', de, async ($, on) => {
    engine(on)
    await agents($, 1)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"log-filter-top"')
    expect(text).toContain('"key":"log-filter-bottom"')
    expect(text.indexOf('"key":"logfilter:all"')).toBeLessThan(text.indexOf('Sitzungsprotokoll'))
    await ui.unmount()
  })

  test('bei 38 Spalten bleiben die Filter ohne Rahmen bedienbar', de, async ($, on) => {
    engine(on)
    await agents($, 1)
    const ui = await $.ui.mount(pane(38))
    await ui.press({ key: 'tab:log' })
    await ui.press({ key: 'logfilter:agent' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).not.toContain('"key":"log-filter-top"')
    expect(text).toMatch(/gestartet: Agent 1/)
    expect(text).not.toMatch(/Runde 1/)
    await ui.unmount()
  })

  test('die eigene Frage klappt als Kiste auf und wieder zu', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: longQuestion, turnId: 't1' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    expect(await screen(ui)).not.toMatch(/ZIELWORT/)
    await ui.press({ key: 'logopen:1' })
    await ui.redraw()
    const open = await screen(ui)
    expect(open).toContain('"key":"log-question"')
    expect(open).toMatch(/ZIELWORT/)
    await ui.press({ key: 'logopen:1' })
    await ui.redraw()
    expect(await screen(ui)).not.toMatch(/ZIELWORT/)
    await ui.unmount()
  })

  test('die ganze Frage bleibt im Arbeitsspeicher und nicht im Zustand', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    await $.turn.start({ text: longQuestion, turnId: 't1' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.press({ key: 'logopen:1' })
    await ui.redraw()
    expect(JSON.stringify(seen.tree())).not.toMatch(/ZIELWORT/)
    expect(JSON.stringify(seen.storeSets)).not.toMatch(/ZIELWORT/)
    await ui.unmount()
  })

  test('nach /clear klappt keine fremde Frage auf', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: longQuestion, turnId: 't1' })
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    await startSession($)
    await $.turn.start({ text: 'Neue Frage', turnId: 't2' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    const keys = [...(await screen(ui)).matchAll(/"key":"(logopen:\d+)"/g)].map(m => m[1] ?? '')
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) await ui.press({ key })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).not.toMatch(/ZIELWORT/)
    expect(text).toMatch(/Neue Frage/)
    await ui.unmount()
  })

  test('eine klickbare Zeile bleibt mit ihrem Zeichen in einer Zeile', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.turn.start({ text: longQuestion, turnId: 't1' })
    const ui = await $.ui.mount(pane(72))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    const label = (await ui.find({ key: 'logopen:1' }))?.props.label as string
    expect(label.endsWith('›')).toBe(true)
    expect([...label].length).toBeLessThanOrEqual(72)
    await ui.unmount()
  })

  test('unter Haupt sind die 20 neuesten Fragen klickbar, auch zwischen anderen Einträgen', de, async ($, on) => {
    engine(on)
    await startSession($)
    for (let i = 1; i <= 30; i++) {
      await $.turn.start({ text: `Frage ${i}`, turnId: `t${i}` })
      await $.turn.complete({ answer: 'OK', durationMs: 100, isAborted: false, turnId: `t${i}`, reason: 'answer' })
    }
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.press({ key: 'logfilter:main' })
    await ui.redraw()
    const keys = [...(await screen(ui)).matchAll(/"key":"logopen:(\d+)"/g)].map(m => Number(m[1]))
    expect(keys.length).toBe(20)
    expect(Math.max(...keys)).toBe(30)
    expect(Math.min(...keys)).toBe(11)
    await ui.unmount()
  })

  test('ein Eintrag eines Agenten springt zu seinem Bericht', de, async ($, on) => {
    engine(on)
    await agents($, 2)
    await $.turn.complete({ answer: 'Antwort von eins', durationMs: 900, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    const text = await screen(ui)
    const key = text.match(/"key":"(logjump:sub-1:[^"]+)"/)?.[1]
    expect(key).toBeDefined()
    await ui.press({ key: key ?? '' })
    await ui.redraw()
    const shown = await screen(ui)
    expect(shown).toContain('"key":"reports-view"')
    expect(shown).toMatch(/Agent 1/)
    await ui.unmount()
  })

  test('ein Hinweis sagt, was der Klick auf eine Zeile tut, nur wenn eine klickbar ist', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    expect(await screen(ui)).toContain('Zeile mit › anklicken: deine Frage oder den Bericht zeigen')
    await ui.press({ key: 'logfilter:advisor' })
    await ui.redraw()
    expect(await screen(ui)).not.toContain('Zeile mit › anklicken')
    await ui.unmount()
  })

  test('Einträge der Sitzung und des Beraters sind nicht klickbar', de, async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.press({ key: 'logfilter:advisor' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).not.toMatch(/"key":"logjump:/)
    expect(text).not.toMatch(/"key":"logopen:/)
    await ui.unmount()
  })

  test('der gewählte Filter wird gespeichert', de, async ($, on) => {
    const seen = engine(on)
    await agents($, 1)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.press({ key: 'logfilter:agent' })
    await ui.redraw()
    expect(seen.storeSets).toContainEqual({ key: 'logFilter', value: 'agent' })
    await ui.press({ key: 'logfilter:all' })
    await ui.redraw()
    expect(seen.storeSets).toContainEqual({ key: 'logFilter', value: null })
    await ui.unmount()
  })

  test('der gespeicherte Filter gilt in der nächsten Sitzung', de, async ($, on) => {
    engine(on, [], {}, { logFilter: 'agent' })
    await agents($, 1)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toMatch(/gestartet: Agent 1/)
    expect(text).not.toMatch(/Runde 1/)
    await ui.unmount()
  })

  test('der Filter bleibt nach /clear', de, async ($, on) => {
    engine(on)
    await agents($, 1)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:log' })
    await ui.press({ key: 'logfilter:agent' })
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    await startSession($)
    await $.turn.start({ text: 'Nach dem Leeren', turnId: 't2' })
    await ui.redraw()
    const text = await screen(ui)
    expect(text).toContain('"key":"log-view"')
    expect(text).not.toMatch(/Nach dem Leeren/)
    await ui.unmount()
  })
})

describe('Farben 0.7.11: Zeichen und Verbrauch', () => {
  test('die Zeichenerklärung trägt die Farben des Baums', de, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'tab:help' })
    await ui.redraw()
    const texts = await ui.findAll({ type: 'Text' })
    const colorOf = (pattern: RegExp) => texts.find(f => pattern.test(f.text))?.props.color
    const p = PALETTES.original
    expect(colorOf(/^◐ läuft$/)).toBe(p.agent)
    expect(colorOf(/^● fertig$/)).toBe(p.done)
    expect(colorOf(/^✗ fehlgeschlagen$/)).toBe(p.failed)
    expect(colorOf(/^○ gestoppt$/)).toBe(p.dim)
    await ui.unmount()
  })

  test('der Verbrauch ist grün, gelb und ab 80 % rot', de, async ($, on) => {
    engine(on)
    await startSession($)
    await $.session.measure({
      context: { window: 200000, tokens: 50000, percent: 25 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 20 }, { kind: 'seven_day', percentUsed: 64 }],
      cost: { usd: 1 },
      changed: ['rateLimits'],
    } as never)
    const ui = await $.ui.mount(pane(90))
    const texts = await ui.findAll({ type: 'Text' })
    const colorOf = (pattern: RegExp) => texts.find(f => pattern.test(f.text))?.props.color
    const p = PALETTES.original
    expect(colorOf(/^5 h /)).toBe(p.done)
    expect(colorOf(/Woche \S+ 64 %/)).toBe(p.warn)
    await $.session.measure({
      context: { window: 200000, tokens: 50000, percent: 25 },
      rateLimits: [{ kind: 'seven_day', percentUsed: 85 }],
      cost: { usd: 1 },
      changed: ['rateLimits'],
    } as never)
    await ui.redraw()
    const later = await ui.findAll({ type: 'Text' })
    expect(later.find(f => /Woche \S+ 85 %/.test(f.text))?.props.color).toBe(p.failed)
    await ui.unmount()
  })
})

describe('Tipps 0.7.12', () => {
  const tips = { options: { language: 'de', intro: false } }
  const helpText = async (ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }) =>
    (await ui.findAll({ type: 'Text' })).map(f => f.text).find(text => /^(Tipp?: |ctrl\+x tab)/.test(text)) ?? ''

  test('ab Werk steht unten ein Tipp, und die Reihe merkt sich, wo sie steht', tips, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await helpText(ui)).toBe('Tipp: Im Verlauf › anklicken: deine Frage oder der Bericht')
    expect(seen.storeSets).toContainEqual({ key: 'tip', value: 1 })
    await ui.unmount()
  })

  test('die nächste Sitzung zeigt den nächsten Tipp', tips, async ($, on) => {
    const seen = engine(on, [], {}, { tip: 1 })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await helpText(ui)).toBe('Tipp: Kasten anklicken: stoppen, schreiben, Modell, Denkstufe')
    expect(seen.storeSets).toContainEqual({ key: 'tip', value: 2 })
    await ui.unmount()
  })

  test('nach dem letzten Tipp beginnt die Reihe von vorn', tips, async ($, on) => {
    engine(on, [], {}, { tip: 6 })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await helpText(ui)).toBe('Tipp: Im Verlauf › anklicken: deine Frage oder der Bericht')
    await ui.unmount()
  })

  test('ein kaputter gespeicherter Wert beginnt beim ersten Tipp', tips, async ($, on) => {
    engine(on, [], {}, { tip: 'quatsch' })
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await helpText(ui)).toBe('Tipp: Im Verlauf › anklicken: deine Frage oder der Bericht')
    await ui.unmount()
  })

  test('ohne Tipps steht die Tastenzeile da', de, async ($, on) => {
    const seen = engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await helpText(ui)).toMatch(/^ctrl\+x tab: Leiste/)
    expect(seen.storeSets.some(s => s.key === 'tip')).toBe(false)
    await ui.unmount()
  })

  test('ohne Bedienung kein Tipp', tips, async ($, on) => {
    const seen = engine(on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
    const ui = await $.ui.mount(pane(90))
    expect(await helpText(ui)).toMatch(/^ctrl\+x tab: Leiste/)
    expect(seen.storeSets.some(s => s.key === 'tip')).toBe(false)
    await ui.unmount()
  })

  test('die Tipps auf Englisch', { options: { language: 'en', intro: false } }, async ($, on) => {
    engine(on)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await helpText(ui)).toBe('Tip: in the Log, click › for your prompt or the report')
    await ui.unmount()
  })
})

describe('Länge der Tipps', () => {
  test('jeder Tipp passt in eine Leiste von 64 Spalten', () => {
    for (const lang of ['de', 'en']) for (const tip of wordsFor(lang).tips) expect([...tip].length).toBeLessThanOrEqual(64)
  })
})
