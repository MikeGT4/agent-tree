// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { Elements, RenderChildren } from 'claude-code'

import type {
  AgentTreeAdvisorCall,
  AgentTreeCorrectionState,
  AgentTreeGroup,
  AgentTreeLogSource,
  AgentTreeLook,
  AgentTreeNode,
  AgentTreeState,
  AgentTreeStatus,
} from '../types'
import {
  EFFORT_LEVELS,
  MODEL_FAMILIES,
  NEW_AGENTS,
  choicesOf,
  clockTime,
  counts,
  effortBar,
  effortLabel,
  familyLabel,
  fmtShortDuration,
  fmtTokens,
  groups,
  modelLabel,
  phaseOf,
  typeLabel,
} from './model.ts'
import { LOOK_OPTIONS, LOOK_ROWS, PALETTES, STYLES, frameEdges, isLookChoice, lightColor, lookFrom, restyleLine } from './looks.ts'
import type { Glyphs, LookRow, Palette } from './looks.ts'
import { WORDS, familyOr, logLine, lookOptionLabel, toolText, wordsFor } from './words.ts'
import type { Lang, Words } from './words.ts'

export { WORDS, logLine, wordsFor }
export type { Lang }

type Ui = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'> & { Input?: Elements['terminal']['Input'] }

export const WIDE_FROM = 84
export const TIGHT_BELOW = 36
export const ADVISOR_WIDTH = 20
export const AGENT_WIDTH = 19
export const AGENT_GAP = 2
export const MAIN_WIDTH = 31
export const BACK_WIDTH = 35
export const MAX_GROUPS = 9
export const MAX_ROWS = 12
export const LOG_ROWS = 6
export const MIN_LOG_ROWS = 2
export const ADVISOR_ROWS = 4
export const ADVISOR_BASE_ROWS = 15
export const ADVISOR_COMPACT_ROWS = 4
export const LEGEND_EFFORT_FROM = 60
export const BAR_WIDTH = 15
export const DETAIL_ROWS = 11
export const LIGHT_SAMPLE = 9

const SIZE = { title: 'heading', detail: 'footnote', note: 'caption' } as const

const CORRECTION_MARK: Partial<Record<AgentTreeCorrectionState, string>> = { sent: '✉', read: '✓' }

function correctionGlyph(s: AgentTreeState, agentId: string): string {
  const state = s.corrections?.[agentId]?.state
  return (state ? CORRECTION_MARK[state] : undefined) ?? ''
}

export function statusWithMark(head: string, mark: string, tail: string, width: number): string {
  if (!mark) return head + tail
  if ([...head].length + 1 + [...mark].length <= width) return `${head} ${mark}${tail}`
  return `${clip(head, width - [...mark].length)}${mark}`
}

export function runningMark(frame: number, animate: boolean, spinner: readonly string[] = STYLES.line.spinner): string {
  const first = spinner[0] ?? '◐'
  if (!animate || spinner.length === 0) return first
  return spinner[((frame % spinner.length) + spinner.length) % spinner.length] ?? first
}

function statusMark(glyphs: Glyphs, status: AgentTreeStatus): string {
  return status === 'running' ? runningMark(0, false, glyphs.spinner) : glyphs.marks[status]
}

function statusColor(palette: Palette, status: AgentTreeStatus): string {
  return status === 'running' ? palette.agent : status === 'done' ? palette.done : status === 'failed' ? palette.failed : palette.dim
}

function sourceColor(palette: Palette, source: AgentTreeLogSource): string {
  return source === 'session' ? palette.dim : palette[source]
}

export type TreeActions = {
  pick: (target: string) => void
  choose: (target: string, family: string | undefined) => void
  effort: (target: string, effort: string | undefined) => void
  close: () => void
  detail: (agentId: string) => void
  stop: (agentId: string) => void
  say: (agentId: string, text: string) => void
  advisor: () => void
  look: () => void
  restyle: (row: LookRow, id: string) => void
  restyleDefault: () => void
}

export type TreeLook = {
  frame: number
  animate: boolean
  now?: number
  lang?: Lang
  actions?: TreeActions
  appearance?: AgentTreeLook
  canAdvise?: boolean
}

export function pressKey(actions: TreeActions, key: string): boolean {
  const cut = key.indexOf(':')
  if (cut < 0) return false
  const kind = key.slice(0, cut)
  const rest = key.slice(cut + 1)
  if (key === 'picker:close' || key === 'detail:close' || key === 'look:close') actions.close()
  else if (key === 'advisor:toggle') actions.advisor()
  else if (kind === 'look') return lookKey(actions, rest)
  else if (kind === 'pick') actions.pick(rest)
  else if (kind === 'choose') return chooseKey(actions, rest)
  else if (kind === 'detail') actions.detail(rest)
  else if (kind === 'stop' || kind === 'halt') actions.stop(rest)
  else return false
  return true
}

export function inputKey(actions: TreeActions, element: string, kind: string, value: string): boolean {
  if (kind !== 'submit' || !element.startsWith('say:')) return false
  const rest = element.slice('say:'.length)
  const cut = rest.lastIndexOf(':')
  if (cut < 1) return false
  actions.say(rest.slice(0, cut), value)
  return true
}

function chooseKey(actions: TreeActions, rest: string): boolean {
  const cut = rest.lastIndexOf(':')
  if (cut < 1 || cut + 1 >= rest.length) return false
  const family = rest.slice(cut + 1)
  actions.choose(rest.slice(0, cut), family === 'default' ? undefined : family)
  return true
}

function lookKey(actions: TreeActions, rest: string): boolean {
  if (rest === 'open') actions.look()
  else if (rest === 'default') actions.restyleDefault()
  else {
    const cut = rest.indexOf(':')
    const row = rest.slice(0, cut)
    const id = rest.slice(cut + 1)
    if (cut < 1 || !isLookChoice(row, id)) return false
    actions.restyle(row, id)
  }
  return true
}

const GLYPH: Record<string, string> = {
  udlr: '┼',
  udl: '┤',
  udr: '├',
  ud: '│',
  ulr: '┴',
  ul: '┘',
  ur: '└',
  u: '│',
  dlr: '┬',
  dl: '┐',
  dr: '┌',
  d: '│',
  lr: '─',
  l: '─',
  r: '─',
}

export function statusText(s: AgentTreeState, lang: Lang = 'de'): string | undefined {
  const w = wordsFor(lang)
  const c = counts(s)
  if (c.running + c.done + c.failed + c.stopped === 0 && s.advisor.total === 0) return undefined
  const parts = [`${w.agents} [${c.running}/${c.running + c.done + c.failed + c.stopped}]`]
  if (c.failed) parts.push(`${c.failed} ${w.status.failed}`)
  if (c.stopped) parts.push(`${c.stopped} ${w.status.stopped}`)
  if (s.advisor.total) parts.push(`${w.advisorShort} [${s.advisor.total}×]`)
  if (s.main.percent !== undefined) parts.push(`${w.contextShort} [${w.percent(s.main.percent)}]`)
  if (s.main.costUsd !== undefined) parts.push(w.cost(s.main.costUsd))
  return parts.join(' · ')
}

export type RowPlanInput = {
  height?: number
  wide: boolean
  tight: boolean
  asRows: boolean
  perRow: number
  total: number
  advisorRows: number
  earlier: boolean
  pickerRows?: number
  detailRows?: number
  helpRows?: number
  labelRows?: number
}

export type RowPlan = { shown: number; logRows: number }

function treeRows(o: RowPlanInput, shown: number): number {
  const top = 7 + 1
  const label = Math.max(1, o.labelRows ?? 1)
  const later = o.earlier ? 1 : 0
  if (o.total === 0) return top + label + later
  const hidden = shown < o.total ? 1 : 0
  const back = 1 + 5 + hidden + later
  if (o.asRows) return top + label + shown + back
  const boxRows = Math.ceil(shown / o.perRow)
  return top + 3 + label + (10 * boxRows - 1) + 1 + back
}

function usedRows(o: RowPlanInput, shown: number, logRows: number): number {
  const header = (o.tight ? 1 : 3) + (o.pickerRows ?? 0)
  const tree = treeRows(o, shown)
  const body = o.wide ? Math.max(o.advisorRows, tree) : o.advisorRows + tree
  return header + 1 + body + (o.detailRows ?? 0) + 4 + logRows + (o.helpRows ?? 0)
}

export function planRows(o: RowPlanInput): RowPlan {
  const cap = Math.min(o.total, o.asRows ? MAX_ROWS : MAX_GROUPS)
  if (o.height === undefined) return { shown: cap, logRows: LOG_ROWS }
  let shown = Math.min(1, cap)
  for (let candidate = cap; candidate >= 1; candidate--) {
    if (usedRows(o, candidate, MIN_LOG_ROWS) <= o.height) {
      shown = candidate
      break
    }
  }
  const logRows = Math.max(1, Math.min(LOG_ROWS, o.height - usedRows(o, shown, 0)))
  return { shown, logRows }
}

function oddFloor(n: number): number {
  return n % 2 === 0 ? n - 1 : n
}

function rowWidth(boxes: number): number {
  return boxes * AGENT_WIDTH + Math.max(0, boxes - 1) * AGENT_GAP + (boxes % 2 === 0 ? 1 : 0)
}

function boxGap(boxes: number, index: number): number {
  if (index === 0) return 0
  return AGENT_GAP + (boxes % 2 === 0 && index === boxes / 2 ? 1 : 0)
}

function rowCenters(boxes: number, offset: number): number[] {
  const result: number[] = []
  let left = offset
  for (let i = 0; i < boxes; i++) {
    left += boxGap(boxes, i)
    result.push(left + (AGENT_WIDTH - 1) / 2)
    left += AGENT_WIDTH
  }
  return result
}

export function connector(width: number, points: readonly number[], join: number, kind: 'split' | 'merge', step?: number): string {
  const lo = Math.min(join, ...points)
  const hi = Math.max(join, ...points)
  const flow = (p: number): string | undefined => {
    if (step === undefined || p === join) return undefined
    const arm = p < join ? join - lo - 1 : hi - join - 1
    if (arm < 2) return undefined
    const out = p < join ? join - p : p - join
    const head = kind === 'split' ? (step % arm) + 1 : arm - (step % arm)
    const tail = kind === 'split' ? head - 1 : head + 1
    return out === head ? '•' : out === tail && tail >= 1 && tail <= arm ? '·' : undefined
  }
  let line = ''
  for (let p = 0; p < width; p++) {
    if (p < lo || p > hi) {
      line += ' '
      continue
    }
    const atPoint = points.includes(p)
    const up = kind === 'split' ? p === join : atPoint
    const down = kind === 'split' ? atPoint : p === join
    const key = `${up ? 'u' : ''}${down ? 'd' : ''}${p > lo ? 'l' : ''}${p < hi ? 'r' : ''}`
    line += (key === 'lr' ? flow(p) : undefined) ?? GLYPH[key] ?? ' '
  }
  return line
}

export function timelineBar(
  start: number,
  end: number,
  from: number,
  to: number,
  width = BAR_WIDTH,
  cells: Glyphs['bar'] = STYLES.line.bar,
): string {
  if (!(to > from)) return cells.full.repeat(width)
  const scale = (t: number) => Math.round(((Math.min(Math.max(t, from), to) - from) / (to - from)) * width)
  const a = Math.min(width - 1, scale(start))
  const b = Math.max(a + 1, scale(end))
  return cells.empty.repeat(a) + cells.full.repeat(b - a) + cells.empty.repeat(width - b)
}

export const LIGHT_CELLS = 3

export function litCells(size: number, frame: number, length = LIGHT_CELLS): number[] {
  if (size <= 0) return []
  const head = ((frame % size) + size) % size
  const lit = new Set<number>()
  for (let k = 0; k < Math.min(length, size); k++) lit.add((head - k + size) % size)
  return [...lit].sort((a, b) => a - b)
}

export function shimmer(line: string, frame: number, cells: Glyphs['bar'] = STYLES.line.bar): string {
  const chars = [...line]
  if (chars.length === 0) return line
  const at = ((frame % chars.length) + chars.length) % chars.length
  return chars.map((c, i) => (i === at ? (c === cells.full ? cells.litFull : cells.litEmpty) : c)).join('')
}

function marks(width: number, points: readonly number[], glyph: string): string {
  return Array.from({ length: width }, (_, p) => (points.includes(p) ? glyph : ' ')).join('')
}

function mostCommon(values: readonly (string | undefined)[]): string | undefined {
  const tally = new Map<string, number>()
  for (const v of values) if (v) tally.set(v, (tally.get(v) ?? 0) + 1)
  let best: string | undefined
  for (const [v, n] of tally) if (best === undefined || n > (tally.get(best) ?? 0)) best = v
  return best
}

function effortCells(effort: string | undefined, glyphs: Glyphs): string {
  return [...effortBar(effort)].map(cell => (cell === '▮' ? glyphs.effort[0] : glyphs.effort[1])).join('')
}

function effortLine(effort: string | undefined, glyphs: Glyphs): string {
  if (!effort) return ' '
  const bar = effortCells(effort, glyphs)
  return bar ? `${bar} ${effort}` : `Effort ${effort}`
}

function contextLine(s: AgentTreeState, w: Words): string {
  const { contextTokens, window, percent } = s.main
  const share = percent !== undefined ? w.percent(percent) : ''
  if (contextTokens === undefined) return share ? `${w.context} ${share}` : w.contextNone
  const amount = window ? `${fmtTokens(contextTokens, w.decimal)} / ${fmtTokens(window, w.decimal)}` : fmtTokens(contextTokens, w.decimal)
  return `${w.context} ${amount}${share ? ` · ${share}` : ''}`
}

function isRunning(g: AgentTreeGroup): boolean {
  return g.kind === 'agent' ? g.node.status === 'running' : g.running > 0
}

function startOf(g: AgentTreeGroup): number {
  return g.kind === 'agent' ? g.node.startedAt : g.startedAt
}

function endedSince(g: AgentTreeGroup, since: number): boolean {
  return g.kind === 'agent' && g.node.endedAt !== undefined && g.node.endedAt >= since
}

function parentOf(s: AgentTreeState, n: AgentTreeNode): string | undefined {
  if (n.parentId === undefined) return undefined
  const parent = s.agents.find(p => p.id === n.parentId)
  return parent ? typeLabel(parent.type) : '?'
}

function callPlace(call: AgentTreeAdvisorCall, w: Words): string {
  return call.agentId === undefined ? w.fromMain : w.fromSub
}

export function pickerLines(name: string, width: number, lang: Lang = 'de', running = false): number {
  const w = wordsFor(lang)
  const models = wrappedLines([w.pickerFor(name), `[ ${w.standard} ]`, ...MODEL_FAMILIES.map(family => `[ ${familyLabel(family)} ]`), '[ × ]'], width)
  const efforts = wrappedLines([w.effortFor, `[ ${w.standard} ]`, ...EFFORT_LEVELS.map(level => `[ ${effortLabel(level)} ]`)], width)
  return models + efforts + (running ? wrappedLines([w.effortNextMessage], width) : 0)
}

function lookLabelWidth(w: Words): number {
  return Math.max(...LOOK_ROWS.map(row => w.lookRow[row].length))
}

export function lookLines(width: number, lang: Lang = 'de'): number {
  const w = wordsFor(lang)
  const label = ' '.repeat(lookLabelWidth(w))
  const rows = LOOK_ROWS.map(row =>
    wrappedLines(
      [
        label,
        ...(LOOK_OPTIONS[row] as readonly string[]).map(id => `[ ${lookOptionLabel(w, row, id)} ]`),
        ...(row === 'light' ? [' '.repeat(LIGHT_SAMPLE)] : []),
      ],
      width,
    ),
  )
  return 2 + rows.reduce((sum, n) => sum + n, 0) + wrappedLines([`[ ${w.lookReset} ]`, '[ × ]'], width)
}

function wrappedLines(parts: readonly string[], width: number, gap = 1): number {
  let lines = 1
  let used = 0
  for (const part of parts) {
    const need = used === 0 ? part.length : used + gap + part.length
    if (need > width && used > 0) {
      lines += 1
      used = part.length
    } else {
      used = need
    }
  }
  return lines
}

export function clip(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size))
  return rows
}

export function helpLine(items: readonly string[], width: number): string {
  let line = items[0] ?? ''
  for (const item of items.slice(1)) {
    const next = `${line} · ${item}`
    if (next.length > width) break
    line = next
  }
  return line
}

export function drawTree(ui: Ui, s: AgentTreeState, width: number, height?: number, look: TreeLook = { frame: 0, animate: false }) {
  const { Box, Text, Button, Input } = ui
  const lang: Lang = look.lang ?? 'de'
  const w = wordsFor(lang)
  const appearance = lookFrom(look.appearance)
  const palette = PALETTES[appearance.colors]
  const glyphs = STYLES[appearance.style]
  const light = lightColor(appearance)
  const spin = runningMark(look.frame, look.animate, glyphs.spinner)
  const choices = choicesOf(s)
  const actions = look.actions
  const now = look.now ?? Date.now()
  const detail = s.detail
  const tight = height !== undefined && height < TIGHT_BELOW
  const wide = width >= WIDE_FROM && !tight
  const treeWidth = Math.max(1, oddFloor(wide ? width - ADVISOR_WIDTH - 2 : width))
  const perRow = Math.max(1, Math.floor((treeWidth + AGENT_GAP) / (AGENT_WIDTH + AGENT_GAP)))
  const asRows = tight || perRow < 2
  const mainWidth = Math.min(MAIN_WIDTH, treeWidth)
  const backWidth = Math.min(BACK_WIDTH, treeWidth)
  const phase = phaseOf(s)
  const roundStart = s.main.roundStartedAt ?? 0
  const all = groups(s)
  const endedThisRound = (g: AgentTreeGroup) =>
    g.kind === 'agent'
      ? endedSince(g, roundStart)
      : g.running === 0 && s.agents.some(n => n.workflowRunId === g.runId && (n.endedAt ?? 0) >= roundStart)
  const current = all.filter(g => isRunning(g) || startOf(g) >= roundStart || endedThisRound(g))
  const earlier = all.length - current.length
  const recentCalls = s.advisor.calls.slice(-ADVISOR_ROWS)
  const pickerTarget = choices.picker
  const pickerNode = pickerTarget && pickerTarget !== NEW_AGENTS ? s.agents.find(n => n.id === pickerTarget) : undefined
  const pickerName = pickerTarget === NEW_AGENTS ? w.newAgents : pickerNode ? `${typeLabel(pickerNode.type)} · ${pickerNode.description}` : '?'
  const detailNode = detail ? s.agents.find(n => n.id === detail.agentId) : undefined
  const agentEffort =
    mostCommon(s.agents.filter(n => n.status === 'running').map(n => n.effort)) ?? mostCommon(s.agents.map(n => n.effort))
  const plan = planRows({
    height,
    wide,
    tight,
    asRows,
    perRow,
    total: current.length,
    advisorRows: wide ? ADVISOR_BASE_ROWS + recentCalls.length : ADVISOR_COMPACT_ROWS,
    earlier: earlier > 0,
    pickerRows: (pickerTarget && actions ? 1 + pickerLines(pickerName, width, lang, pickerTarget !== NEW_AGENTS) : 0) + (s.lookOpen && actions ? lookLines(width, lang) : 0),
    detailRows: detailNode && actions ? DETAIL_ROWS : 0,
    helpRows: tight ? 0 : 1,
    labelRows: actions
      ? wrappedLines(
          [
            current.length ? `${glyphs.node} ${w.toAgents}` : w.noAgents,
            ` · m: ${w.subModel}: ${familyOr(choices.newAgents, w.standard)}${choices.newEffort ? ` · ${effortLabel(choices.newEffort)}` : ''} ▾`,
            ` · a: ${w.look} ▾`,
          ],
          treeWidth,
          0,
        )
      : 1,
  })
  const detailAt = detail ? current.findIndex(g => g.kind === 'agent' && g.node.id === detail.agentId) : -1
  const shown =
    detailAt >= plan.shown && plan.shown > 0
      ? [...current.slice(0, plan.shown - 1), current[detailAt] as AgentTreeGroup]
      : current.slice(0, plan.shown)
  const rest = current.filter(g => !shown.includes(g))
  const hiddenRunning = rest.filter(isRunning).length
  const mainModel = modelLabel(s.main.model)
  const advisorModel = modelLabel(s.advisor.model)
  const lastCall = s.advisor.calls.at(-1)
  const consulted = lastCall !== undefined && lastCall.at >= roundStart && roundStart > 0
  const legendEffort = width >= LEGEND_EFFORT_FROM
  const groupEnd = (g: AgentTreeGroup) => {
    if (g.kind === 'agent') return g.node.endedAt ?? now
    const members = s.agents.filter(n => n.workflowRunId === g.runId)
    return members.some(n => n.status === 'running') ? now : Math.max(...members.map(n => n.endedAt ?? n.startedAt))
  }
  const spanFrom = current.length ? Math.min(...current.map(startOf)) : now
  const spanTo = current.length ? Math.max(...current.map(groupEnd)) : now

  const bar = (g: AgentTreeGroup) => timelineBar(startOf(g), groupEnd(g), spanFrom, spanTo, BAR_WIDTH, glyphs.bar)

  const streakLine = (line: string, tint: string, at: number) => {
    if (!light) return <Text color={tint}>{shimmer(line, at, glyphs.bar)}</Text>
    const cells = [...line]
    const lit = new Set(litCells(cells.length, at))
    const runs: { text: string; lit: boolean }[] = []
    cells.forEach((cell, i) => {
      const last = runs.at(-1)
      if (last && last.lit === lit.has(i)) last.text += cell
      else runs.push({ text: cell, lit: lit.has(i) })
    })
    return (
      <Text color={tint}>
        {runs.map((run, i) => (run.lit ? <Text key={`lit:${i}`} color={light}>{run.text}</Text> : run.text))}
      </Text>
    )
  }

  const barLine = (line: string, tint: string, lit: boolean) => (lit ? streakLine(line, tint, look.frame) : <Text color={tint}>{line}</Text>)

  const sideRows = height ?? 60

  const frameProps = (color: string, strong = false) =>
    glyphs.border
      ? { borderStyle: strong ? (glyphs.strongBorder ?? glyphs.border) : glyphs.border, borderColor: color }
      : { paddingX: 1, paddingY: 1 }

  const frameParts = (key: string, boxWidth: number, color: string, strong = false) => {
    if (glyphs.border) return null
    const { top, bottom } = frameEdges(glyphs, boxWidth)
    const column = (glyph: string) => Array.from({ length: sideRows }, () => glyph).join('\n')
    const side = (edge: 'left' | 'right', glyph: string) =>
      glyph.trim() ? (
        <Box key={`${key}:${edge}`} position="absolute" top={1} bottom={1} left={edge === 'left' ? 0 : undefined} right={edge === 'right' ? 0 : undefined} width={1} overflow="hidden">
          <Text color={color} bold={strong}>{column(glyph)}</Text>
        </Box>
      ) : null
    return [
      <Box key={`${key}:top`} position="absolute" top={0} left={0} width={boxWidth} height={1} overflow="hidden">
        <Text color={color} bold={strong}>{top}</Text>
      </Box>,
      <Box key={`${key}:bottom`} position="absolute" bottom={0} left={0} width={boxWidth} height={1} overflow="hidden">
        <Text color={color} bold={strong}>{bottom}</Text>
      </Box>,
      side('left', glyphs.frame.l),
      side('right', glyphs.frame.r),
    ]
  }

  const typeButton = (n: AgentTreeNode, running: boolean) =>
    actions ? (
      <Box key={`type-row:${n.id}`} width={AGENT_WIDTH - 2} flexDirection="row" justifyContent="center">
        <Button key={`detail:${n.id}`} plain label={clip(typeLabel(n.type), AGENT_WIDTH - 2)} onPress={() => actions.detail(n.id)} />
      </Box>
    ) : (
      <Text bold size={SIZE.title} color={running ? palette.agent : undefined} wrap="truncate-end">
        {typeLabel(n.type)}
      </Text>
    )

  const agentBox = (g: AgentTreeGroup, marginLeft: number) => {
    if (g.kind === 'workflow') {
      const color = g.running > 0 ? palette.agent : g.failed > 0 ? palette.failed : palette.dim
      return (
        <Box key={`wf:${g.runId}`} width={AGENT_WIDTH} marginLeft={marginLeft} {...frameProps(color)} flexDirection="column" alignItems="center">
          <Text bold size={SIZE.title} color={g.running > 0 ? palette.agent : undefined} wrap="truncate-end">
            {`Workflow · ${g.size}`}
          </Text>
          <Text size={SIZE.detail} color={palette.agent} wrap="truncate-end">
            {`${spin} ${w.running(g.running)}`}
          </Text>
          <Text size={SIZE.detail} color={palette.done} wrap="truncate-end">{`${glyphs.marks.done} ${g.done} ${w.done}`}</Text>
          <Text size={SIZE.detail} color={g.failed ? palette.failed : palette.dim} wrap="truncate-end">
            {`${glyphs.marks.failed} ${g.failed} ${w.status.failed}`}
          </Text>
          <Text size={SIZE.detail} wrap="truncate-end">{g.lastDescription || ' '}</Text>
          <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
            {g.stopped ? `${glyphs.marks.stopped} ${g.stopped} ${w.status.stopped}` : ' '}
          </Text>
          {barLine(bar(g), color, g.running > 0 && look.animate)}
          {frameParts(`wf:${g.runId}`, AGENT_WIDTH, color)}
        </Box>
      )
    }
    const n = g.node
    const running = n.status === 'running'
    const nested = parentOf(s, n)
    const stopping = (s.stopping ?? []).includes(n.id)
    const mark = correctionGlyph(s, n.id)
    const inner = AGENT_WIDTH - 2
    const statusLine =
      n.status === 'running'
        ? stopping
          ? statusWithMark(`${spin} ${w.stopping}`, mark, '', inner)
          : statusWithMark(`${spin} ${w.status.running}`, mark, n.contextTokens ? ` · ${fmtTokens(n.contextTokens, w.decimal)}` : '', inner)
        : n.status === 'done' && n.endedAt !== undefined
          ? statusWithMark(`${glyphs.marks.done} ${w.status.done}`, mark, ` · ${fmtShortDuration(n.endedAt - n.startedAt)}`, inner)
          : statusWithMark(`${statusMark(glyphs, n.status)} ${w.status[n.status]}`, mark, '', inner)
    const edge = running ? palette.agent : n.status === 'failed' ? palette.failed : palette.dim
    return (
      <Box key={`ag:${n.id}`} width={AGENT_WIDTH} marginLeft={marginLeft} {...frameProps(edge)} flexDirection="column" alignItems="center">
        {typeButton(n, running)}
        {running && actions ? (
          <Box key={`pick-row:${n.id}`} width={AGENT_WIDTH - 2} flexDirection="row" justifyContent="center" columnGap={1}>
            <Button
              key={`pick:${n.id}`}
              plain
              label={clip(`${choices.agents[n.id] ? `→ ${familyLabel(choices.agents[n.id])}` : modelLabel(n.model) || w.model} ▾`, AGENT_WIDTH - 5)}
              onPress={() => actions.pick(n.id)}
            />
            {stopping ? null : <Button key={`halt:${n.id}`} plain label="■" onPress={() => actions.stop(n.id)} />}
          </Box>
        ) : (
          <Text color={running ? undefined : palette.dim} wrap="truncate-end">
            {modelLabel(n.model) || ' '}
          </Text>
        )}
        <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
          {nested ? `↳ ${w.under} ${nested}` : effortLine(n.effort, glyphs)}
        </Text>
        <Text size={SIZE.detail} color={running ? undefined : palette.dim} wrap="truncate-end">
          {n.description || ' '}
        </Text>
        <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
          {toolText(n.lastTool, lang) ?? `${w.tools}: ${n.toolCount}`}
        </Text>
        <Text size={SIZE.detail} color={statusColor(palette, n.status)} wrap="truncate-end">
          {statusLine}
        </Text>
        {barLine(bar(g), statusColor(palette, n.status), running && look.animate)}
        {frameParts(`ag:${n.id}`, AGENT_WIDTH, edge)}
      </Box>
    )
  }

  const agentRow = (g: AgentTreeGroup) => {
    if (g.kind === 'workflow') {
      const color = g.running > 0 ? palette.agent : g.failed > 0 ? palette.failed : palette.dim
      const state =
        g.running > 0
          ? `${spin} ${w.running(g.running)}`
          : g.failed > 0
            ? `${glyphs.marks.failed} ${g.failed} ${w.status.failed}`
            : g.done > 0
              ? `${glyphs.marks.done} ${w.done}`
              : `${glyphs.marks.stopped} ${w.status.stopped}`
      return (
        <Box key={`wf:${g.runId}`} width={treeWidth}>
          <Text color={color} wrap="truncate-end">
            {`${state} · Workflow · ${g.size}`}
          </Text>
        </Box>
      )
    }
    const n = g.node
    const indent = parentOf(s, n) ? '↳ ' : ''
    const size = n.status === 'running' && n.contextTokens ? ` · ${fmtTokens(n.contextTokens, w.decimal)}` : ''
    const mark = correctionGlyph(s, n.id)
    const text = `${indent}${n.status === 'running' ? spin : statusMark(glyphs, n.status)} ${n.status === 'running' && (s.stopping ?? []).includes(n.id) ? w.stopping : w.status[n.status]}${mark ? ` ${mark}` : ''} · ${typeLabel(n.type)} · ${n.description}${size}`
    const halt = n.status === 'running' && actions && !(s.stopping ?? []).includes(n.id)
    return (
      <Box key={`ag:${n.id}`} width={treeWidth} flexDirection="row" columnGap={1}>
        {actions ? (
          <Button key={`detail:${n.id}`} plain label={clip(text, halt ? treeWidth - 2 : treeWidth)} onPress={() => actions.detail(n.id)} />
        ) : (
          <Text color={statusColor(palette, n.status)} wrap="truncate-end">
            {text}
          </Text>
        )}
        {halt ? <Button key={`halt:${n.id}`} plain label="■" onPress={() => actions.stop(n.id)} /> : null}
      </Box>
    )
  }

  const arrowRow = (key: string, boxWidth: number, box: RenderChildren) => {
    const side = Math.max(0, (treeWidth - boxWidth) / 2)
    const arrow = wide && side >= 3 ? `${glyphs.rail.h.repeat(side - 2)}${glyphs.rail.head} ` : ' '
    return (
      <Box key={key} flexDirection="row" width={treeWidth}>
        <Box width={side} flexShrink={0} flexDirection="column" justifyContent="center" alignItems="flex-end">
          <Text color={consulted ? palette.advisor : palette.dim}>{side > 0 ? arrow : ''}</Text>
        </Box>
        {box}
        <Box width={side} flexShrink={0} />
      </Box>
    )
  }

  const verb = phase === 'idle' ? w.idle : w.working
  const header = tight ? (
    <Box key="head" flexDirection="column" alignItems="center" width={width}>
      <Text bold size={SIZE.title} wrap="truncate-end">
        {`AGENT TREE${mainModel ? ` · ${mainModel.toUpperCase()}` : ''} · ${verb}`}
      </Text>
    </Box>
  ) : (
    <Box key="head" flexDirection="column" alignItems="center" width={width}>
      <Text bold size={SIZE.title} wrap="truncate-end">
        {'AGENT TREE'}
        {mainModel ? <Text color={palette.main}>{` · ${mainModel.toUpperCase()} ${verb}`}</Text> : null}
        {advisorModel && wide ? <Text color={palette.advisor}>{` · ${w.advisorOnCall(advisorModel.toUpperCase())}`}</Text> : null}
      </Text>
      <Text color={palette.dim}>{restyleLine('─', glyphs).repeat(Math.max(1, width - 2))}</Text>
      <Text size={SIZE.note} wrap="truncate-end">
        <Text color={palette.main}>{glyphs.marks.legend}</Text>
        {` ${w.main}${legendEffort && s.main.effort ? ` · ${s.main.effort}` : ''}   `}
        <Text color={palette.agent}>{glyphs.marks.legend}</Text>
        {` ${w.agents}${legendEffort && agentEffort ? ` · ${agentEffort}` : ''}   `}
        <Text color={palette.advisor}>{glyphs.marks.legend}</Text>
        {` ${w.advisor}`}
      </Text>
    </Box>
  )

  const roundLine = s.main.turn ? `${w.round} ${s.main.turn}${s.main.costUsd !== undefined ? ` · ${w.cost(s.main.costUsd)}` : ''}` : w.noRound

  const mainBox = (
    <Box key="main" width={mainWidth} flexShrink={0} {...frameProps(palette.main)} flexDirection="column" alignItems="center">
      <Text bold size={SIZE.title} color={palette.main} wrap="truncate-end">
        {[mainModel, w.main].filter(Boolean).join(' · ')}
      </Text>
      <Text wrap="truncate-end">{w.phase[phase]}</Text>
      {s.main.effort && effortCells(s.main.effort, glyphs) ? (
        <Text size={SIZE.detail} wrap="truncate-end">
          <Text color={palette.dim}>{'Effort '}</Text>
          <Text color={palette.main}>{effortCells(s.main.effort, glyphs)}</Text>
          {` ${s.main.effort}`}
        </Text>
      ) : (
        <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
          {s.main.effort ? `Effort ${s.main.effort}` : w.effortNone}
        </Text>
      )}
      <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
        {contextLine(s, w)}
      </Text>
      <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
        {roundLine}
      </Text>
      {frameParts('main', mainWidth, palette.main)}
    </Box>
  )

  const backBox = (
    <Box key="back" width={backWidth} flexShrink={0} {...frameProps(palette.main, phase === 'reviewing')} flexDirection="column" alignItems="center">
      <Text bold size={SIZE.title} color={palette.main} wrap="truncate-end">
        {`${w.back}${s.main.effort ? ` · ${s.main.effort}` : ''}`}
      </Text>
      <Text wrap="truncate-end">{phase === 'reviewing' ? w.phase.reviewing : phase === 'delegating' ? w.waiting : w.ready}</Text>
      <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
        {`${w.answers(s.main.returned)} · ↑ ${fmtTokens(s.main.returnedTokens, w.decimal) || '0'}`}
      </Text>
      {frameParts('back', backWidth, palette.main, phase === 'reviewing')}
    </Box>
  )

  const notes = [
    rest.length > 0 ? (
      <Text key="hidden" size={SIZE.note} color={palette.dim} wrap="truncate-end">
        {w.more(rest.length, hiddenRunning)}
      </Text>
    ) : null,
    earlier > 0 ? (
      <Text key="earlier" size={SIZE.note} color={palette.dim} wrap="truncate-end">
        {w.earlier(earlier)}
      </Text>
    ) : null,
  ]

  const lookButton = actions ? <Button key="look:open" plain hotkey="a" label={`${w.look} ▾`} onPress={() => actions.look()} /> : null

  const pickNew = actions ? (
    <Button key="pick:new" plain hotkey="m" label={`${w.subModel}: ${familyOr(choices.newAgents, w.standard)}${choices.newEffort ? ` · ${effortLabel(choices.newEffort)}` : ''} ▾`} onPress={() => actions.pick(NEW_AGENTS)} />
  ) : null

  const delegationLabel = (
    <Box key="label" flexDirection="row" flexWrap="wrap">
      <Text color={palette.agent} wrap="truncate-end">
        {`${glyphs.node} ${w.toAgents}`}
      </Text>
      {pickNew ? (
        <Box key="pick-group" flexDirection="row">
          <Text color={palette.dim}>{' · '}</Text>
          {pickNew}
        </Box>
      ) : null}
      {lookButton ? (
        <Box key="look-group" flexDirection="row">
          <Text color={palette.dim}>{' · '}</Text>
          {lookButton}
        </Box>
      ) : null}
    </Box>
  )

  const flowing = look.animate && phase === 'delegating'
  const returning = look.animate && (phase === 'reviewing' || (phase === 'delegating' && s.main.returned > 0))
  const vertical = restyleLine('│', glyphs)
  const stemTop = flowing && look.frame % 2 === 0 ? glyphs.node : vertical
  const stemMid = flowing && look.frame % 2 === 1 ? glyphs.node : vertical
  const backMark = returning && look.frame % 2 === 0 ? glyphs.node : restyleLine('▼', glyphs)

  const flowText = (key: string, line: string, color: string) => (
    <Text key={key} color={palette.dim}>
      {line
        .split(/([•·]+)/)
        .map((part, i) =>
          /^[•·]+$/.test(part) ? <Text key={`${key}:${i}`} color={color}>{restyleLine(part, glyphs)}</Text> : restyleLine(part, glyphs),
        )}
    </Text>
  )

  const boxRows = chunk(shown, perRow)
  const frame = rowWidth(Math.max(1, boxRows[0]?.length ?? 1))
  const join = (frame - 1) / 2
  const centersOf = (row: readonly AgentTreeGroup[]) => rowCenters(row.length, (frame - rowWidth(row.length)) / 2)

  const delegation =
    shown.length === 0 ? (
      <Box key="agents" flexDirection="column" alignItems="center">
        <Box key="none" flexDirection="row" flexWrap="wrap">
          <Text size={SIZE.note} color={palette.dim}>{w.noAgents}</Text>
          {pickNew ? (
            <Box key="pick-group" flexDirection="row">
              <Text color={palette.dim}>{' · '}</Text>
              {pickNew}
            </Box>
          ) : null}
          {lookButton ? (
            <Box key="look-group" flexDirection="row">
              <Text color={palette.dim}>{' · '}</Text>
              {lookButton}
            </Box>
          ) : null}
        </Box>
        {notes}
      </Box>
    ) : asRows ? (
      <Box key="agents" flexDirection="column" alignItems="center">
        {delegationLabel}
        <Box key="rows" flexDirection="column" width={treeWidth}>
          {shown.map(agentRow)}
        </Box>
        <Text color={backMark === glyphs.node ? (light ?? palette.main) : palette.main}>{backMark}</Text>
        {arrowRow('back-row', backWidth, backBox)}
        {notes}
      </Box>
    ) : (
      <Box key="agents" flexDirection="column" alignItems="center">
        {delegationLabel}
        <Text color={stemMid === glyphs.node ? (light ?? palette.agent) : palette.dim}>{stemMid}</Text>
        {flowText('split', connector(frame, centersOf(boxRows[0] ?? []), join, 'split', flowing ? look.frame * 2 : undefined), light ?? palette.agent)}
        <Text color={palette.agent}>{restyleLine(marks(frame, centersOf(boxRows[0] ?? []), '▼'), glyphs)}</Text>
        <Box key="boxes" flexDirection="column" alignItems="center" rowGap={1} width={frame}>
          {boxRows.map((row, r) => (
            <Box key={`row:${r}`} flexDirection="row" width={rowWidth(row.length)}>
              {row.map((g, i) => agentBox(g, boxGap(row.length, i)))}
            </Box>
          ))}
        </Box>
        {flowText('merge', connector(frame, centersOf(boxRows.at(-1) ?? []), join, 'merge', returning ? look.frame * 2 : undefined), light ?? palette.main)}
        <Text color={backMark === glyphs.node ? (light ?? palette.main) : palette.main}>{backMark}</Text>
        {arrowRow('back-row', backWidth, backBox)}
        {notes}
      </Box>
    )

  const tree = (
    <Box key="tree" flexDirection="column" alignItems="center" width={treeWidth}>
      {arrowRow('main-row', mainWidth, mainBox)}
      <Text color={stemTop === glyphs.node ? (light ?? palette.agent) : palette.dim}>{stemTop}</Text>
      {delegation}
    </Box>
  )

  const advisorState = advisorModel ? advisorModel : w.off

  const railLine = (key: string, text: string, plain = false) => (
    <Text key={key} size={SIZE.detail} wrap="truncate-end">
      <Text color={palette.advisor} dimColor>{`${glyphs.rail.v} `}</Text>
      <Text color={plain ? undefined : palette.dim}>{text || ' '}</Text>
    </Text>
  )

  const advisorColumn = (
    <Box key="advisor" width={ADVISOR_WIDTH} flexShrink={0} {...frameProps(palette.advisor)} flexDirection="column">
      <Text bold size={SIZE.title} color={palette.advisor} wrap="truncate-end">
        {w.advisorTitle}
      </Text>
      <Text size={SIZE.detail} color={palette.advisor} wrap="truncate-end">
        {advisorState}
      </Text>
      {actions && look.canAdvise !== false ? (
        <Box key="advisor-toggle-row" flexDirection="row">
          <Button key="advisor:toggle" plain label={advisorModel ? w.advisorOff : w.advisorOn} onPress={() => actions.advisor()} />
        </Box>
      ) : (
        <Text size={SIZE.detail} color={palette.advisor} wrap="truncate-end">
          {advisorModel ? w.onCall : ' '}
        </Text>
      )}
      {railLine('reads-0', w.reads[0])}
      {railLine('reads-1', w.reads[1])}
      {railLine('gap-1', '')}
      {railLine('calls', `${w.calls} ${s.advisor.total}`, true)}
      {railLine('places', `${w.fromMain} ${s.advisor.fromMain} · ${w.fromSub} ${s.advisor.fromAgents}`)}
      {railLine('last', lastCall ? `${w.last} ${clockTime(lastCall.at)}` : w.notAsked)}
      {railLine('took', lastCall?.durationMs !== undefined ? `${w.duration} ${fmtShortDuration(lastCall.durationMs)}` : '')}
      {railLine('gap-2', '')}
      {recentCalls.map(call => (
        <Box key={`adv:${call.id}`}>
          <Text size={SIZE.detail} color={palette.advisor} wrap="truncate-end">
            {`◆ ${clockTime(call.at)} ${callPlace(call, w)}`}
          </Text>
        </Box>
      ))}
      <Box key="advisor-fill" flexGrow={1} />
      {railLine('writes-0', w.writes[0])}
      {railLine('writes-1', w.writes[1])}
      {frameParts('advisor', ADVISOR_WIDTH, palette.advisor)}
    </Box>
  )

  const advisorCompact = (
    <Box key="advisor" width={width} {...frameProps(palette.advisor)} flexDirection="column">
      <Box key="advisor-head" flexDirection="row" columnGap={1}>
        <Box key="advisor-head-text" flexShrink={1}>
          <Text color={palette.advisor} wrap="truncate-end">
            {`${w.advisor} · ${advisorModel ? `${advisorModel} · ${w.onCall}` : w.off} · ${w.calls} ${s.advisor.total}`}
          </Text>
        </Box>
        {actions && look.canAdvise !== false ? (
          <Button key="advisor:toggle" plain label={advisorModel ? w.advisorOff : w.advisorOn} onPress={() => actions.advisor()} />
        ) : null}
      </Box>
      <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
        {lastCall ? `${w.fromMain} ${s.advisor.fromMain} · ${w.fromSub} ${s.advisor.fromAgents} · ${w.last} ${clockTime(lastCall.at)}` : w.notAsked}
      </Text>
      {frameParts('advisor', width, palette.advisor)}
    </Box>
  )

  const pickerCurrent = pickerTarget === NEW_AGENTS ? choices.newAgents : pickerTarget ? choices.agents[pickerTarget] : undefined
  const effortCurrent = pickerTarget === NEW_AGENTS ? choices.newEffort : pickerTarget ? choices.efforts?.[pickerTarget] : undefined
  const pickerRow =
    pickerTarget && actions ? (
      <Box key="picker" flexDirection="column" width={width} marginTop={1}>
        <Box key="picker-models" flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text color={palette.agent} wrap="truncate-end">
            {w.pickerFor(pickerName)}
          </Text>
          <Button key={`choose:${pickerTarget}:default`} hotkey="0" label={w.standard} variant={pickerCurrent === undefined ? 'primary' : undefined} onPress={() => actions.choose(pickerTarget, undefined)} />
          {MODEL_FAMILIES.map((family, i) => (
            <Button
              key={`choose:${pickerTarget}:${family}`}
              hotkey={String(i + 1)}
              label={familyLabel(family)}
              variant={pickerCurrent === family ? 'primary' : undefined}
              onPress={() => actions.choose(pickerTarget, family)}
            />
          ))}
          <Button key="picker:close" hotkey="x" label="×" onPress={() => actions.close()} />
        </Box>
        <Box key="picker-efforts" flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text color={palette.agent}>{w.effortFor}</Text>
          <Button key={`effort:${pickerTarget}:default`} label={w.standard} variant={effortCurrent === undefined ? 'primary' : undefined} onPress={() => actions.effort(pickerTarget, undefined)} />
          {EFFORT_LEVELS.map(level => (
            <Button key={`effort:${pickerTarget}:${level}`} label={effortLabel(level)} variant={effortCurrent === level ? 'primary' : undefined} onPress={() => actions.effort(pickerTarget, level)} />
          ))}
        </Box>
        {pickerTarget !== NEW_AGENTS ? (
          <Text key="picker-hint" color={palette.dim} wrap="wrap">
            {w.effortNextMessage}
          </Text>
        ) : null}
      </Box>
    ) : null

  const missing = (value: string | undefined, empty: string) =>
    detail?.state === 'loading' ? w.loading : value || (detail?.state === 'denied' ? w.noAccess : empty)
  const detailRunning = detailNode?.status === 'running'
  const detailStopping = detailNode !== undefined && (s.stopping ?? []).includes(detailNode.id)
  const detailCorrection = detailNode ? s.corrections?.[detailNode.id] : undefined
  const detailBox =
    detail && detailNode && actions ? (
      <Box key="detail" width={width} {...frameProps(palette.agent)} flexDirection="column" marginTop={1}>
        <Box key="detail-head" flexDirection="row" justifyContent="space-between">
          <Box key="detail-title" flexShrink={1}>
            <Text bold size={SIZE.title} color={palette.agent} wrap="truncate-end">
              {`${typeLabel(detailNode.type)} · ${detailNode.description}`}
            </Text>
          </Box>
          <Box key="detail-buttons" flexDirection="row" columnGap={1} flexShrink={0}>
            {detailRunning && !detailStopping ? (
              <Button key={`stop:${detailNode.id}`} hotkey="s" label={w.stop} onPress={() => actions.stop(detailNode.id)} />
            ) : null}
            {detailStopping ? <Text color={palette.dim}>{w.stopping}</Text> : null}
            <Button key="detail:close" plain hotkey="x" label={w.close} onPress={() => actions.close()} />
          </Box>
        </Box>
        {Input ? (
          <Input
            key={`say:${detailNode.id}:${s.corrections?.[detailNode.id]?.count ?? 0}`}
            rows={2}
            autoFocus
            placeholder={w.sayPlaceholder}
            submitLabel={w.send}
            onSubmit={value => actions.say(detailNode.id, value)}
          />
        ) : null}
        {detailCorrection ? (
          <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
            {`${w.correctionLabel}: ${w.correction[detailCorrection.state]} · ${clockTime(detailCorrection.at)}${detailCorrection.text ? ` · „${detailCorrection.text}“` : ''}`}
          </Text>
        ) : null}
        <Text wrap="truncate-end">{`${w.task}: ${missing(detailNode.task, '?')}`}</Text>
        <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
          {`${w.tools}: ${detailNode.tools?.length ? detailNode.tools.map(t => toolText(t, lang)).join(' · ') : '0'}`}
        </Text>
        <Text wrap="truncate-end">{`${detailRunning ? w.latest : w.reply}: ${missing(detailNode.answer, w.noReply)}`}</Text>
        <Text size={SIZE.detail} color={palette.dim} wrap="truncate-end">
          {`${modelLabel(detailNode.model) || w.model} · ${w.status[detailNode.status]} · ${fmtShortDuration((detailNode.endedAt ?? now) - detailNode.startedAt)}`}
        </Text>
        {frameParts('detail', width, palette.agent)}
      </Box>
    ) : null

  const rows = s.log.slice(-plan.logRows)
  const logBox = (
    <Box key="log" width={width} {...frameProps(palette.dim)} flexDirection="column" marginTop={1}>
      <Text size={SIZE.note} color={palette.dim}>{w.log}</Text>
      {rows.length === 0 ? (
        <Text size={SIZE.note} color={palette.dim}>{w.logEmpty}</Text>
      ) : (
        rows.map((row, i) => (
          <Box key={`log:${i}:${row.at}`} flexDirection="row">
            <Box width={10} flexShrink={0}>
              <Text size={SIZE.detail} color={palette.dim}>{clockTime(row.at)}</Text>
            </Box>
            <Box width={9} flexShrink={0}>
              <Text bold size={SIZE.detail} color={sourceColor(palette, row.source)}>
                {w.source[row.source]}
              </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
              <Text size={SIZE.detail} wrap="truncate-end">{logLine(row, lang)}</Text>
            </Box>
          </Box>
        ))
      )}
      {frameParts('log', width, palette.dim)}
    </Box>
  )

  const labelWidth = lookLabelWidth(w)
  const lookRow =
    s.lookOpen && actions ? (
      <Box key="look" flexDirection="column" width={width} marginTop={1}>
        <Text color={palette.agent} wrap="truncate-end">
          {w.look}
        </Text>
        {LOOK_ROWS.map(row => (
          <Box key={`look-row:${row}`} flexDirection="row" flexWrap="wrap" columnGap={1} width={width}>
            <Box key={`look-label:${row}`} width={labelWidth} flexShrink={0}>
              <Text color={palette.dim}>{w.lookRow[row]}</Text>
            </Box>
            {(LOOK_OPTIONS[row] as readonly string[]).map(id => (
              <Button
                key={`look:${row}:${id}`}
                label={lookOptionLabel(w, row, id)}
                variant={appearance[row] === id ? 'primary' : undefined}
                onPress={() => actions.restyle(row, id)}
              />
            ))}
            {row === 'light' ? <Box key="look-light-sample">{streakLine(glyphs.bar.full.repeat(LIGHT_SAMPLE), palette.agent, 5)}</Box> : null}
          </Box>
        ))}
        <Box key="look-end" flexDirection="row" columnGap={1}>
          <Button key="look:default" hotkey="0" label={w.lookReset} onPress={() => actions.restyleDefault()} />
          <Button key="look:close" hotkey="x" label="×" onPress={() => actions.close()} />
        </Box>
      </Box>
    ) : null

  return (
    <Box flexDirection="column" width={width}>
      {header}
      {pickerRow}
      {lookRow}
      {wide ? (
        <Box key="body" flexDirection="row" columnGap={2} marginTop={1}>
          {advisorColumn}
          {tree}
        </Box>
      ) : (
        <Box key="body" flexDirection="column" marginTop={1}>
          {advisorCompact}
          {tree}
        </Box>
      )}
      {detailBox}
      {logBox}
      {tight ? null : (
        <Text key="help" size={SIZE.note} color={palette.dim} wrap="truncate-end">
          {helpLine(w.help, width)}
        </Text>
      )}
    </Box>
  )
}
