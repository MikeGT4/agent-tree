// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentTreeLook, AgentTreeState } from '../types'
import { DEFAULT_LOOK, LOOK_OPTIONS, lookFrom } from './looks.ts'
import {
  adopted,
  choicesOf,
  chosen,
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
  isStopping,
  lookOpened,
  measured,
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
  toolLabel,
  toolRan,
  trimmed,
  turnStarted,
  typeLabel,
  wasStopSent,
  withAdvisorModel,
} from './model.ts'
import { drawTree, inputKey, pressKey, statusText } from './view.tsx'
import type { TreeActions } from './view.tsx'
import { lookChoice, lookOptionLabel, resolveLang, wordsFor } from './words.ts'
import type { Lang } from './words.ts'

const PANE = 'agent-tree'
const COMMAND = 'agent-tree'
const TITLE = 'Agent Tree'
const SHAPE = 'agent-tree-1'
const LOOK_SHAPE = 'agent-tree-look-1'
const LOOK_KEY = 'look'
const INLINE_ROWS = 40
const FRAME_MS = 250
const HANDBACK = 'SubagentHandback'

const tree = atom({ plugin: 'agent-tree', key: 'tree' } as const, createTree(0), { shape: SHAPE })
const frame = atom({ plugin: 'agent-tree', key: 'frame' } as const, 0)
const appearance = atom({ plugin: 'agent-tree', key: 'look' } as const, DEFAULT_LOOK, { shape: LOOK_SHAPE })

let ticker: Timer | undefined
let animate = true
let lang: Lang = 'en'
let stoppingIds = new Set<string>()
let stopSentIds = new Set<string>()

function busy(s: AgentTreeState): boolean {
  return counts(s).running > 0 || phaseOf(s) === 'reviewing'
}

function keepTicking($: EngineInterface, s: AgentTreeState): void {
  if (animate && busy(s)) {
    if (ticker) return
    try {
      ticker = $.clock.every(FRAME_MS, () => {
        void update($, frame, n => (n + 1) % 1_000_000).catch(() => undefined)
      })
    } catch {
      ticker = undefined
    }
    return
  }
  ticker?.cancel()
  ticker = undefined
}

function paneColumns(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 90
  return Math.min(140, Math.max(40, n))
}

function agentLimit(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 30
  return Math.min(200, Math.max(5, n))
}

function handbackId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'toolu_01'
  for (let i = 0; i < 22; i++) id += letters[Math.floor(Math.random() * letters.length)]
  return id
}

async function clock($: EngineInterface): Promise<number> {
  return $.clock.now().catch(() => Date.now())
}

async function change($: EngineInterface, apply: (s: AgentTreeState) => AgentTreeState): Promise<AgentTreeState> {
  const next = await update($, tree, apply)
  stoppingIds = new Set(next.stopping ?? [])
  stopSentIds = new Set(next.stopSent ?? [])
  $.ui.status(statusText(next, lang))
  keepTicking($, next)
  return next
}

async function restyle($: EngineInterface, apply: (look: AgentTreeLook) => AgentTreeLook): Promise<AgentTreeLook> {
  const next = await update($, appearance, look => lookFrom(apply(look)))
  await $.store.set(LOOK_KEY, next).catch(() => undefined)
  return next
}

async function catchUp($: EngineInterface, now: number, keep: number): Promise<void> {
  const list = await $.agent.list().catch(() => [])
  await change($, s => trimmed(synced(adopted(s, list, now), list, now), keep))
}

type Found = { task?: string; answer?: string; denied?: boolean }

function summarize(rows: unknown): Found {
  if (!Array.isArray(rows)) return { denied: true }
  const messages = rows.filter(
    (m): m is { role: string; text: string } => typeof m === 'object' && m !== null && typeof m.text === 'string',
  )
  const task = messages.find(m => m.role === 'user' && m.text.trim() !== '')?.text
  const answer = [...messages].reverse().find(m => m.role === 'assistant' && m.text.trim() !== '')?.text
  return { task, answer }
}

async function openDetail($: EngineInterface, agentId: string): Promise<void> {
  const s = await change($, t => detailOpened(t, agentId))
  if (s.detail?.agentId !== agentId || s.detail.state !== 'loading') return
  const rows = await $.session.messages({ agentId }).catch(() => undefined)
  await change($, t => detailLoaded(t, agentId, summarize(rows)))
}

async function appendRow($: EngineInterface, text: string, agentId?: string): Promise<boolean> {
  const row = { message: { type: 'user' as const, content: [{ type: 'text' as const, text }] }, ...(agentId ? { agentId } : {}) }
  return $.session.append(row).then(
    result => !(result as { deny?: string }).deny,
    () => false,
  )
}

async function sayTo($: EngineInterface, agentId: string, text: string): Promise<void> {
  if (!text.trim()) return
  const w = wordsFor(lang)
  const node = (await read($, tree)).agents.find(n => n.id === agentId)
  if (!node) {
    $.ui.status(w.correctionFailedStatus)
    return
  }
  const now = await clock($)
  const framed = w.correctionFrame(text)
  let via: 'append' | 'send' | undefined
  if (node.status === 'running' && (await appendRow($, framed, agentId))) via = 'append'
  if (!via) {
    const sent = await $.session.send({ to: { agentId }, text: framed }).catch(() => undefined)
    if (sent?.isDelivered) via = 'send'
  }
  if (!via) {
    await change($, t => correctionFailed(t, agentId, now))
    $.ui.status(w.correctionFailedStatus)
    return
  }
  const delivered = via
  await change($, t => correctionSent(t, { agentId, text, via: delivered }, now))
  await appendRow($, w.mainNote(`${typeLabel(node.type)} · ${node.description}`, text))
}

function actionsFor($: EngineInterface): TreeActions {
  const ignore = () => undefined
  return {
    pick: target => void change($, t => pickerOpened(t, target)).catch(ignore),
    choose: (target, family) => void clock($).then(now => change($, t => chosen(t, target, family, now))).catch(ignore),
    close: () => void change($, t => closed(t)).catch(ignore),
    detail: agentId => void openDetail($, agentId).catch(ignore),
    stop: agentId => void clock($).then(now => change($, t => stopRequested(t, agentId, now))).catch(ignore),
    say: (agentId, text) => void sayTo($, agentId, text).catch(ignore),
    look: () => void change($, t => (t.lookOpen ? closed(t) : lookOpened(t))).catch(ignore),
    restyle: (row, id) => void restyle($, look => ({ ...look, [row]: id })).catch(ignore),
    restyleDefault: () => void restyle($, () => DEFAULT_LOOK).catch(ignore),
  }
}

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)
  const keep = agentLimit(options.maxAgents)
  const openOnStart = options.openOnStart === true
  animate = options.animate !== false
  lang = resolveLang(options.language, undefined)

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    if (options.language !== 'de' && options.language !== 'en') {
      lang = resolveLang(options.language, await $.settings.read({ key: 'language' }).catch(() => undefined))
    }
    await $.command
      .register({ name: COMMAND, description: wordsFor(lang).commandDescription, argumentHint: wordsFor(lang).commandHint, immediate: true })
      .catch(() => undefined)
    const saved = await $.store.get(LOOK_KEY).catch(() => undefined)
    await update($, appearance, () => lookFrom(saved)).catch(() => undefined)
    const advisorModel = await $.settings.read({ key: 'advisorModel' }).catch(() => undefined)
    await change($, s => withAdvisorModel(s, typeof advisorModel === 'string' ? advisorModel : undefined)).catch(() => undefined)
    await catchUp($, await clock($), keep).catch(() => undefined)
    if (openOnStart) await $.ui.open({ id: PANE, title: TITLE, columns, rows: INLINE_ROWS }).catch(() => undefined)
    return result
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const w = wordsFor(lang)
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return { text: w.closedText }
    }
    const [word = '', ...names] = arg.split(/\s+/)
    const choice = lookChoice(word, names.join(' '))
    if (choice) {
      const row = choice.row
      const id = choice.id
      const options = (LOOK_OPTIONS[row] as readonly string[]).map(option => lookOptionLabel(w, row, option)).join(', ')
      if (!id) return { text: w.lookUnknown(names.join(' '), w.lookRow[row], options) }
      await restyle($, look => ({ ...look, [row]: id }))
      return { text: w.lookSet(w.lookRow[row], lookOptionLabel(w, row, id)) }
    }
    const now = await clock($)
    if (arg === 'clear') {
      await change($, s => withAdvisorModel(createTree(now), s.advisor.model))
      return { text: w.cleared }
    }
    await catchUp($, now, keep)
    try {
      await $.ui.open({ id: PANE, title: TITLE, focus: true, columns, rows: INLINE_ROWS })
    } catch (err) {
      return { text: w.notOpened(String(err)) }
    }
    const s = await read($, tree)
    return { text: w.opened(s.agents.length) }
  }).catch(() => ({ text: wordsFor(lang).commandFailed }))

  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    const now = await clock($)
    await change($, s => turnStarted(s, { text: e.text, agentId: e.agentId }, now)).catch(() => undefined)
    return result
  })

  on('turn.step', async function* ($, e, next) {
    const agentId = e.agentId
    const before = agentId ? await read($, tree) : undefined
    if (agentId && before && isStopping(before, agentId)) {
      const report = wordsFor(lang).stopAnswer(before.agents.find(n => n.id === agentId)?.toolCount ?? 0)
      const first = !wasStopSent(before, agentId)
      if (first) await change($, s => stopSent(s, agentId)).catch(() => undefined)
      const stopReason = first ? ('tool_use' as const) : ('end_turn' as const)
      yield { kind: 'text' as const, index: 0, text: report }
      if (first) {
        yield { kind: 'tool' as const, index: 1, id: handbackId(), name: HANDBACK }
        yield { kind: 'input' as const, index: 1, json: JSON.stringify({ message: report }) }
      }
      yield { kind: 'stop' as const, stopReason, usage: null }
      return {
        turnId: e.turnId,
        index: e.index,
        answer: report,
        toolUses: first ? [{ name: HANDBACK, input: { message: report } }] : [],
        stopReason,
        usage: null,
      }
    }
    if (agentId && before && pendingCorrection(before, agentId)) {
      const readAt = await clock($)
      await change($, s => correctionRead(s, agentId, readAt)).catch(() => undefined)
    }
    const family = before && e.agentId ? choicesOf(before).agents[e.agentId] : undefined
    const model = before && family ? stepModelFor(before, family) : undefined
    const result = yield* next(model ? { ...e, model } : e)
    const usage = result.usage
    const contextTokens = usage
      ? usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
      : undefined
    const advisorUses = (result.serverToolUses ?? [])
      .filter(use => use.name === 'advisor')
      .map(use => ({ id: use.id, startedAt: use.startedAt, endedAt: use.endedAt }))
    const now = await clock($)
    await change($, s =>
      stepped(
        s,
        { agentId: e.agentId, answer: result.answer, model: usage?.model ?? model ?? e.model, effort: e.effort, contextTokens, advisorUses },
        now,
      ),
    ).catch(() => undefined)
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const family = choicesOf(await read($, tree)).newAgents
    const input = family && !e.model && !e.fork && !e.resume ? { ...e, model: family } : e
    const result = await next(input)
    const agentId = result.agentId
    if (agentId) {
      const now = await clock($)
      await change($, s =>
        trimmed(
          spawned(
            s,
            {
              agentId,
              parentAgentId: e.parentAgentId,
              agentType: e.subagentType,
              description: e.description,
              prompt: e.prompt,
              model: result.model,
              background: e.background,
              fork: e.fork,
              workflowRunId: e.workflow?.runId || undefined,
            },
            now,
          ),
          keep,
        ),
      ).catch(() => undefined)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    if (!agentId) return next(e)
    const stopping = stoppingIds.has(agentId)
    if (stopping) {
      if (e.tool !== HANDBACK) {
        const current = await read($, tree)
        return { deny: wordsFor(lang).stopAnswer(current.agents.find(n => n.id === agentId)?.toolCount ?? 0) }
      }
      if (stopSentIds.has(agentId)) return next(e)
      await change($, s => stopCancelled(s, agentId)).catch(() => undefined)
    }
    if (!stopping && e.tool === HANDBACK) {
      const waiting = pendingCorrection(await read($, tree), agentId)
      if (waiting && !waiting.held) {
        await change($, s => correctionHeld(s, agentId)).catch(() => undefined)
        return { deny: wordsFor(lang).correctionWaiting }
      }
    }
    const label = toolLabel(String(e.tool), e as unknown as Record<string, unknown>)
    const noted = (async () => {
      const known = (await read($, tree)).agents.some(n => n.id === agentId)
      if (!known) return
      const now = await clock($)
      await change($, s => toolRan(s, { agentId, label }, now))
    })().catch(() => undefined)
    const result = await next(e)
    await noted
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const now = await clock($)
    await change($, s =>
      completed(s, { agentId: e.agentId, answer: e.answer, reason: e.reason, isAborted: e.isAborted, durationMs: e.durationMs }, now),
    ).catch(() => undefined)
    if (!e.agentId) await catchUp($, now, keep).catch(() => undefined)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (e.changed.includes('context') || e.changed.includes('cost')) {
      await change($, s =>
        measured(s, { tokens: e.context.tokens, window: e.context.window, percent: e.context.percent, costUsd: e.cost?.usd }),
      ).catch(() => undefined)
    }
    return result
  })

  on('session.end', async ($, e, next) => {
    const reset =
      e.reason === 'clear' || e.reason === 'resume'
        ? clock($).then(now => change($, s => withAdvisorModel(createTree(now), s.advisor.model))).catch(() => undefined)
        : Promise.resolve()
    const result = await next(e)
    await reset
    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const s = await read($, tree)
    const tick = animate ? await read($, frame) : 0
    const now = await clock($)
    return drawTree({ Box, Text, Button, Input } as never, s, e.props.bodyColumns, e.props.scroll?.bodyRows, {
      frame: tick,
      animate,
      now,
      lang,
      actions: actionsFor($),
      appearance: await read($, appearance),
    })
  })

  on('ui.press', { component: 'Pane', requestId: PANE }, async ($, e, next) =>
    pressKey(actionsFor($), e.element) ? { element: e.element } : next(e),
  )

  on('ui.input', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    let work: Promise<void> | undefined
    const actions = { ...actionsFor($), say: (agentId: string, text: string) => void (work = sayTo($, agentId, text)) }
    if (!inputKey(actions, e.element, e.kind, e.value)) return next(e)
    await work?.catch(() => undefined)
    return { element: e.element, value: e.value }
  })
}
