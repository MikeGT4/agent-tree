// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const usage = { input_tokens: 2000, output_tokens: 40, cache_read_input_tokens: 30000, cache_creation_input_tokens: 0 }

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
  on('session.measure', () => ({}) as never)
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
      usage: { ...usage, model: e.model },
      ...(e.messageCount === 99
        ? { serverToolUses: [{ id: 'adv-1', name: 'advisor', input: {}, startedAt: 1000, endedAt: 4000 }] }
        : {}),
    }
  })
  return { status, spawnModels, stepModels }
}

async function step($: Engine, options: { agentId?: string; advisor?: boolean } = {}) {
  const stream = $.turn.step({
    turnId: 't1',
    index: 0,
    model: options.agentId ? 'claude-haiku-4-5-20251001' : 'claude-opus-5-5',
    effort: options.agentId ? 'medium' : 'high',
    messageCount: options.advisor ? 99 : 3,
    ...(options.agentId ? { agentId: options.agentId } : {}),
  })
  for await (const _ of stream) {
  }
  return stream.result
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
  test('der Befehl öffnet die Leiste und nennt sich', async ($, on) => {
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

  test('beim Öffnen erscheinen Agenten, die vor dem Laden des Mods gestartet wurden', async ($, on) => {
    engine(on, [{ id: 'early-1', description: 'Vorher gestartet', type: 'Plan', status: 'running' }])
    await startSession($)
    const opened = await $.command.run({
      command: 'agent-tree',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 200 },
    })
    expect(opened.text).toContain('1 Agenten bisher')
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ type: 'Text', text: /Vorher gestartet/ })).toBeDefined()
    await ui.unmount()
  })

  test('die Leiste zeigt Hauptsitzung, Unteragent, Berater und Protokoll', async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ type: 'Text', text: /Hauptsitzung/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Opus 5\.5/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Code lesen/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Read auth\.ts/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Aufrufe 1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Sitzungsprotokoll/ })).toBeDefined()
    expect(seen.status.at(-1)).toBe('1 läuft · 0 fertig · Berater 1×')
    await ui.unmount()
  })

  test('ein verschachtelter Unteragent nennt seinen Auftraggeber, auf Terminal und Desktop', async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.agent.spawn({ prompt: 'Prüfe.', description: 'Unterauftrag', subagentType: 'general-purpose', parentAgentId: 'sub-1' } as never)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...pane(90), surface })
      expect(await ui.find({ type: 'Text', text: /↳ unter Explore/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('Modellwahl für neue Unteragenten setzt das Modell beim Start, ein eigenes Modell des Aufrufs bleibt', async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:new' })
    await ui.redraw()
    expect(await ui.find({ type: 'Text', text: /Modell für neue Unteragenten/ })).toBeDefined()
    await ui.press({ key: 'choose:opus' })
    await ui.unmount()
    await $.agent.spawn({ prompt: 'P.', description: 'Neu', subagentType: 'Plan' })
    await $.agent.spawn({ prompt: 'Q.', description: 'Eigen', subagentType: 'Plan', model: 'haiku' })
    expect(seen.spawnModels.slice(-2)).toEqual(['opus', 'haiku'])
  })

  test('Modellwahl für einen laufenden Agenten setzt seine nächsten Schritte um', async ($, on) => {
    const seen = engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90))
    await ui.press({ key: 'pick:sub-1' })
    await ui.redraw()
    expect(await ui.find({ type: 'Text', text: /Modell für Explore · Code lesen/ })).toBeDefined()
    await ui.press({ key: 'choose:sonnet' })
    await ui.unmount()
    await step($, { agentId: 'sub-1' })
    await step($)
    expect(seen.stepModels.slice(-2)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5'])
  })

  test('eine schmale Leiste stapelt und bleibt gültig', async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(52))
    expect(await ui.find({ type: 'Text', text: /Berater/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Code lesen/ })).toBeDefined()
    await ui.unmount()
  })

  test('bei 38 Spalten stehen Unteragenten als kompakte Zeilen', async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(38))
    expect(await ui.find({ type: 'Text', text: /◐ läuft · Explore · Code lesen/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Sitzungsprotokoll/ })).toBeDefined()
    await ui.unmount()
  })

  test('25 Agenten eines Workflows erscheinen als ein Kasten', async ($, on) => {
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
    expect(await ui.find({ type: 'Text', text: /Workflow · 25/ })).toBeDefined()
    await ui.unmount()
  })

  test('bei wenig Höhe bleiben laufende Kästen und das Protokoll, der Rest wird gezählt', async ($, on) => {
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
    expect(await ui.find({ type: 'Text', text: /Prüfung 6/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Prüfung 1/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /\+3 weitere beendet/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Sitzungsprotokoll/ })).toBeDefined()
    await ui.unmount()
  })

  test('bei 30 Zeilen Höhe stehen Unteragenten als Zeilen und das Protokoll bleibt', async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    const ui = await $.ui.mount(pane(90, 30))
    expect(await ui.find({ type: 'Text', text: /◐ läuft · Explore · Code lesen/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Sitzungsprotokoll/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /schreibt nie/ })).toBeUndefined()
    await ui.unmount()
  })

  test('Agenten früherer Runden erscheinen als eine Zeile, die neuen als Kästen', async ($, on) => {
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
    expect(await ui.find({ type: 'Text', text: /aus früheren Runden: 2 Agenten/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Neu$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Alt eins$/ })).toBeUndefined()
    await ui.unmount()
  })

  test('/clear beginnt den Baum neu', async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ type: 'Text', text: /Code lesen/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /noch keine Unteragenten/ })).toBeDefined()
    await ui.unmount()
  })

  test('ein neuer Start des Moduls behält den Baum', async ($, on) => {
    engine(on)
    await oneAgentWithAdvisor($)
    await startSession($)
    const ui = await $.ui.mount(pane(90))
    expect(await ui.find({ type: 'Text', text: /Code lesen/ })).toBeDefined()
    await ui.unmount()
  })
})
