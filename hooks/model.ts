// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type {
  AgentTreeChoices,
  AgentTreeCorrection,
  AgentTreeCounts,
  AgentTreeDetail,
  AgentTreeGroup,
  AgentTreeLimit,
  AgentTreeLogSource,
  AgentTreeNode,
  AgentTreePhase,
  AgentTreeState,
  AgentTreeStatus,
} from '../types'

export const LOG_LIMIT = 40
export const LOG_EXCERPT = 60
export const DESCRIPTION_LIMIT = 80
export const LABEL_LIMIT = 40
export const ADVISOR_CALLS_KEPT = 20
export const TOOLS_KEPT = 5
export const DETAIL_LIMIT = 160

export type AdvisorUse = { id: string; startedAt: number; endedAt?: number }

export type StepInput = {
  agentId?: string
  answer?: string
  model: string
  effort?: string | number
  effortless?: boolean
  contextTokens?: number
  advisorUses?: readonly AdvisorUse[]
}

export type SpawnInput = {
  agentId: string
  parentAgentId?: string
  agentType: string
  description: string
  prompt?: string
  model?: string
  effort?: string
  background: boolean
  fork: boolean
  workflowRunId?: string
}

export type CompleteInput = {
  agentId?: string
  answer: string
  reason: string
  isAborted: boolean
  durationMs: number
}

type WorkflowGroup = Extract<AgentTreeGroup, { kind: 'workflow' }>

const ENGINE_STATUS: Record<string, AgentTreeStatus> = {
  completed: 'done',
  failed: 'failed',
  killed: 'stopped',
}

export const MODEL_FAMILIES = ['haiku', 'sonnet', 'opus', 'fable'] as const

export const NEW_AGENTS = 'new'

export const MAIN = 'main'

export function familyFrom(value: unknown): string | undefined {
  return typeof value === 'string' && (MODEL_FAMILIES as readonly string[]).includes(value) ? value : undefined
}

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export type EffortLevel = (typeof EFFORT_LEVELS)[number]

export function effortFrom(value: unknown): EffortLevel | undefined {
  return typeof value === 'string' && (EFFORT_LEVELS as readonly string[]).includes(value) ? (value as EffortLevel) : undefined
}

export function effortLabel(effort: string): string {
  return effort === 'xhigh' ? 'XHigh' : effort.charAt(0).toUpperCase() + effort.slice(1)
}

export function choicesOf(s: AgentTreeState): AgentTreeChoices {
  return s.choices ?? { agents: {} }
}

export function familyLabel(family: string | undefined): string {
  return family ? family.charAt(0).toUpperCase() + family.slice(1) : 'Standard'
}

export function pickerOpened(s: AgentTreeState, target: string | undefined): AgentTreeState {
  return {
    ...s,
    detail: target === undefined ? s.detail : undefined,
    lookOpen: target === undefined ? s.lookOpen : undefined,
    choices: { ...choicesOf(s), picker: target },
  }
}

export function lookOpened(s: AgentTreeState): AgentTreeState {
  return { ...s, lookOpen: true, detail: undefined, choices: { ...choicesOf(s), picker: undefined } }
}

export function closed(s: AgentTreeState): AgentTreeState {
  return { ...s, detail: undefined, lookOpen: undefined, choices: { ...choicesOf(s), picker: undefined } }
}

export function correctionSent(
  s: AgentTreeState,
  input: { agentId: string; text: string; via: 'append' | 'send'; recount?: boolean },
  now: number,
): AgentTreeState {
  const node = findAgent(s, input.agentId)
  if (!node) return s
  const count = (s.corrections?.[input.agentId]?.count ?? 0) + (input.recount === false ? 0 : 1)
  const correction: AgentTreeCorrection = { at: now, text: excerpt(input.text), via: input.via, state: 'sent', count }
  const next = { ...s, corrections: { ...s.corrections, [input.agentId]: correction } }
  return logged(next, 'agent', 'correction', { type: node.type, text: cut(oneLine(input.text), LOG_EXCERPT) }, now)
}

export function correctionFailed(
  s: AgentTreeState,
  input: { agentId: string; text: string; before?: AgentTreeCorrection; count?: number },
  now: number,
): AgentTreeState {
  const node = findAgent(s, input.agentId)
  if (!node) return s
  const kept: AgentTreeCorrection =
    input.before?.state === 'sent'
      ? input.before
      : { at: now, text: excerpt(input.text), state: 'failed', count: input.count ?? input.before?.count ?? 0 }
  const next = { ...s, corrections: { ...s.corrections, [input.agentId]: kept } }
  return logged(next, 'agent', 'correctionFailed', { type: node.type, text: cut(oneLine(input.text), LOG_EXCERPT) }, now)
}

export function correctionCounted(s: AgentTreeState, agentId: string): AgentTreeState {
  const current = s.corrections?.[agentId]
  if (!current) return s
  return { ...s, corrections: { ...s.corrections, [agentId]: { ...current, count: current.count + 1 } } }
}

export function correctionResent(s: AgentTreeState, agentId: string, now: number): AgentTreeState {
  const node = findAgent(s, agentId)
  const current = s.corrections?.[agentId]
  if (!node || !current) return s
  const correction: AgentTreeCorrection = { ...current, via: 'send', state: 'sent', at: now, held: undefined }
  return logged({ ...s, corrections: { ...s.corrections, [agentId]: correction } }, 'agent', 'correctionResent', { type: node.type }, now)
}

export function correctionRead(s: AgentTreeState, agentId: string, now: number): AgentTreeState {
  const pending = pendingCorrection(s, agentId)
  if (!pending) return s
  return { ...s, corrections: { ...s.corrections, [agentId]: { ...pending, state: 'read', readAt: now } } }
}

export function correctionHeld(s: AgentTreeState, agentId: string): AgentTreeState {
  const pending = pendingCorrection(s, agentId)
  if (!pending) return s
  return { ...s, corrections: { ...s.corrections, [agentId]: { ...pending, held: true } } }
}

export function pendingCorrection(s: AgentTreeState, agentId: string | undefined): AgentTreeCorrection | undefined {
  const correction = agentId === undefined ? undefined : s.corrections?.[agentId]
  return correction?.state === 'sent' ? correction : undefined
}

export function detailOpened(s: AgentTreeState, agentId: string): AgentTreeState {
  const node = findAgent(s, agentId)
  if (!node || s.detail?.agentId === agentId) return { ...s, detail: undefined }
  const detail: AgentTreeDetail = { agentId, state: node.task ? 'ready' : 'loading' }
  return { ...s, detail, lookOpen: undefined, choices: { ...choicesOf(s), picker: undefined } }
}

export function detailLoaded(
  s: AgentTreeState,
  agentId: string,
  found: { task?: string; answer?: string; denied?: boolean },
): AgentTreeState {
  const next = withAgent(s, agentId, n => ({
    ...n,
    task: n.task || (found.task ? excerpt(found.task) : undefined),
    answer: n.answer || (found.answer ? excerpt(found.answer) : undefined),
  }))
  if (next.detail?.agentId !== agentId) return next
  return { ...next, detail: { agentId, state: found.denied ? 'denied' : 'ready' } }
}

export function stopRequested(s: AgentTreeState, agentId: string, now: number): AgentTreeState {
  const node = findAgent(s, agentId)
  if (!node || node.status !== 'running' || isStopping(s, agentId)) return s
  return logged({ ...s, stopping: [...(s.stopping ?? []), agentId] }, 'session', 'stopRequested', { type: node.type }, now)
}

export function isStopping(s: AgentTreeState, agentId: string | undefined): boolean {
  return agentId !== undefined && (s.stopping ?? []).includes(agentId)
}

export function stopSent(s: AgentTreeState, agentId: string): AgentTreeState {
  if (wasStopSent(s, agentId)) return s
  return { ...s, stopSent: [...(s.stopSent ?? []), agentId] }
}

export function wasStopSent(s: AgentTreeState, agentId: string | undefined): boolean {
  return agentId !== undefined && (s.stopSent ?? []).includes(agentId)
}

export function stopCancelled(s: AgentTreeState, agentId: string): AgentTreeState {
  return isStopping(s, agentId) || wasStopSent(s, agentId) ? withoutStop(s, agentId) : s
}

function withoutStop(s: AgentTreeState, agentId: string): AgentTreeState {
  return {
    ...s,
    stopping: (s.stopping ?? []).filter(id => id !== agentId),
    stopSent: (s.stopSent ?? []).filter(id => id !== agentId),
  }
}

export function withNewAgents(s: AgentTreeState, family: string | undefined): AgentTreeState {
  const current = choicesOf(s)
  return current.newAgents === family ? s : { ...s, choices: { ...current, newAgents: family } }
}

export function withNewEffort(s: AgentTreeState, effort: string | undefined): AgentTreeState {
  const current = choicesOf(s)
  return current.newEffort === effort ? s : { ...s, choices: { ...current, newEffort: effort } }
}

export function restoredChoices(
  s: AgentTreeState,
  family: string | undefined,
  effort: string | undefined,
  mainEffort?: string,
): AgentTreeState {
  return { ...s, choices: { ...choicesOf(s), newAgents: family, newEffort: effort, mainEffort, restored: true } }
}

export function carriedChoices(from: AgentTreeState, to: AgentTreeState): AgentTreeState {
  const { newAgents, newEffort, mainEffort, restored } = choicesOf(from)
  return { ...to, choices: { ...choicesOf(to), newAgents, newEffort, mainEffort, restored } }
}

export function effortChosen(s: AgentTreeState, target: string, effort: string | undefined, now: number): AgentTreeState {
  const current = choicesOf(s)
  const efforts = { ...(current.efforts ?? {}) }
  let choices: AgentTreeChoices
  let who = ''
  if (target === MAIN) {
    const picker = current.picker === MAIN ? undefined : current.picker
    return logged({ ...s, choices: { ...current, mainEffort: effort, picker } }, 'session', 'effort', { who, main: 1, effort: effort ?? '' }, now)
  }
  if (target === NEW_AGENTS) {
    choices = { ...current, newEffort: effort, efforts }
  } else {
    const node = findAgent(s, target)
    if (!node) return s
    if (effort === undefined) delete efforts[target]
    else efforts[target] = effort
    choices = { ...current, efforts }
    who = node.type
  }
  return logged({ ...s, choices }, 'session', 'effort', { who, effort: effort ?? '' }, now)
}

export function shortId(s: AgentTreeState, agentId: string): string {
  for (let n = 8; n < agentId.length; n++) {
    const head = agentId.slice(0, n)
    if (s.agents.every(a => a.id === agentId || !a.id.startsWith(head))) return head
  }
  return agentId
}

export function agentByPrefix(s: AgentTreeState, prefix: string): AgentTreeNode | undefined {
  const exact = s.agents.find(a => a.id === prefix)
  if (exact) return exact
  const hits = s.agents.filter(a => a.id.startsWith(prefix))
  return hits.length === 1 ? hits[0] : undefined
}

export function mainStepEffort(s: AgentTreeState): EffortLevel | undefined {
  return effortFrom(choicesOf(s).mainEffort)
}

export function stepEffortFor(s: AgentTreeState, agentId: string, fallback?: string): EffortLevel | undefined {
  const current = choicesOf(s)
  if (current.efforts && agentId in current.efforts) return effortFrom(current.efforts[agentId])
  return effortFrom(fallback)
}

function pinned(s: AgentTreeState, agentId: string, effort: string | undefined): AgentTreeState {
  const current = choicesOf(s)
  if (!effort || (current.efforts && agentId in current.efforts)) return s
  return { ...s, choices: { ...current, efforts: { ...(current.efforts ?? {}), [agentId]: effort } } }
}

function without<T>(map: Record<string, T>, drop: (id: string) => boolean): Record<string, T> {
  return Object.fromEntries(Object.entries(map).filter(([id]) => !drop(id)))
}

export function isNewInput(door: string, message: { role?: string; name?: string }): boolean {
  return door === 'attachment' ? message.name === 'queued_command' : message.role === 'user'
}

export function runningIds(s: AgentTreeState): Set<string> {
  return new Set(s.agents.filter(n => n.status === 'running').map(n => n.id))
}

export function chosen(s: AgentTreeState, target: string, family: string | undefined, now: number): AgentTreeState {
  const current = choicesOf(s)
  const picker = current.picker === target ? undefined : current.picker
  const agents = { ...current.agents }
  let choices: AgentTreeChoices
  let who = ''
  if (target === NEW_AGENTS) {
    choices = { ...current, newAgents: family, agents, picker }
  } else {
    const node = findAgent(s, target)
    if (!node) return s
    if (family === undefined) delete agents[target]
    else agents[target] = family
    choices = { ...current, agents, picker }
    who = node.type
  }
  return logged({ ...s, choices }, 'session', 'choice', { who, family: family ?? '' }, now)
}

export function stepModelFor(s: AgentTreeState, family: string): string {
  const seen = [s.main.model, ...s.agents.map(n => n.model)]
  return seen.find(model => model !== undefined && new RegExp(`claude-${family}-\\d`).test(model)) ?? family
}

export function createTree(now: number): AgentTreeState {
  return {
    startedAt: now,
    main: { active: false, turn: 0, returned: 0, returnedTokens: 0 },
    agents: [],
    advisor: { total: 0, fromMain: 0, fromAgents: 0, calls: [] },
    log: [],
  }
}

const AGENT_MESSAGE = /^\s*<(agent-message|task-notification)\b/

function logged(
  s: AgentTreeState,
  source: AgentTreeLogSource,
  kind: string,
  data: Record<string, string | number>,
  at: number,
): AgentTreeState {
  const log = [...s.log]
  let place = log.length
  while (place > 0 && (log[place - 1]?.at ?? 0) > at) place -= 1
  log.splice(place, 0, { at, source, kind, data })
  return { ...s, log: log.slice(-LOG_LIMIT) }
}

function findAgent(s: AgentTreeState, id: string | undefined): AgentTreeNode | undefined {
  return id === undefined ? undefined : s.agents.find(n => n.id === id)
}

function withAgent(s: AgentTreeState, id: string, change: (n: AgentTreeNode) => AgentTreeNode): AgentTreeState {
  return { ...s, agents: s.agents.map(n => (n.id === id ? change(n) : n)) }
}

const ANSI = /\u001b\[[0-9;?]*[ -\/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g

const TOKEN =
  /\b(?:ghp_|gho_|ghu_|ghs_|github_pat_|sk-|xox[abprs]-|AKIA|AIza|eyJ)[A-Za-z0-9_\-.]{6,}|\bBasic\s+(?=[A-Za-z0-9+\/]*[0-9+\/=])[A-Za-z0-9+\/]{8,}={0,2}/g

const BEARER = /\bBearer\s+\S+/gi

const URL_CREDENTIALS = /:\/\/[^\s\/:@]+:[^\s\/@]+@/g

const ASSIGNMENT = /(?<![\w-])([\w-]+)(["']?\s*[=:]\s*)/g

const ASSIGNED_VALUE = /"[^"]*"|'[^']*'|["']?[^\s"',;]+/y

const SECRET_NAME = /password|passwort|passwd|token|secret|api[_-]?key|access[_-]?key/i

const ENV_ASSIGNMENT = /\b([A-Z][A-Z0-9_]*)(=)/g

const ENV_VALUE = /\S+/y

const ENV_SECRET_NAME = /PASS|PWD|KEY|CREDENTIALS?/

function secretName(name: string): boolean {
  return SECRET_NAME.test(name.slice(name.lastIndexOf('-') + 1)) || /(?:api|access)-key$/i.test(name)
}

function masked(text: string, scan: RegExp, value: RegExp, secret: (name: string) => boolean): string {
  let out = ''
  let from = 0
  scan.lastIndex = 0
  for (let found = scan.exec(text); found; found = scan.exec(text)) {
    if (!secret(found[1] ?? '')) continue
    const end = found.index + found[0].length
    value.lastIndex = end
    const tail = value.exec(text)
    if (!tail) continue
    out += `${text.slice(from, found.index)}•••`
    from = end + tail[0].length
    scan.lastIndex = from
  }
  return out + text.slice(from)
}

function oneLine(text: string): string {
  const plain = text
    .replace(ANSI, ' ')
    .replace(CONTROL, ' ')
    .replace(TOKEN, '•••')
    .replace(BEARER, '•••')
    .replace(URL_CREDENTIALS, '://•••@')
  return masked(masked(plain, ASSIGNMENT, ASSIGNED_VALUE, secretName), ENV_ASSIGNMENT, ENV_VALUE, name => ENV_SECRET_NAME.test(name))
    .replace(/\s+/g, ' ')
    .trim()
}

const GRAPHEMES = 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : undefined

export function cut(text: string, limit: number): string {
  if (limit <= 0) return ''
  if (text.length <= limit) return text
  if (GRAPHEMES) {
    let end = 0
    for (const part of GRAPHEMES.segment(text.slice(0, limit + 32))) {
      const next = part.index + part.segment.length
      if (next > limit) break
      end = next
    }
    return text.slice(0, end)
  }
  return text.slice(0, /[\uD800-\uDBFF]/.test(text.charAt(limit - 1)) ? limit - 1 : limit)
}

export function excerpt(text: string | undefined, limit = DETAIL_LIMIT): string {
  return cut(oneLine(text ?? ''), limit)
}

export function counts(s: AgentTreeState): AgentTreeCounts {
  const tally: AgentTreeCounts = { running: 0, done: 0, failed: 0, stopped: 0 }
  for (const n of s.agents) tally[n.status] += 1
  return tally
}

export function phaseOf(s: AgentTreeState): AgentTreePhase {
  if (s.agents.some(n => n.status === 'running')) return 'delegating'
  if (!s.main.active) return 'idle'
  return s.main.returned > 0 ? 'reviewing' : 'planning'
}

export function withAdvisorModel(s: AgentTreeState, model: string | undefined): AgentTreeState {
  return { ...s, advisor: { ...s.advisor, model } }
}

export function turnStarted(s: AgentTreeState, input: { text: string; agentId?: string }, now: number): AgentTreeState {
  if (input.agentId !== undefined) {
    const node = findAgent(s, input.agentId)
    if (!node || node.status === 'running') return s
    const reopened = withAgent(s, node.id, n => ({ ...n, status: 'running', endedAt: undefined, startedAt: now }))
    return logged(reopened, 'agent', 'resumed', { type: node.type, description: node.description }, now)
  }
  if (AGENT_MESSAGE.test(input.text) || input.text.trim() === '') {
    return { ...s, main: { ...s.main, active: true, resumed: true, turnStartedAt: now } }
  }
  const turn = s.main.turn + 1
  const excerpt = cut(oneLine(input.text), LOG_EXCERPT)
  const next: AgentTreeState = {
    ...s,
    startedAt: s.startedAt || now,
    main: { ...s.main, active: true, resumed: false, turn, turnStartedAt: now, roundStartedAt: now, returned: 0, returnedTokens: 0 },
  }
  return logged(next, 'main', 'turn', { turn, excerpt }, now)
}

function advised(s: AgentTreeState, use: AdvisorUse, agentId: string | undefined, now: number): AgentTreeState {
  const durationMs = use.endedAt === undefined ? undefined : Math.max(0, use.endedAt - use.startedAt)
  const known = s.advisor.calls.find(c => c.id === use.id)
  if (known) {
    if (known.durationMs !== undefined || durationMs === undefined) return s
    const calls = s.advisor.calls.map(c => (c.id === use.id ? { ...c, durationMs } : c))
    return { ...s, advisor: { ...s.advisor, calls } }
  }
  const fromMain = agentId === undefined
  const advisor = {
    ...s.advisor,
    total: s.advisor.total + 1,
    fromMain: s.advisor.fromMain + (fromMain ? 1 : 0),
    fromAgents: s.advisor.fromAgents + (fromMain ? 0 : 1),
    calls: [...s.advisor.calls, { id: use.id, at: use.startedAt, durationMs, agentId }].slice(-ADVISOR_CALLS_KEPT),
  }
  const where = fromMain ? '' : findAgent(s, agentId)?.type ?? '?'
  return logged({ ...s, advisor }, 'advisor', 'advisor', { where }, Math.min(use.startedAt, now))
}

export function stepped(s: AgentTreeState, input: StepInput, now: number): AgentTreeState {
  const effort = input.effort === undefined ? undefined : String(input.effort)
  let next = s
  if (input.agentId === undefined) {
    next = {
      ...next,
      main: {
        ...next.main,
        model: input.model,
        effort: input.effortless ? undefined : (effort ?? next.main.effort),
        effortless: input.effortless ? true : effort !== undefined ? false : next.main.effortless,
        contextTokens: input.contextTokens ?? next.main.contextTokens,
      },
    }
  } else if (findAgent(next, input.agentId)) {
    next = withAgent(next, input.agentId, n => ({
      ...n,
      model: input.model,
      effort: input.effortless ? undefined : (effort ?? n.effort),
      contextTokens: input.contextTokens ?? n.contextTokens,
      answer: input.answer ? excerpt(input.answer) : n.answer,
    }))
  }
  for (const use of input.advisorUses ?? []) next = advised(next, use, input.agentId, now)
  return next
}

export const ORPHANS_KEPT = 20

function returnedTo(s: AgentTreeState, node: AgentTreeNode, answerTokens: number): AgentTreeState {
  if (node.parentId !== undefined) return s
  return {
    ...s,
    main: { ...s.main, returned: s.main.returned + 1, returnedTokens: s.main.returnedTokens + answerTokens },
  }
}

export function spawned(s: AgentTreeState, input: SpawnInput, now: number): AgentTreeState {
  const existing = findAgent(s, input.agentId)
  if (existing) {
    const resumed = withAgent(s, existing.id, n => ({
      ...n,
      parentId: input.parentAgentId ?? n.parentId,
      model: input.model ?? n.model,
      status: 'running',
      startedAt: now,
      endedAt: undefined,
    }))
    return logged(pinned(resumed, existing.id, input.effort), 'agent', 'resumed', { type: existing.type, description: existing.description }, now)
  }
  const orphan = s.orphans?.[input.agentId]
  const node: AgentTreeNode = {
    id: input.agentId,
    parentId: input.parentAgentId,
    type: input.fork ? 'Fork' : input.agentType,
    description: cut(oneLine(input.description), DESCRIPTION_LIMIT),
    task: input.prompt ? excerpt(input.prompt) || undefined : undefined,
    model: input.model,
    background: input.background,
    fork: input.fork,
    workflowRunId: input.workflowRunId,
    status: orphan?.status ?? 'running',
    startedAt: orphan ? Math.min(now, orphan.at) : now,
    endedAt: orphan?.at,
    answerTokens: orphan?.answerTokens,
    answer: orphan?.answer,
    toolCount: 0,
  }
  const runSeen = node.workflowRunId !== undefined && s.agents.some(n => n.workflowRunId === node.workflowRunId)
  const orphans = { ...s.orphans }
  delete orphans[node.id]
  let next: AgentTreeState = {
    ...s,
    startedAt: s.startedAt || now,
    orphans,
    agents: [...s.agents, node],
  }
  next = pinned(next, node.id, input.effort)
  if (orphan) next = returnedTo(next, node, orphan.answerTokens)
  if (runSeen) return next
  if (node.workflowRunId !== undefined) return logged(next, 'agent', 'workflowStarted', { description: node.description }, node.startedAt)
  next = logged(next, 'agent', 'agentStarted', { type: node.type, description: node.description }, node.startedAt)
  if (!orphan) return next
  const ended = { type: node.type, status: orphan.status, durationMs: orphan.durationMs ?? 0, tokens: orphan.answerTokens }
  return logged(next, 'agent', 'agentEnded', ended, orphan.at)
}

export function toolRan(s: AgentTreeState, input: { agentId?: string; label: string }, now: number): AgentTreeState {
  if (input.agentId === undefined || !findAgent(s, input.agentId)) return s
  return withAgent(s, input.agentId, n => ({
    ...n,
    toolCount: n.toolCount + 1,
    lastTool: input.label,
    tools: [...(n.tools ?? []), input.label].slice(-TOOLS_KEPT),
  }))
}

function statusOf(input: CompleteInput): AgentTreeStatus {
  if (input.isAborted || input.reason === 'aborted') return 'stopped'
  if (input.reason === 'refusal' || input.reason === 'error') return 'failed'
  return 'done'
}

export function completed(s: AgentTreeState, input: CompleteInput, now: number): AgentTreeState {
  const status = statusOf(input)
  if (input.agentId === undefined) {
    const next: AgentTreeState = { ...s, main: { ...s.main, active: false } }
    if (s.main.resumed) return next
    return logged(next, 'main', 'mainDone', { status, durationMs: input.durationMs }, now)
  }
  const answerTokens = estimateTokens(input.answer)
  const node = findAgent(s, input.agentId)
  if (!node) {
    const answer = input.answer ? excerpt(input.answer) : undefined
    const kept = Object.entries({ ...s.orphans, [input.agentId]: { status, at: now, answerTokens, answer, durationMs: input.durationMs } }).slice(
      -ORPHANS_KEPT,
    )
    return { ...s, orphans: Object.fromEntries(kept) }
  }
  if (node.status !== 'running' && node.answerTokens !== undefined) return s
  const final = node.status === 'stopped' || wasStopSent(s, node.id) ? 'stopped' : status
  let next = withAgent(withoutStop(s, node.id), node.id, n => ({
    ...n,
    status: final,
    endedAt: n.status === 'running' ? now : n.endedAt ?? now,
    answerTokens,
    answer: input.answer ? excerpt(input.answer) : n.answer,
  }))
  next = returnedTo(next, node, answerTokens)
  if (node.workflowRunId !== undefined) {
    const stillRunning = next.agents.some(n => n.workflowRunId === node.workflowRunId && n.status === 'running')
    if (stillRunning) return next
    const size = next.agents.filter(n => n.workflowRunId === node.workflowRunId).length
    return logged(next, 'agent', 'workflowDone', { size }, now)
  }
  return logged(next, 'agent', 'agentEnded', { type: node.type, status: final, durationMs: input.durationMs, tokens: answerTokens }, now)
}

export function measured(
  s: AgentTreeState,
  input: { tokens?: number; window: number; percent?: number; costUsd?: number; limits?: AgentTreeLimit[] },
): AgentTreeState {
  return {
    ...s,
    main: {
      ...s.main,
      contextTokens: input.tokens ?? s.main.contextTokens,
      window: input.window,
      percent: input.percent ?? s.main.percent,
      costUsd: input.costUsd ?? s.main.costUsd,
      limits: input.limits ?? s.main.limits,
    },
  }
}

export const LIMIT_ORDER = ['five_hour', 'seven_day']

export function limitsFrom(value: unknown): AgentTreeLimit[] {
  if (!Array.isArray(value)) return []
  const rank = (kind: string) => (LIMIT_ORDER.includes(kind) ? LIMIT_ORDER.indexOf(kind) : LIMIT_ORDER.length)
  return value
    .flatMap(entry => {
      if (!entry || typeof entry !== 'object') return []
      const { kind, percentUsed, resetsAt } = entry as Record<string, unknown>
      if (typeof kind !== 'string' || typeof percentUsed !== 'number' || !Number.isFinite(percentUsed)) return []
      return [{ kind, percent: percentUsed, ...(typeof resetsAt === 'string' ? { resetsAt } : {}) }]
    })
    .sort((a, b) => rank(a.kind) - rank(b.kind))
}

export function withLimits(s: AgentTreeState, limits: AgentTreeLimit[]): AgentTreeState {
  return { ...s, main: { ...s.main, limits } }
}

export function freshTree(from: AgentTreeState, now: number): AgentTreeState {
  const base = carriedChoices(from, withAdvisorModel(createTree(now), from.advisor.model))
  const running = from.agents.filter(n => n.status === 'running')
  const alive = runningIds(from)
  const gone = (id: string) => !alive.has(id)
  const old = choicesOf(from)
  const fresh: AgentTreeState = {
    ...base,
    agents: running,
    choices: { ...choicesOf(base), agents: without(old.agents, gone), efforts: without(old.efforts ?? {}, gone) },
    ...(from.stopping ? { stopping: from.stopping.filter(id => alive.has(id)) } : {}),
    ...(from.stopSent ? { stopSent: from.stopSent.filter(id => alive.has(id)) } : {}),
    ...(from.corrections ? { corrections: without(from.corrections, gone) } : {}),
  }
  return from.main.limits ? withLimits(fresh, from.main.limits) : fresh
}

export function resetTime(kind: string, iso: string | undefined, locale: string): string | undefined {
  const at = iso === undefined ? Number.NaN : Date.parse(iso)
  if (!Number.isFinite(at)) return undefined
  try {
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
    return kind === 'five_hour' ? time : `${new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(at)} ${time}`
  } catch {
    return undefined
  }
}

export function synced(s: AgentTreeState, list: readonly { id: string; status: string }[], now: number): AgentTreeState {
  let next = s
  for (const entry of list) {
    const status = ENGINE_STATUS[entry.status]
    const node = findAgent(next, entry.id)
    if (!status || !node || node.status !== 'running') continue
    const final = status === 'done' && wasStopSent(next, entry.id) ? 'stopped' : status
    next = withAgent(withoutStop(next, entry.id), entry.id, n => ({ ...n, status: final, endedAt: n.endedAt ?? now }))
  }
  return next
}

export type ListedAgent = { id: string; description: string; type: string; status: string; parentId?: string }

const LISTED_STATUS: Record<string, AgentTreeStatus> = {
  pending: 'running',
  running: 'running',
  waiting: 'running',
  idle: 'running',
  completed: 'done',
  failed: 'failed',
  killed: 'stopped',
}

export function adopted(s: AgentTreeState, list: readonly ListedAgent[], now: number): AgentTreeState {
  const known = new Set(s.agents.map(n => n.id))
  const fresh: AgentTreeNode[] = []
  for (const entry of list) {
    const status = LISTED_STATUS[entry.status]
    if (status !== 'running' || known.has(entry.id)) continue
    known.add(entry.id)
    fresh.push({
      id: entry.id,
      parentId: entry.parentId,
      type: entry.type,
      description: cut(oneLine(entry.description), DESCRIPTION_LIMIT),
      background: false,
      fork: false,
      status,
      startedAt: now,
      endedAt: status === 'running' ? undefined : now,
      toolCount: 0,
    })
  }
  if (fresh.length === 0) return s
  const next: AgentTreeState = { ...s, startedAt: s.startedAt || now, agents: [...s.agents, ...fresh] }
  return logged(next, 'agent', 'adopted', { count: fresh.length }, now)
}

export function trimmed(s: AgentTreeState, maxAgents: number): AgentTreeState {
  const limit = Math.max(1, Math.floor(maxAgents))
  if (s.agents.length <= limit) return s
  const finished = s.agents
    .filter(n => n.status !== 'running')
    .sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt))
  const dropped = new Set(finished.slice(0, s.agents.length - limit).map(n => n.id))
  const gone = (id: string) => dropped.has(id)
  const choices = s.choices && {
    ...s.choices,
    agents: without(s.choices.agents, gone),
    ...(s.choices.efforts ? { efforts: without(s.choices.efforts, gone) } : {}),
    picker: s.choices.picker && dropped.has(s.choices.picker) ? undefined : s.choices.picker,
  }
  return {
    ...s,
    choices,
    detail: s.detail && dropped.has(s.detail.agentId) ? undefined : s.detail,
    corrections: s.corrections && without(s.corrections, gone),
    agents: s.agents.filter(n => !dropped.has(n.id)),
  }
}

export function groups(s: AgentTreeState): AgentTreeGroup[] {
  const all: AgentTreeGroup[] = []
  const runs = new Map<string, WorkflowGroup>()
  for (const node of s.agents) {
    if (node.workflowRunId === undefined) {
      all.push({ kind: 'agent', node })
      continue
    }
    let run = runs.get(node.workflowRunId)
    if (!run) {
      run = {
        kind: 'workflow',
        runId: node.workflowRunId,
        size: 0,
        running: 0,
        done: 0,
        failed: 0,
        stopped: 0,
        startedAt: node.startedAt,
        lastDescription: '',
      }
      runs.set(node.workflowRunId, run)
      all.push(run)
    }
    run.size += 1
    run[node.status] += 1
    run.lastDescription = node.description
  }
  const isRunning = (g: AgentTreeGroup) => (g.kind === 'agent' ? g.node.status === 'running' : g.running > 0)
  const recency = (g: AgentTreeGroup) => (g.kind === 'agent' ? g.node.endedAt ?? g.node.startedAt : g.startedAt)
  return [...all.filter(isRunning), ...all.filter(g => !isRunning(g)).sort((a, b) => recency(b) - recency(a))]
}

function decimal(value: number, digits: number, separator: string): string {
  return value.toFixed(digits).replace(/\.0$/, '').replace('.', separator)
}

export function fmtTokens(n: number | undefined, separator = ','): string {
  if (n === undefined || !Number.isFinite(n)) return ''
  if (n < 1000) return String(Math.round(n))
  const thousands = n / 1000
  const thousandDigits = thousands < 100 ? 1 : 0
  if (Number(thousands.toFixed(thousandDigits)) < 1000) return `${decimal(thousands, thousandDigits, separator)}k`
  const millions = n / 1_000_000
  return `${decimal(millions, millions < 100 ? 1 : 0, separator)}M`
}

export function fmtShortDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
  return `${Math.floor(minutes / 60)} h ${minutes % 60}`
}

export function typeLabel(type: string): string {
  return type.split(':').at(-1) || type
}

export function fmtDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}:${String(seconds % 60).padStart(2, '0')} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function effortBar(effort: string | number | undefined): string {
  const level = (EFFORT_LEVELS as readonly string[]).indexOf(String(effort ?? '')) + 1
  if (level === 0) return ''
  return '▮'.repeat(level) + '▯'.repeat(EFFORT_LEVELS.length - level)
}

let clockFormat: Intl.DateTimeFormat | undefined

export function clockTime(ms: number): string {
  try {
    clockFormat ??= new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    return clockFormat.format(ms)
  } catch {
    return new Date(ms).toISOString().slice(11, 19)
  }
}

export function estimateTokens(text: string | undefined): number {
  return Math.ceil((text ?? '').length / 4)
}

export function modelLabel(model: string | undefined): string {
  if (!model) return ''
  const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
  const plain = model.replace(/\[[^\]]*\]$/, '')
  const modern = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(plain)
  if (modern) return `${capital(modern[1] ?? '')} ${modern[2]}${modern[3] ? `.${modern[3]}` : ''}`
  const legacy = /claude-(\d+)(?:-(\d+))?-([a-z]+)/.exec(plain)
  if (legacy) return `${capital(legacy[3] ?? '')} ${legacy[1]}${legacy[2] ? `.${legacy[2]}` : ''}`
  if (/^[a-z]+$/.test(plain)) return capital(plain)
  return model
}

const BARE_TOOLS = new Set(['Grep', 'Glob', 'WebSearch', 'ToolSearch', 'SubagentHandback'])

export function toolLabel(tool: string, input: Record<string, unknown>): string {
  const text = (value: unknown) => (typeof value === 'string' ? oneLine(value) : '')
  const fileName = (value: unknown) => text(value).split(/[\\/]/).filter(Boolean).at(-1) ?? ''
  const program = (value: unknown) =>
    fileName(text(typeof value === 'string' ? value.trimStart().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '') : value).split(' ')[0])
  const host = (value: unknown) => {
    try {
      return new URL(text(value)).host
    } catch {
      return ''
    }
  }
  const detail = BARE_TOOLS.has(tool)
    ? ''
    : text(input.description) ||
      fileName(input.file_path) ||
      fileName(input.notebook_path) ||
      program(input.command) ||
      text(input.skill) ||
      host(input.url)
  return cut(detail ? `${tool} ${detail}` : tool, LABEL_LIMIT)
}
