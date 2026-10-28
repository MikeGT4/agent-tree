// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentTreeState } from '../types'
import { DEFAULT_LOOK, LOOK_OPTIONS, lookFrom } from './looks.ts'
import { checkForUpdate, UPDATE_KEY } from './update.ts'
import type { UpdateHost } from './update.ts'
import type { LookRow } from './looks.ts'
import {
  NEW_AGENTS,
  adopted,
  carriedChoices,
  choicesOf,
  chosen,
  closed,
  completed,
  correctionFailed,
  correctionHeld,
  correctionRead,
  correctionCounted,
  correctionResent,
  correctionSent,
  counts,
  createTree,
  detailLoaded,
  detailOpened,
  effortChosen,
  effortFrom,
  effortLabel,
  familyFrom,
  isStopping,
  lookOpened,
  measured,
  pendingCorrection,
  phaseOf,
  pickerOpened,
  restoredChoices,
  spawned,
  stepEffortFor,
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
import { familyOr, lookChoice, lookOptionLabel, resolveLang, wordsFor } from './words.ts'
import type { Lang } from './words.ts'

const PANE = 'agent-tree'
const COMMAND = 'agent-tree'
const TITLE = 'Agent Tree'
const SHAPE = 'agent-tree-1'
const LOOK_SHAPE = 'agent-tree-look-1'
const LOOK_KEY = 'look'
const STAR_KEY = 'star'
const MODEL_KEY = 'model'
const EFFORT_KEY = 'effort'
const INLINE_ROWS = 40
const FRAME_MS = 250
const HANDBACK = 'SubagentHandback'

const tree = atom({ plugin: 'agent-tree', key: 'tree' } as const, createTree(0), { shape: SHAPE })
const frame = atom({ plugin: 'agent-tree', key: 'frame' } as const, 0)
const appearance = atom({ plugin: 'agent-tree', key: 'look' } as const, DEFAULT_LOOK, { shape: LOOK_SHAPE })
const unreadTexts = atom({ plugin: 'agent-tree', key: 'unread' } as const, {} as Record<string, string[]>)

let ticker: Timer | undefined
let animate = true
let lang: Lang = 'en'
let stoppingIds = new Set<string>()
let stopSentIds = new Set<string>()
let lastAdvisor = 'opus'
let advisorCommand = true

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

function without(texts: Record<string, string[]>, agentId: string): Record<string, string[]> {
  return Object.fromEntries(Object.entries(texts).filter(([id]) => id !== agentId))
}

async function remember($: EngineInterface, agentId: string, text: string): Promise<void> {
  await update($, unreadTexts, texts => ({ ...texts, [agentId]: [...(texts[agentId] ?? []), text] }))
}

async function forget($: EngineInterface, agentId: string): Promise<void> {
  await update($, unreadTexts, texts => without(texts, agentId))
}

async function restyle($: EngineInterface, row: LookRow, id: string): Promise<void> {
  const saved = await $.store.get(LOOK_KEY).then(
    value => ({ value }),
    () => undefined,
  )
  const stored = lookFrom(saved ? saved.value : await read($, appearance))
  await $.store.set(LOOK_KEY, lookFrom({ ...stored, [row]: id })).catch(() => undefined)
  await update($, appearance, look => lookFrom({ ...lookFrom(look), [row]: id }))
}

async function resetLook($: EngineInterface): Promise<void> {
  await $.store.set(LOOK_KEY, DEFAULT_LOOK).catch(() => undefined)
  await update($, appearance, () => DEFAULT_LOOK)
}

async function restoreLook($: EngineInterface): Promise<void> {
  const look = await $.store.get(LOOK_KEY).then(
    value => ({ value }),
    () => undefined,
  )
  if (look) await update($, appearance, () => lookFrom(look.value))
}

async function restoreChoices($: EngineInterface, interactive: boolean): Promise<boolean> {
  await restoreLook($)
  if (!interactive || choicesOf(await read($, tree)).restored) return false
  const model = await $.store.get(MODEL_KEY).catch(() => undefined)
  const effort = await $.store.get(EFFORT_KEY).catch(() => undefined)
  await change($, s => restoredChoices(s, familyFrom(model), effortFrom(effort)))
  return true
}

async function chooseModel($: EngineInterface, target: string, family: string | undefined): Promise<void> {
  const now = await clock($)
  await change($, t => chosen(t, target, family, now))
  if (target === NEW_AGENTS) await $.store.set(MODEL_KEY, family ?? null).catch(() => undefined)
}

async function chooseEffort($: EngineInterface, target: string, effort: string | undefined): Promise<void> {
  const now = await clock($)
  await change($, t => effortChosen(t, target, effort, now))
  if (target === NEW_AGENTS) await $.store.set(EFFORT_KEY, effort ?? null).catch(() => undefined)
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

function sayKey(s: AgentTreeState, agentId: string): string {
  return `say:${agentId}:${s.corrections?.[agentId]?.count ?? 0}`
}

function focusField($: EngineInterface, s: AgentTreeState, agentId: string): void {
  if (s.detail?.agentId === agentId) void $.ui.focus({ requestId: PANE, key: sayKey(s, agentId) }).catch(() => undefined)
}

async function openDetail($: EngineInterface, agentId: string): Promise<void> {
  const s = await change($, t => detailOpened(t, agentId))
  focusField($, s, agentId)
  if (s.detail?.agentId !== agentId || s.detail.state !== 'loading') return
  const rows = await $.session.messages({ agentId }).catch(() => undefined)
  await change($, t => detailLoaded(t, agentId, summarize(rows)))
}

async function appendRow($: EngineInterface, text: string, agentId?: string): Promise<boolean> {
  const row = { message: { type: 'user' as const, content: [{ type: 'text' as const, text }] }, ...(agentId ? { agentId } : {}) }
  return $.session.append(row).then(
    result => (result as { deny?: string }).deny === undefined,
    () => false,
  )
}

async function sayTo($: EngineInterface, agentId: string, text: string): Promise<void> {
  if (!text.trim()) return
  const w = wordsFor(lang)
  const current = await read($, tree)
  const node = current.agents.find(n => n.id === agentId)
  if (!node) {
    $.ui.status(w.correctionFailedStatus)
    return
  }
  const before = current.corrections?.[agentId]
  const now = await clock($)
  const framed = w.correctionFrame(text, HANDBACK)
  if (node.status === 'running' && (await appendRow($, framed, agentId))) {
    await remember($, agentId, framed)
    await change($, t => correctionSent(t, { agentId, text, via: 'append' }, now))
  } else {
    await forget($, agentId)
    await change($, t => correctionSent(t, { agentId, text, via: 'send', recount: false }, now))
    const sent = await $.session.send({ to: { agentId }, text: framed }).catch(() => undefined)
    if (!sent?.isDelivered) {
      await change($, t => correctionFailed(t, { agentId, text, before }, now))
      $.ui.status(w.correctionFailedStatus)
      return
    }
    await change($, t => correctionCounted(t, agentId))
  }
  focusField($, await read($, tree), agentId)
  const note = w.mainNote(`${typeLabel(node.type)} · ${node.description}`, text)
  await appendRow($, note)
  const parent = node.parentId ? current.agents.find(n => n.id === node.parentId) : undefined
  if (parent?.status === 'running') await appendRow($, note, parent.id)
}

async function readAdvisor($: EngineInterface): Promise<void> {
  const model = await $.settings.read({ key: 'advisorModel' }).catch(() => undefined)
  const name = typeof model === 'string' && model ? model : undefined
  if (name) lastAdvisor = name
  await change($, s => withAdvisorModel(s, name))
}

async function toggleAdvisor($: EngineInterface): Promise<void> {
  const args = (await read($, tree)).advisor.model ? 'off' : lastAdvisor
  const ran = await $.command.run({ command: 'advisor', args }).then(
    () => true,
    () => false,
  )
  if (!ran) {
    $.ui.toast(wordsFor(lang).advisorUnavailable)
    return
  }
  await change($, s => withAdvisorModel(s, args === 'off' ? undefined : args))
}

async function settleUnread($: EngineInterface, s: AgentTreeState, agentId: string, now: number): Promise<void> {
  const texts = (await read($, unreadTexts))[agentId] ?? []
  await forget($, agentId)
  const waiting = pendingCorrection(s, agentId)
  const node = s.agents.find(n => n.id === agentId)
  if (!waiting || !node) return
  const w = wordsFor(lang)
  if (node.status === 'done' && waiting.via === 'append' && texts.length) {
    await change($, t => correctionResent(t, agentId, now))
    const sent = await $.session.send({ to: { agentId }, text: w.resendFrame(texts.join('\n\n')) }).catch(() => undefined)
    if (sent?.isDelivered) return
  }
  await change($, t => correctionFailed(t, { agentId, text: waiting.text, count: waiting.count }, now))
  $.ui.status(w.correctionFailedStatus)
  await appendRow($, w.mainNoteLost(`${typeLabel(node.type)} · ${node.description}`))
}

function actionsFor($: EngineInterface): TreeActions {
  const ignore = () => undefined
  return {
    pick: target => void change($, t => pickerOpened(t, target)).catch(ignore),
    choose: (target, family) => void chooseModel($, target, family).catch(ignore),
    effort: (target, effort) => void chooseEffort($, target, effort).catch(ignore),
    close: () => void change($, t => closed(t)).catch(ignore),
    detail: agentId => void openDetail($, agentId).catch(ignore),
    stop: agentId => {
      void forget($, agentId)
        .then(() => clock($))
        .then(now => change($, t => stopRequested(t, agentId, now)))
        .catch(ignore)
    },
    say: (agentId, text) => void sayTo($, agentId, text).catch(ignore),
    advisor: () => void toggleAdvisor($).catch(ignore),
    look: () => void change($, t => (t.lookOpen ? closed(t) : lookOpened(t))).catch(ignore),
    restyle: (row, id) => void restyle($, row, id).catch(ignore),
    restyleDefault: () => void resetLook($).catch(ignore),
  }
}

async function starDue($: EngineInterface): Promise<boolean> {
  const starts = Number((await $.store.get(STAR_KEY).catch(() => undefined)) ?? 0)
  if (!Number.isFinite(starts) || starts >= 2) return false
  await $.store.set(STAR_KEY, starts + 1).catch(() => undefined)
  return starts + 1 === 2
}

async function offSwitch($: EngineInterface, name: string): Promise<string | undefined> {
  switch (name) {
    case 'DO_NOT_TRACK':
      return $.env.get('DO_NOT_TRACK').catch(() => undefined)
    case 'DISABLE_AUTOUPDATER':
      return $.env.get('DISABLE_AUTOUPDATER').catch(() => undefined)
    case 'DISABLE_UPDATES':
      return $.env.get('DISABLE_UPDATES').catch(() => undefined)
    case 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC':
      return $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC').catch(() => undefined)
    default:
      return undefined
  }
}

function hostOf($: EngineInterface): UpdateHost {
  return {
    env: name => offSwitch($, name),
    load: () => $.store.get(UPDATE_KEY).catch(() => undefined),
    save: value => $.store.set(UPDATE_KEY, value).catch(() => undefined),
    listPlugins: () =>
      $.process.run(['claude', 'plugin', 'list', '--json'], { timeoutMs: 30_000 })
        .then(result => (result.exitCode === 0 ? result.stdout : undefined))
        .catch(() => undefined),
    fetchLatest: () =>
      $.http.fetch('https://raw.githubusercontent.com/MikeGT4/agent-tree/main/.claude-plugin/plugin.json', { method: 'GET' })
        .catch(() => undefined),
    update: () =>
      $.process.run(['claude', 'plugin', 'update', 'agent-tree'], { timeoutMs: 120_000 })
        .then(result => ({ exitCode: result.exitCode, stdout: result.stdout }))
        .catch(() => undefined),
  }
}

async function announceUpdate($: EngineInterface, enabled: boolean): Promise<void> {
  const outcome = await checkForUpdate(hostOf($), enabled, await clock($))
  const w = wordsFor(lang)
  if (outcome.kind === 'installed') $.ui.toast(w.updateInstalled(outcome.version))
  if (outcome.kind === 'failed') $.ui.toast(w.updateFailed(outcome.version, outcome.command))
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
    const restored = await restoreChoices($, e.isInteractive !== false).catch(() => false)
    const saved = restored ? choicesOf(await read($, tree)) : undefined
    if (saved && (saved.newAgents || saved.newEffort)) {
      const w = wordsFor(lang)
      $.ui.toast(w.savedChoice(`${familyOr(saved.newAgents, w.standard)}${saved.newEffort ? ` · ${effortLabel(saved.newEffort)}` : ''}`))
    }
    const listed = await $.command.list().catch(() => undefined)
    advisorCommand = !listed || listed.some(c => c.name === 'advisor')
    await readAdvisor($).catch(() => undefined)
    await catchUp($, await clock($), keep).catch(() => undefined)
    if (openOnStart) await $.ui.open({ id: PANE, title: TITLE, columns, rows: INLINE_ROWS }).catch(() => undefined)
    if (e.isInteractive !== false) {
      if (await starDue($)) $.ui.toast(wordsFor(lang).starHint)
      void announceUpdate($, options.autoUpdate !== false).catch(() => undefined)
    }
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
      const choices = (LOOK_OPTIONS[row] as readonly string[]).map(option => lookOptionLabel(w, row, option)).join(', ')
      if (!id) return { text: w.lookUnknown(names.join(' '), w.lookRow[row], choices) }
      await restyle($, row, id)
      return { text: w.lookSet(w.lookRow[row], lookOptionLabel(w, row, id)) }
    }
    if (word === 'aussehen' || word === 'look') {
      await resetLook($)
      return { text: w.lookResetDone }
    }
    const now = await clock($)
    if (arg === 'clear') {
      await change($, s => carriedChoices(s, withAdvisorModel(createTree(now), s.advisor.model)))
      await update($, unreadTexts, () => ({}))
      return { text: w.cleared }
    }
    if (arg) return { text: w.commandUnknown(e.args.trim()) }
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
    if (!e.agentId) await readAdvisor($).catch(() => undefined)
    if (!e.agentId) await restoreLook($).catch(() => undefined)
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
      await forget($, agentId).catch(() => undefined)
      await change($, s => correctionRead(s, agentId, readAt)).catch(() => undefined)
    }
    const family = before && e.agentId ? choicesOf(before).agents[e.agentId] : undefined
    const model = before && family ? stepModelFor(before, family) : undefined
    const effort = before && agentId && e.effort !== undefined ? stepEffortFor(before, agentId) : undefined
    const changed = model !== undefined || (effort !== undefined && effort !== e.effort)
    const result = yield* next(changed ? { ...e, ...(model ? { model } : {}), ...(effort ? { effort } : {}) } : e)
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
      if (String(e.tool) !== HANDBACK) {
        const current = await read($, tree)
        return { deny: wordsFor(lang).stopAnswer(current.agents.find(n => n.id === agentId)?.toolCount ?? 0) }
      }
      if (stopSentIds.has(agentId)) return next(e)
      await change($, s => stopCancelled(s, agentId)).catch(() => undefined)
    }
    if (!stopping && String(e.tool) === HANDBACK) {
      const waiting = pendingCorrection(await read($, tree), agentId)
      if (waiting && !waiting.held) {
        await change($, s => correctionHeld(s, agentId)).catch(() => undefined)
        return { deny: wordsFor(lang).correctionWaiting(HANDBACK) }
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
    const after = await change($, s =>
      completed(s, { agentId: e.agentId, answer: e.answer, reason: e.reason, isAborted: e.isAborted, durationMs: e.durationMs }, now),
    ).catch(() => undefined)
    if (e.agentId && after) await settleUnread($, after, e.agentId, now).catch(() => undefined)
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
        ? clock($)
            .then(now => change($, s => carriedChoices(s, withAdvisorModel(createTree(now), s.advisor.model))))
            .then(() => update($, unreadTexts, () => ({})))
            .catch(() => undefined)
        : Promise.resolve()
    const result = await next(e)
    await reset
    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    const Input = 'Input' in elements ? elements.Input : undefined
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
      canAdvise: advisorCommand,
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
