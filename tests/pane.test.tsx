// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const usage = { input_tokens: 2000, output_tokens: 40, cache_read_input_tokens: 30000, cache_creation_input_tokens: 0 }
const answering = (model: string) => ({ sonnet: 'claude-sonnet-5-5' } as Record<string, string>)[model] ?? model

function engine(on: On, listed: unknown[] = []) {
  const status: string[] = []
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
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
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
  return { status, spawnModels, stepModels }
}

async function step($: Engine, options: { agentId?: string; advisor?: boolean; chunks?: unknown[] } = {}) {
  const stream = $.turn.step({
    turnId: 't1',
    index: 0,
    model: options.agentId ? 'claude-haiku-4-5-20251001' : 'claude-opus-5-5',
    effort: options.agentId ? 'medium' : 'high',
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
  await $.agent.spawn({ prompt: 'Lies den Code.', description: 'Code lesen', subagentType: 'Explore' })
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
    expect(seen.status.at(-1)).toBe('1 läuft · 0 fertig · Berater 1×')
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
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' })
    await $.agent.spawn({ prompt: 'Q.', description: 'Eigen', subagentType: 'Plan', model: 'haiku' })
    expect(seen.spawnModels.slice(-2)).toEqual(['opus', 'haiku'])
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
    await $.agent.spawn({ prompt: 'Plane.', description: 'Plan bauen', subagentType: 'Plan' })
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
      await $.agent.spawn({ prompt: 'Prüfe.', description: `Prüfung ${i}`, subagentType: 'general-purpose' })
    }
    for (let i = 1; i <= 3; i++) {
      await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId: `sub-${i}`, reason: 'answer' })
    }
    const ui = await $.ui.mount(pane(90, 40))
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
    await $.agent.spawn({ prompt: 'A.', description: 'Alt eins', subagentType: 'Explore' })
    await $.agent.spawn({ prompt: 'B.', description: 'Alt zwei', subagentType: 'Explore' })
    for (const agentId of ['sub-1', 'sub-2']) {
      await $.turn.complete({ answer: 'OK', durationMs: 900, isAborted: false, turnId: 't1', agentId, reason: 'answer' })
    }
    await $.turn.complete({ answer: 'fertig', durationMs: 900, isAborted: false, turnId: 't1', reason: 'answer' })
    await $.turn.start({ text: 'Zweite Runde', turnId: 't2' })
    await $.agent.spawn({ prompt: 'C.', description: 'Neu', subagentType: 'Plan' })
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
    await $.agent.spawn({ prompt: 'A.', description: 'Hintergrund', subagentType: 'Explore' })
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

  test('englische Beschriftung, wenn die Sprache Englisch ist', { options: { language: 'en' } }, async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    const text = await screen(ui)
    for (const word of [/Main session/, /Sub-agents/, /Session log/, /Calls 1/, /Model: Default ▾/, /to sub-agents/]) expect(text).toMatch(word)
    expect(text).not.toMatch(/Hauptsitzung|Unteragenten|Sitzungsprotokoll|Aufrufe/)
    expect(seen.status.at(-1)).toBe('1 running · 0 done · advisor 1×')
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
    expect(seen.status.at(-1)).toBe('1 läuft · 0 fertig · Berater 1× · Kontext 25 % · 1,50 $')
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
    await $.agent.spawn({ prompt: 'P.', description: 'Messung', subagentType: 'performance-optimizer-extra' })
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
