// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { Elements } from 'claude-code'

import type { AgentTreeAdvisorCall, AgentTreeGroup, AgentTreeLogSource, AgentTreeNode, AgentTreePhase, AgentTreeState, AgentTreeStatus } from '../types'
import { MODEL_CHOICES, NEW_AGENTS, choicesOf, clockTime, counts, effortBar, familyLabel, fmtShortDuration, fmtTokens, groups, modelLabel, phaseOf, typeLabel } from './model.ts'

type Ui = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

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

const COLOR = {
  main: '#E6845D',
  agent: '#7CAAE8',
  advisor: '#B1A7E6',
  done: '#7BE396',
  dim: '#7A7A85',
  failed: 'error',
}

const PHASE_TEXT: Record<AgentTreePhase, string> = {
  idle: 'bereit',
  planning: 'plant und entscheidet',
  delegating: 'wartet auf Unteragenten',
  reviewing: 'prüft und verifiziert',
}

const STATUS_MARK: Record<AgentTreeStatus, string> = { running: '◐', done: '●', failed: '✗', stopped: '○' }

const SPIN = ['◐', '◓', '◑', '◒']

export function runningMark(frame: number, animate: boolean): string {
  if (!animate) return STATUS_MARK.running
  return SPIN[((frame % SPIN.length) + SPIN.length) % SPIN.length] ?? STATUS_MARK.running
}

export type TreeActions = {
  pick: (target: string) => void
  choose: (family: string | undefined) => void
  close: () => void
}

export type TreeLook = { frame: number; animate: boolean; actions?: TreeActions }

const STATUS_WORD: Record<AgentTreeStatus, string> = {
  running: 'läuft',
  done: 'fertig',
  failed: 'fehlgeschlagen',
  stopped: 'gestoppt',
}

const STATUS_COLOR: Record<AgentTreeStatus, string> = {
  running: COLOR.agent,
  done: COLOR.done,
  failed: COLOR.failed,
  stopped: COLOR.dim,
}

const SOURCE_WORD: Record<AgentTreeLogSource, string> = {
  session: 'sitzung',
  main: 'haupt',
  agent: 'agent',
  advisor: 'berater',
}

const SOURCE_COLOR: Record<AgentTreeLogSource, string> = {
  session: COLOR.dim,
  main: COLOR.main,
  agent: COLOR.agent,
  advisor: COLOR.advisor,
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

export function statusText(s: AgentTreeState): string | undefined {
  const c = counts(s)
  if (c.running + c.done + c.failed + c.stopped === 0 && s.advisor.total === 0) return undefined
  const parts = [`${c.running} ${c.running === 1 ? 'läuft' : 'laufen'}`, `${c.done} fertig`]
  if (c.failed) parts.push(`${c.failed} fehlgeschlagen`)
  if (s.advisor.total) parts.push(`Berater ${s.advisor.total}×`)
  if (s.main.percent !== undefined) parts.push(`Kontext ${s.main.percent} %`)
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
}

export type RowPlan = { shown: number; logRows: number }

function treeRows(o: RowPlanInput, shown: number): number {
  const top = 7 + 1
  const later = o.earlier ? 1 : 0
  if (o.total === 0) return top + 1 + later
  const hidden = shown < o.total ? 1 : 0
  const back = 1 + 5 + hidden + later
  if (o.asRows) return top + 1 + shown + back
  const boxRows = Math.ceil(shown / o.perRow)
  return top + 4 + (9 * boxRows - 1) + 1 + back
}

function usedRows(o: RowPlanInput, shown: number, logRows: number): number {
  const header = (o.tight ? 1 : 3) + (o.pickerRows ?? 0)
  const tree = treeRows(o, shown)
  const body = o.wide ? Math.max(o.advisorRows, tree) : o.advisorRows + tree
  return header + 1 + body + 4 + logRows
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

export function connector(width: number, points: readonly number[], join: number, kind: 'split' | 'merge'): string {
  const lo = Math.min(join, ...points)
  const hi = Math.max(join, ...points)
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
    line += GLYPH[key] ?? ' '
  }
  return line
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

function effortLine(effort: string | undefined): string {
  if (!effort) return ' '
  const bar = effortBar(effort)
  return bar ? `${bar} ${effort}` : `Effort ${effort}`
}

function contextLine(s: AgentTreeState): string {
  const { contextTokens, window, percent } = s.main
  const share = percent !== undefined ? `${percent} %` : ''
  if (contextTokens === undefined) return share ? `Kontext ${share}` : 'Kontext noch nicht gemessen'
  const amount = window ? `${fmtTokens(contextTokens)} / ${fmtTokens(window)}` : fmtTokens(contextTokens)
  return `Kontext ${amount}${share ? ` · ${share}` : ''}`
}

function isRunning(g: AgentTreeGroup): boolean {
  return g.kind === 'agent' ? g.node.status === 'running' : g.running > 0
}

function startOf(g: AgentTreeGroup): number {
  return g.kind === 'agent' ? g.node.startedAt : g.startedAt
}

function parentOf(s: AgentTreeState, n: AgentTreeNode): string | undefined {
  if (n.parentId === undefined) return undefined
  const parent = s.agents.find(p => p.id === n.parentId)
  return parent ? typeLabel(parent.type) : 'Unteragent'
}

function agentStatusLine(n: AgentTreeNode, spin: string): string {
  if (n.status === 'running') return `${spin} läuft${n.contextTokens ? ` · ${fmtTokens(n.contextTokens)}` : ''}`
  if (n.status === 'done' && n.endedAt !== undefined) return `${STATUS_MARK.done} fertig · ${fmtShortDuration(n.endedAt - n.startedAt)}`
  return `${STATUS_MARK[n.status]} ${STATUS_WORD[n.status]}`
}

function callPlace(call: AgentTreeAdvisorCall): string {
  return call.agentId === undefined ? 'Haupt' : 'Sub'
}

export function pickerLines(name: string, width: number): number {
  const parts = [`Modell für ${name}:`, '[ Standard ]', ...MODEL_CHOICES.map(c => `[ ${c.label} ]`), '[ × ]']
  let lines = 1
  let used = 0
  for (const part of parts) {
    const need = used === 0 ? part.length : used + 1 + part.length
    if (need > width && used > 0) {
      lines += 1
      used = part.length
    } else {
      used = need
    }
  }
  return lines
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size))
  return rows
}

export function drawTree(ui: Ui, s: AgentTreeState, width: number, height?: number, look: TreeLook = { frame: 0, animate: false }) {
  const { Box, Text, Button } = ui
  const spin = runningMark(look.frame, look.animate)
  const choices = choicesOf(s)
  const actions = look.actions
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
  const current = all.filter(g => isRunning(g) || startOf(g) >= roundStart)
  const earlier = all.length - current.length
  const recentCalls = s.advisor.calls.slice(-ADVISOR_ROWS)
  const plan = planRows({
    height,
    wide,
    tight,
    asRows,
    perRow,
    total: current.length,
    advisorRows: wide ? ADVISOR_BASE_ROWS + recentCalls.length : ADVISOR_COMPACT_ROWS,
    earlier: earlier > 0,
    pickerRows: choices.picker ? 1 + pickerLines(choices.picker === NEW_AGENTS ? 'neue Unteragenten' : 'Unteragent', width) : 0,
  })
  const shown = current.slice(0, plan.shown)
  const rest = current.slice(shown.length)
  const hiddenRunning = rest.filter(isRunning).length
  const hiddenText =
    hiddenRunning > 0 ? `+${rest.length} weitere, ${hiddenRunning} davon laufen` : `+${rest.length} weitere beendet`
  const mainModel = modelLabel(s.main.model)
  const advisorModel = modelLabel(s.advisor.model)
  const agentEffort =
    mostCommon(s.agents.filter(n => n.status === 'running').map(n => n.effort)) ?? mostCommon(s.agents.map(n => n.effort))
  const lastCall = s.advisor.calls.at(-1)
  const consulted = lastCall !== undefined && lastCall.at >= roundStart && roundStart > 0
  const legendEffort = width >= LEGEND_EFFORT_FROM

  const agentBox = (g: AgentTreeGroup, marginLeft: number) => {
    if (g.kind === 'workflow') {
      const color = g.running > 0 ? COLOR.agent : g.failed > 0 ? COLOR.failed : COLOR.dim
      return (
        <Box key={`wf:${g.runId}`} width={AGENT_WIDTH} marginLeft={marginLeft} borderStyle="single" borderColor={color} flexDirection="column" alignItems="center">
          <Text bold color={g.running > 0 ? COLOR.agent : undefined} wrap="truncate-end">
            {`Workflow · ${g.size}`}
          </Text>
          <Text color={COLOR.agent} wrap="truncate-end">
            {`${spin} ${g.running} ${g.running === 1 ? 'läuft' : 'laufen'}`}
          </Text>
          <Text color={COLOR.done} wrap="truncate-end">{`${STATUS_MARK.done} ${g.done} fertig`}</Text>
          <Text color={g.failed ? COLOR.failed : COLOR.dim} wrap="truncate-end">
            {`${STATUS_MARK.failed} ${g.failed} Fehler`}
          </Text>
          <Text wrap="truncate-end">{g.lastDescription || ' '}</Text>
          <Text color={COLOR.dim} wrap="truncate-end">
            {g.stopped ? `${STATUS_MARK.stopped} ${g.stopped} gestoppt` : ' '}
          </Text>
        </Box>
      )
    }
    const n = g.node
    const running = n.status === 'running'
    const nested = parentOf(s, n)
    return (
      <Box key={`ag:${n.id}`} width={AGENT_WIDTH} marginLeft={marginLeft} borderStyle="single" borderColor={running ? COLOR.agent : n.status === 'failed' ? COLOR.failed : COLOR.dim} flexDirection="column" alignItems="center">
        <Text bold color={running ? COLOR.agent : undefined} wrap="truncate-end">
          {typeLabel(n.type)}
        </Text>
        {running && actions ? (
          <Box key={`pick-row:${n.id}`} width={AGENT_WIDTH - 2} flexDirection="row" justifyContent="center">
            <Button
              key={`pick:${n.id}`}
              plain
              label={`${choices.agents[n.id] ? `→ ${familyLabel(choices.agents[n.id])}` : modelLabel(n.model) || 'Modell'} ▾`}
              onPress={() => actions.pick(n.id)}
            />
          </Box>
        ) : (
          <Text color={running ? undefined : COLOR.dim} wrap="truncate-end">
            {modelLabel(n.model) || ' '}
          </Text>
        )}
        <Text color={COLOR.dim} wrap="truncate-end">
          {nested ? `↳ unter ${nested}` : effortLine(n.effort)}
        </Text>
        <Text color={running ? undefined : COLOR.dim} wrap="truncate-end">
          {n.description || ' '}
        </Text>
        <Text color={COLOR.dim} wrap="truncate-end">
          {n.lastTool ?? `Werkzeuge: ${n.toolCount}`}
        </Text>
        <Text color={STATUS_COLOR[n.status]} wrap="truncate-end">
          {agentStatusLine(n, spin)}
        </Text>
      </Box>
    )
  }

  const agentRow = (g: AgentTreeGroup) => {
    if (g.kind === 'workflow') {
      const color = g.running > 0 ? COLOR.agent : g.failed > 0 ? COLOR.failed : COLOR.dim
      const state = g.running > 0 ? `${spin} ${g.running} ${g.running === 1 ? 'läuft' : 'laufen'}` : `${STATUS_MARK.done} beendet`
      return (
        <Box key={`wf:${g.runId}`} width={treeWidth}>
          <Text color={color} wrap="truncate-end">
            {`${state} · Workflow · ${g.size} Agenten`}
          </Text>
        </Box>
      )
    }
    const n = g.node
    const indent = parentOf(s, n) ? '↳ ' : ''
    const size = n.status === 'running' && n.contextTokens ? ` · ${fmtTokens(n.contextTokens)}` : ''
    return (
      <Box key={`ag:${n.id}`} width={treeWidth}>
        <Text color={STATUS_COLOR[n.status]} wrap="truncate-end">
          {`${indent}${n.status === 'running' ? spin : STATUS_MARK[n.status]} ${STATUS_WORD[n.status]} · ${typeLabel(n.type)} · ${n.description}${size}`}
        </Text>
      </Box>
    )
  }

  const arrowRow = (key: string, boxWidth: number, box: unknown) => {
    const side = Math.max(0, (treeWidth - boxWidth) / 2)
    const arrow = wide && side >= 3 ? `${'┄'.repeat(side - 2)}▶ ` : ' '
    return (
      <Box key={key} flexDirection="row" width={treeWidth}>
        <Box width={side} flexShrink={0} flexDirection="column" justifyContent="center" alignItems="flex-end">
          <Text color={consulted ? COLOR.advisor : COLOR.dim}>{side > 0 ? arrow : ''}</Text>
        </Box>
        {box}
        <Box width={side} flexShrink={0} />
      </Box>
    )
  }

  const header = tight ? (
    <Box key="head" flexDirection="column" alignItems="center" width={width}>
      <Text bold wrap="truncate-end">
        {`AGENT TREE${mainModel ? ` · ${mainModel.toUpperCase()}` : ''} · ${phase === 'idle' ? 'BEREIT' : 'ARBEITET'}`}
      </Text>
    </Box>
  ) : (
    <Box key="head" flexDirection="column" alignItems="center" width={width}>
      <Text bold wrap="truncate-end">
        {'AGENT TREE'}
        {mainModel ? <Text color={COLOR.main}>{` · ${mainModel.toUpperCase()} ${phase === 'idle' ? 'BEREIT' : 'ARBEITET'}`}</Text> : null}
        {advisorModel && wide ? <Text color={COLOR.advisor}>{` · BERATER ${advisorModel.toUpperCase()} AUF ABRUF`}</Text> : null}
      </Text>
      <Text color={COLOR.dim}>{'─'.repeat(Math.max(1, width - 2))}</Text>
      <Text wrap="truncate-end">
        <Text color={COLOR.main}>{'■'}</Text>
        {` Hauptsitzung${legendEffort && s.main.effort ? ` · ${s.main.effort}` : ''}   `}
        <Text color={COLOR.agent}>{'■'}</Text>
        {` Unteragenten${legendEffort && agentEffort ? ` · ${agentEffort}` : ''}   `}
        <Text color={COLOR.advisor}>{'■'}</Text>
        {' Berater'}
      </Text>
    </Box>
  )

  const mainBox = (
    <Box key="main" width={mainWidth} flexShrink={0} borderStyle="single" borderColor={COLOR.main} flexDirection="column" alignItems="center">
      <Text bold color={COLOR.main} wrap="truncate-end">
        {[mainModel, 'Hauptsitzung'].filter(Boolean).join(' · ')}
      </Text>
      <Text wrap="truncate-end">{PHASE_TEXT[phase]}</Text>
      {s.main.effort && effortBar(s.main.effort) ? (
        <Text wrap="truncate-end">
          <Text color={COLOR.dim}>{'Effort '}</Text>
          <Text color={COLOR.main}>{effortBar(s.main.effort)}</Text>
          {` ${s.main.effort}`}
        </Text>
      ) : (
        <Text color={COLOR.dim} wrap="truncate-end">
          {s.main.effort ? `Effort ${s.main.effort}` : 'ohne Effort-Stufe'}
        </Text>
      )}
      <Text color={COLOR.dim} wrap="truncate-end">
        {contextLine(s)}
      </Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {s.main.turn ? `Runde ${s.main.turn}` : 'noch keine Runde'}
      </Text>
    </Box>
  )

  const backBox = (
    <Box key="back" width={backWidth} flexShrink={0} borderStyle={phase === 'reviewing' ? 'bold' : 'single'} borderColor={COLOR.main} flexDirection="column" alignItems="center">
      <Text bold color={COLOR.main} wrap="truncate-end">
        {`zurück zur Hauptsitzung${s.main.effort ? ` · ${s.main.effort}` : ''}`}
      </Text>
      <Text wrap="truncate-end">
        {phase === 'reviewing' ? 'prüft und verifiziert' : phase === 'delegating' ? 'wartet auf Antworten' : 'bereit'}
      </Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {`${s.main.returned} ${s.main.returned === 1 ? 'Antwort' : 'Antworten'} · ↑ ${fmtTokens(s.main.returnedTokens) || '0'}`}
      </Text>
    </Box>
  )

  const notes = [
    rest.length > 0 ? (
      <Text key="hidden" color={COLOR.dim} wrap="truncate-end">
        {hiddenText}
      </Text>
    ) : null,
    earlier > 0 ? (
      <Text key="earlier" color={COLOR.dim} wrap="truncate-end">
        {`aus früheren Runden: ${earlier} ${earlier === 1 ? 'Agent' : 'Agenten'}`}
      </Text>
    ) : null,
  ]

  const pickNew = actions ? (
    <Button key="pick:new" plain label={`Modell: ${familyLabel(choices.newAgents)} ▾`} onPress={() => actions.pick(NEW_AGENTS)} />
  ) : null

  const label = (
    <Box key="label" flexDirection="row">
      <Text color={COLOR.agent} wrap="truncate-end">
        {`● an Unteragenten${agentEffort ? ` · Effort ${agentEffort}` : ''}`}
      </Text>
      {pickNew ? <Text color={COLOR.dim}>{' · '}</Text> : null}
      {pickNew}
    </Box>
  )

  const flowing = look.animate && phase === 'delegating'
  const returning = look.animate && (phase === 'reviewing' || (phase === 'delegating' && s.main.returned > 0))
  const stemTop = flowing && look.frame % 2 === 0 ? '●' : '│'
  const stemMid = flowing && look.frame % 2 === 1 ? '●' : '│'
  const backMark = returning && look.frame % 2 === 0 ? '●' : '▼'

  const boxRows = chunk(shown, perRow)
  const frame = rowWidth(Math.max(1, boxRows[0]?.length ?? 1))
  const join = (frame - 1) / 2
  const centersOf = (row: readonly AgentTreeGroup[]) => rowCenters(row.length, (frame - rowWidth(row.length)) / 2)

  const delegation =
    shown.length === 0 ? (
      <Box key="agents" flexDirection="column" alignItems="center">
        <Box key="none" flexDirection="row">
          <Text color={COLOR.dim}>{'noch keine Unteragenten'}</Text>
          {pickNew ? <Text color={COLOR.dim}>{' · '}</Text> : null}
          {pickNew}
        </Box>
        {notes}
      </Box>
    ) : asRows ? (
      <Box key="agents" flexDirection="column" alignItems="center">
        {label}
        <Box key="rows" flexDirection="column" width={treeWidth}>
          {shown.map(agentRow)}
        </Box>
        <Text color={COLOR.main}>{backMark}</Text>
        {arrowRow('back-row', backWidth, backBox)}
        {notes}
      </Box>
    ) : (
      <Box key="agents" flexDirection="column" alignItems="center">
        {label}
        <Text color={stemMid === '●' ? COLOR.agent : COLOR.dim}>{stemMid}</Text>
        <Text color={COLOR.dim}>{connector(frame, centersOf(boxRows[0] ?? []), join, 'split')}</Text>
        <Text color={COLOR.agent}>{marks(frame, centersOf(boxRows[0] ?? []), '▼')}</Text>
        <Box key="boxes" flexDirection="column" alignItems="center" rowGap={1} width={frame}>
          {boxRows.map((row, r) => (
            <Box key={`row:${r}`} flexDirection="row" width={rowWidth(row.length)}>
              {row.map((g, i) => agentBox(g, boxGap(row.length, i)))}
            </Box>
          ))}
        </Box>
        <Text color={COLOR.dim}>{connector(frame, centersOf(boxRows.at(-1) ?? []), join, 'merge')}</Text>
        <Text color={COLOR.main}>{backMark}</Text>
        {arrowRow('back-row', backWidth, backBox)}
        {notes}
      </Box>
    )

  const tree = (
    <Box key="tree" flexDirection="column" alignItems="center" width={treeWidth}>
      {arrowRow('main-row', mainWidth, mainBox)}
      <Text color={stemTop === '●' ? COLOR.agent : COLOR.dim}>{stemTop}</Text>
      {delegation}
    </Box>
  )

  const advisorState = advisorModel ? advisorModel : 'nicht eingeschaltet'

  const pickerTarget = choices.picker
  const pickerNode = pickerTarget && pickerTarget !== NEW_AGENTS ? s.agents.find(n => n.id === pickerTarget) : undefined
  const pickerName =
    pickerTarget === NEW_AGENTS ? 'neue Unteragenten' : pickerNode ? `${typeLabel(pickerNode.type)} · ${pickerNode.description}` : 'Unteragent'
  const pickerCurrent = pickerTarget === NEW_AGENTS ? choices.newAgents : pickerTarget ? choices.agents[pickerTarget] : undefined
  const pickerRow =
    pickerTarget && actions ? (
      <Box key="picker" flexDirection="row" flexWrap="wrap" columnGap={1} width={width} marginTop={1}>
        <Text color={COLOR.agent} wrap="truncate-end">
          {`Modell für ${pickerName}:`}
        </Text>
        <Button key="choose:default" label="Standard" variant={pickerCurrent === undefined ? 'primary' : undefined} onPress={() => actions.choose(undefined)} />
        {MODEL_CHOICES.map(choice => (
          <Button
            key={`choose:${choice.family}`}
            label={choice.label}
            variant={pickerCurrent === choice.family ? 'primary' : undefined}
            onPress={() => actions.choose(choice.family)}
          />
        ))}
        <Button key="picker:close" label="×" onPress={() => actions.close()} />
      </Box>
    ) : null

  const advisorColumn = (
    <Box key="advisor" width={ADVISOR_WIDTH} flexShrink={0} borderStyle="single" borderColor={COLOR.advisor} flexDirection="column">
      <Text bold color={COLOR.advisor} wrap="truncate-end">
        {'BERATER'}
      </Text>
      <Text color={COLOR.advisor} wrap="truncate-end">
        {advisorState}
      </Text>
      <Text color={COLOR.advisor} wrap="truncate-end">
        {advisorModel ? 'auf Abruf' : ' '}
      </Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {'liest die ganze'}
      </Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {'Sitzung mit'}
      </Text>
      <Text>{' '}</Text>
      <Text wrap="truncate-end">{`Aufrufe ${s.advisor.total}`}</Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {`Haupt ${s.advisor.fromMain} · Sub ${s.advisor.fromAgents}`}
      </Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {lastCall ? `zuletzt ${clockTime(lastCall.at)}` : 'noch nicht gefragt'}
      </Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {lastCall?.durationMs !== undefined ? `Dauer ${fmtShortDuration(lastCall.durationMs)}` : ' '}
      </Text>
      <Text>{' '}</Text>
      {recentCalls.map(call => (
        <Box key={`adv:${call.id}`}>
          <Text color={COLOR.advisor} wrap="truncate-end">
            {`◆ ${clockTime(call.at)} ${callPlace(call)}`}
          </Text>
        </Box>
      ))}
      <Box key="advisor-fill" flexGrow={1} />
      <Text color={COLOR.dim} wrap="truncate-end">
        {'schreibt nie'}
      </Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {'selbst Code'}
      </Text>
    </Box>
  )

  const advisorCompact = (
    <Box key="advisor" width={width} borderStyle="single" borderColor={COLOR.advisor} flexDirection="column">
      <Text color={COLOR.advisor} wrap="truncate-end">
        {`Berater · ${advisorModel ? `${advisorModel} · auf Abruf` : 'nicht eingeschaltet'} · Aufrufe ${s.advisor.total}`}
      </Text>
      <Text color={COLOR.dim} wrap="truncate-end">
        {lastCall
          ? `Haupt ${s.advisor.fromMain} · Sub ${s.advisor.fromAgents} · zuletzt ${clockTime(lastCall.at)}`
          : 'noch nicht gefragt'}
      </Text>
    </Box>
  )

  const rows = s.log.slice(-plan.logRows)
  const logBox = (
    <Box key="log" width={width} borderStyle="single" borderColor={COLOR.dim} flexDirection="column" marginTop={1}>
      <Text color={COLOR.dim}>{'Sitzungsprotokoll'}</Text>
      {rows.length === 0 ? (
        <Text color={COLOR.dim}>{'noch nichts geschehen'}</Text>
      ) : (
        rows.map((row, i) => (
          <Box key={`log:${i}:${row.at}`} flexDirection="row">
            <Box width={10} flexShrink={0}>
              <Text color={COLOR.dim}>{clockTime(row.at)}</Text>
            </Box>
            <Box width={9} flexShrink={0}>
              <Text bold color={SOURCE_COLOR[row.source]}>
                {SOURCE_WORD[row.source]}
              </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
              <Text wrap="truncate-end">{row.text}</Text>
            </Box>
          </Box>
        ))
      )}
    </Box>
  )

  return (
    <Box flexDirection="column" width={width}>
      {header}
      {pickerRow}
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
      {logBox}
    </Box>
  )
}
