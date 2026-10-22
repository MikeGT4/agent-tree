// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentTreeState } from '../types'
import {
  NEW_AGENTS,
  adopted,
  choicesOf,
  chosen,
  completed,
  counts,
  createTree,
  measured,
  phaseOf,
  pickerOpened,
  spawned,
  stepModelFor,
  stepped,
  synced,
  toolLabel,
  toolRan,
  trimmed,
  turnStarted,
  withAdvisorModel,
} from './model.ts'
import { drawTree, statusText } from './view.tsx'

const PANE = 'agent-tree'
const COMMAND = 'agent-tree'
const TITLE = 'Agent Tree'
const SHAPE = 'agent-tree-1'
const INLINE_ROWS = 40
const FRAME_MS = 250

const tree = atom({ plugin: 'agent-tree', key: 'tree' } as const, createTree(0), { shape: SHAPE })
const frame = atom({ plugin: 'agent-tree', key: 'frame' } as const, 0)

let ticker: Timer | undefined
let animate = true

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

async function clock($: EngineInterface): Promise<number> {
  return $.clock.now().catch(() => Date.now())
}

async function change($: EngineInterface, apply: (s: AgentTreeState) => AgentTreeState): Promise<void> {
  const next = await update($, tree, apply)
  $.ui.status(statusText(next))
  keepTicking($, next)
}

async function catchUp($: EngineInterface, now: number, keep: number): Promise<void> {
  const list = await $.agent.list().catch(() => [])
  await change($, s => trimmed(synced(adopted(s, list, now), list, now), keep))
}

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)
  const keep = agentLimit(options.maxAgents)
  const openOnStart = options.openOnStart === true
  animate = options.animate !== false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command
      .register({ name: COMMAND, description: 'Agentenbaum der Sitzung als Kästen (stop, clear)', argumentHint: '[stop|clear]', immediate: true })
      .catch(() => undefined)
    const advisorModel = await $.settings.read({ key: 'advisorModel' }).catch(() => undefined)
    await change($, s => withAdvisorModel(s, typeof advisorModel === 'string' ? advisorModel : undefined)).catch(() => undefined)
    await catchUp($, await clock($), keep).catch(() => undefined)
    if (openOnStart) await $.ui.open({ id: PANE, title: TITLE, columns, rows: INLINE_ROWS }).catch(() => undefined)
    return result
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return { text: `${TITLE} geschlossen` }
    }
    const now = await clock($)
    if (arg === 'clear') {
      await change($, s => withAdvisorModel(createTree(now), s.advisor.model))
      return { text: `${TITLE} geleert` }
    }
    await catchUp($, now, keep)
    try {
      await $.ui.open({ id: PANE, title: TITLE, focus: true, columns, rows: INLINE_ROWS })
    } catch (err) {
      return { text: `${TITLE}: Leiste nicht geöffnet: ${String(err)}` }
    }
    const s = await read($, tree)
    return { text: `${TITLE} geöffnet · ${s.agents.length} Agenten bisher · /${COMMAND} stop schließt` }
  }).catch(() => ({ text: `${TITLE}: Befehl gescheitert` }))

  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    const now = await clock($)
    await change($, s => turnStarted(s, { text: e.text, agentId: e.agentId }, now)).catch(() => undefined)
    return result
  })

  on('turn.step', async function* ($, e, next) {
    const before = e.agentId ? await read($, tree) : undefined
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
      stepped(s, { agentId: e.agentId, model: model ?? e.model, effort: e.effort, contextTokens, advisorUses }, now),
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
    if (e.changed.includes('context')) {
      await change($, s => measured(s, { tokens: e.context.tokens, window: e.context.window, percent: e.context.percent })).catch(
        () => undefined,
      )
    }
    return result
  })

  on('session.end', async ($, e, next) => {
    const reset =
      e.reason === 'clear' || e.reason === 'resume'
        ? change($, s => withAdvisorModel(createTree(Date.now()), s.advisor.model)).catch(() => undefined)
        : Promise.resolve()
    const result = await next(e)
    await reset
    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, tree)
    const tick = animate ? await read($, frame) : 0
    const actions = {
      pick: (target: string) => void change($, t => pickerOpened(t, target)).catch(() => undefined),
      choose: (family: string | undefined) =>
        void change($, t => chosen(t, choicesOf(t).picker ?? NEW_AGENTS, family, Date.now())).catch(() => undefined),
      close: () => void change($, t => pickerOpened(t, undefined)).catch(() => undefined),
    }
    return drawTree({ Box, Text, Button } as never, s, e.props.bodyColumns, e.props.scroll?.bodyRows, {
      frame: tick,
      animate,
      actions,
    })
  })
}
