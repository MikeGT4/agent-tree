// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { Elements } from 'claude-code'

import type { AgentTreeLogEntry, AgentTreeLogSource, AgentTreeNode, AgentTreeReport, AgentTreeState, AgentTreeTab } from '../types'
import { frameEdges, restyleLine, statusColor } from './looks.ts'
import type { Glyphs, Palette } from './looks.ts'
import { LOG_SOURCES, MAIN, TABS, clashShown, logTarget, clockTime, contextLevel, contextPercent, cut, fmtShortDuration, fmtTokens, modelLabel, typeLabel, windowOf } from './model.ts'
import { helpItems, logLine } from './words.ts'
import type { Lang, Words } from './words.ts'
import { VERSION, newsBetween } from './news.ts'

type Ui = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'> & Partial<Pick<Elements['terminal'], 'Markdown'>>

export type TabName = { id: AgentTreeTab; name: string }

export function tabNames(labels: Record<AgentTreeTab, string>, marks: Partial<Record<AgentTreeTab, string>>): TabName[] {
  return TABS.map(id => ({ id, name: marks[id] ? `${labels[id]} ${marks[id]}` : labels[id] }))
}

export function reiterPad(names: readonly TabName[], width: number): number | undefined {
  return [1, 0].find(pad => 1 + names.reduce((sum, t) => sum + [...t.name].length + 2 * pad + 2, 0) <= width)
}

export function stripLines(names: readonly TabName[], width: number): number {
  let lines = 1
  let used = 0
  for (const t of names) {
    const cell = [...t.name].length + 2
    if (used > 0 && used + 1 + cell > width) {
      lines += 1
      used = cell
    } else {
      used += (used > 0 ? 1 : 0) + cell
    }
  }
  return lines
}

export function tabRows(names: readonly TabName[], width: number, tight: boolean): number {
  return reiterPad(names, width) === undefined ? stripLines(names, width) + (tight ? 0 : 1) : 3
}

export type TabBarInput = {
  names: readonly TabName[]
  tab: AgentTreeTab
  width: number
  tight: boolean
  palette: Palette
  glyphs: Glyphs
  press?: (id: AgentTreeTab) => void
}

export function drawTabBar(ui: Ui, o: TabBarInput) {
  const { Box, Text, Button } = ui
  const press = o.press
  const tint = (active: boolean) => (active ? o.palette.main : o.palette.dim)
  const label = (id: AgentTreeTab, text: string, active: boolean, filled: boolean) => {
    const shown = (
      <Text bold={active} inverse={filled && active} color={tint(active)}>
        {text}
      </Text>
    )
    return press ? (
      <Button key={`tab:${id}`} plain onPress={() => press(id)}>
        {shown}
      </Button>
    ) : (
      <Box key={`tab:${id}`}>{shown}</Box>
    )
  }
  const rule = restyleLine('─', o.glyphs)
  const pad = reiterPad(o.names, o.width)
  if (pad === undefined) {
    return (
      <Box key="tabs" flexDirection="column" width={o.width}>
        <Box key="tab-strip" flexDirection="row" flexWrap="wrap" columnGap={1} width={o.width}>
          {o.names.map(t => label(t.id, ` ${t.name} `, t.id === o.tab, true))}
        </Box>
        {o.tight ? null : <Text color={o.palette.dim}>{rule.repeat(Math.max(1, o.width - 2))}</Text>}
      </Box>
    )
  }
  const cells = o.names.map(t => ({ id: t.id, active: t.id === o.tab, text: `${' '.repeat(pad)}${t.name}${' '.repeat(pad)}` }))
  const used = 1 + cells.reduce((sum, c) => sum + [...c.text].length + 2, 0)
  return (
    <Box key="tabs" flexDirection="column" width={o.width}>
      <Box key="tab-tops" flexDirection="row" width={o.width}>
        <Text wrap="truncate-end">
          {' '}
          {cells.map(c => (
            <Text key={`tab-top:${c.id}`} color={tint(c.active)}>
              {frameEdges(o.glyphs, [...c.text].length + 2).top}
            </Text>
          ))}
        </Text>
      </Box>
      <Box key="tab-labels" flexDirection="row" width={o.width}>
        <Text>{' '}</Text>
        {cells.map(c => (
          <Box key={`tab-cell:${c.id}`} flexDirection="row" flexShrink={0}>
            <Text color={tint(c.active)}>{o.glyphs.frame.l}</Text>
            {label(c.id, c.text, c.active, false)}
            <Text color={tint(c.active)}>{o.glyphs.frame.r}</Text>
          </Box>
        ))}
      </Box>
      <Box key="tab-base" flexDirection="row" width={o.width}>
        <Text wrap="truncate-end" color={o.palette.dim}>
          {rule}
          {cells.map(c =>
            c.active ? (
              <Text key={`tab-open:${c.id}`} color={o.palette.main}>
                {`${restyleLine('┘', o.glyphs)}${' '.repeat([...c.text].length)}${restyleLine('└', o.glyphs)}`}
              </Text>
            ) : (
              `${restyleLine('┴', o.glyphs)}${rule.repeat([...c.text].length)}${restyleLine('┴', o.glyphs)}`
            ),
          )}
          {rule.repeat(Math.max(0, o.width - used))}
        </Text>
      </Box>
    </Box>
  )
}

export type ViewInput = {
  s: AgentTreeState
  width: number
  palette: Palette
  glyphs: Glyphs
  w: Words
  lang: Lang
  docked?: boolean
}

export type HelpInput = ViewInput & { starAsk?: boolean; starOff?: () => void }

export const TAB_AGENTS = 40
export const FILES_BUDGET = 16000
export const FILE_NAME_LIMIT = 48
export const CLASHES_SHOWN = 10

function moreLine(ui: Ui, o: ViewInput, hidden: readonly AgentTreeNode[]) {
  const { Text } = ui
  if (hidden.length === 0) return null
  return <Text color={o.palette.dim}>{o.w.more(hidden.length, hidden.filter(n => n.status === 'running').length)}</Text>
}

export const QUESTION_SHOWN = 1500
export const LOG_QUESTION_INDENT = 17
export const LOG_LINKS = 20
export const LOG_ROW_PREFIX = 19
export const LOG_ROW_ROOM = 30

export type LogInput = ViewInput & {
  filter?: (source: string) => void
  open?: (turn: number) => void
  jump?: (agentId: string) => void
  questions?: ReadonlyMap<number, string>
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function questionTurn(row: AgentTreeLogEntry): number | undefined {
  const turn = row.data?.turn
  return row.source === 'main' && row.kind === 'turn' && typeof turn === 'number' ? turn : undefined
}

function drawLogFilters(ui: Ui, o: LogInput) {
  const { Box, Text, Button } = ui
  const filter = o.filter
  const active = o.s.logFilter
  const cells = [
    { id: 'all', text: capital(o.w.logAll), chosen: !active },
    ...LOG_SOURCES.map(source => ({ id: source, text: capital(o.w.source[source]), chosen: active === source })),
  ]
  const chip = (cell: { id: string; text: string; chosen: boolean }) => {
    const shown = (
      <Text bold={cell.chosen} inverse={cell.chosen} color={cell.chosen ? o.palette.main : o.palette.dim}>
        {` ${cell.text} `}
      </Text>
    )
    return filter ? (
      <Button key={`logfilter:${cell.id}`} plain onPress={() => filter(cell.id)}>
        {shown}
      </Button>
    ) : (
      <Box key={`logfilter:${cell.id}`}>{shown}</Box>
    )
  }
  const inner = cells.reduce((sum, c) => sum + [...c.text].length + 2, 0) + cells.length - 1
  if (inner + 2 > o.width) {
    return (
      <Box key="log-filters" flexDirection="row" flexWrap="wrap" columnGap={1} width={o.width}>
        {cells.map(chip)}
      </Box>
    )
  }
  const edges = frameEdges(o.glyphs, inner + 2)
  const divider = restyleLine('│', o.glyphs)
  return (
    <Box key="log-filters" flexDirection="column" width={o.width}>
      <Box key="log-filter-top">
        <Text color={o.palette.dim}>{edges.top}</Text>
      </Box>
      <Box key="log-filter-row" flexDirection="row">
        <Text color={o.palette.dim}>{o.glyphs.frame.l}</Text>
        {cells.map((cell, i) => (
          <Box key={`log-filter-cell:${cell.id}`} flexDirection="row" flexShrink={0}>
            {i ? <Text color={o.palette.dim}>{divider}</Text> : null}
            {chip(cell)}
          </Box>
        ))}
        <Text color={o.palette.dim}>{o.glyphs.frame.r}</Text>
      </Box>
      <Box key="log-filter-bottom">
        <Text color={o.palette.dim}>{edges.bottom}</Text>
      </Box>
    </Box>
  )
}

function drawQuestion(ui: Ui, o: LogInput, question: string) {
  const { Box, Text } = ui
  const indent = o.width >= LOG_QUESTION_INDENT + 24 ? LOG_QUESTION_INDENT : 0
  const boxWidth = Math.max(8, o.width - indent)
  const total = [...question].length
  const shown = total > QUESTION_SHOWN ? `${cut(question, QUESTION_SHOWN - 1)}…` : question
  const body = [
    <Text key="log-question-text" wrap="wrap">
      {shown}
    </Text>,
    total > QUESTION_SHOWN ? (
      <Text key="log-question-size" color={o.palette.dim}>
        {o.w.logQuestionSize(total)}
      </Text>
    ) : null,
  ]
  if (o.glyphs.border) {
    return (
      <Box key="log-question" marginLeft={indent} width={boxWidth} flexDirection="column" borderStyle={o.glyphs.border} borderColor={o.palette.main} paddingX={1}>
        {body}
      </Box>
    )
  }
  const edges = frameEdges(o.glyphs, boxWidth)
  return (
    <Box key="log-question" marginLeft={indent} width={boxWidth} flexDirection="column">
      <Text color={o.palette.main}>{edges.top}</Text>
      <Box key="log-question-body" flexDirection="column" paddingX={1}>
        {body}
      </Box>
      <Text color={o.palette.main}>{edges.bottom}</Text>
    </Box>
  )
}

export function drawLog(ui: Ui, o: LogInput) {
  const { Box, Text, Button } = ui
  const active = o.s.logFilter
  const rows = [...o.s.log].reverse().filter(row => !active || row.source === active)
  const sourceColor = (source: AgentTreeLogSource) => (source === 'session' ? o.palette.dim : o.palette[source])
  let links = 0
  const drawRow = (row: AgentTreeLogEntry, i: number) => {
    const linked = links < LOG_LINKS
    const turn = questionTurn(row)
    const question = turn === undefined || !o.open || !linked ? undefined : o.questions?.get(turn)
    const target = o.jump && linked && question === undefined ? logTarget(o.s, row) : undefined
    if (question !== undefined || target !== undefined) links += 1
    const isOpen = question !== undefined && o.s.logOpen === turn
    const marker = question !== undefined ? (isOpen ? '  ⌄' : '  ›') : target !== undefined ? '  ›' : ''
    const said = logLine(row, o.lang)
    const room = o.width - LOG_ROW_PREFIX - [...marker].length
    const text = marker && room >= LOG_ROW_ROOM && [...said].length > room ? `${cut(said, room - 1)}…` : said
    const line = (
      <Text key={`log-row:${i}`} wrap="wrap">
        <Text color={o.palette.dim}>{`${clockTime(row.at)}  `}</Text>
        <Text bold color={sourceColor(row.source)}>
          {o.w.source[row.source].padEnd(9)}
        </Text>
        {text}
        {isOpen ? (
          <Text bold color={o.palette.main}>
            {marker}
          </Text>
        ) : (
          marker
        )}
      </Text>
    )
    if (question !== undefined && turn !== undefined && o.open) {
      const open = o.open
      return [
        <Button key={`logopen:${turn}`} plain onPress={() => open(turn)}>
          {line}
        </Button>,
        isOpen ? drawQuestion(ui, o, question) : null,
      ]
    }
    if (target !== undefined && o.jump) {
      const jump = o.jump
      return [
        <Button key={`logjump:${target}:${i}`} plain onPress={() => jump(target)}>
          {line}
        </Button>,
      ]
    }
    return [line]
  }
  const drawn = rows.flatMap(drawRow)
  return (
    <Box key="log-view" flexDirection="column" width={o.width} marginTop={1}>
      {drawLogFilters(ui, o)}
      <Text key="log-head" color={o.palette.dim} wrap="truncate-end">
        {`${o.w.log} · ${o.w.logEntries(rows.length)} · ${o.w.logOrder}`}
      </Text>
      {links > 0 ? (
        <Text key="log-hint" color={o.palette.dim} wrap="wrap">
          {o.w.logHint}
        </Text>
      ) : null}
      {rows.length === 0 ? (active ? null : <Text color={o.palette.dim}>{o.w.logEmpty}</Text>) : drawn}
    </Box>
  )
}

function shortName(name: string): string {
  return [...name].length > FILE_NAME_LIMIT ? `${cut(name, FILE_NAME_LIMIT - 1)}…` : name
}

export function drawFiles(ui: Ui, o: ViewInput) {
  const { Box, Text } = ui
  const nameOf = (id: string) => (id === MAIN ? o.w.main : (o.s.agents.find(n => n.id === id)?.description ?? id))
  const seen = new Set<string>()
  const clashes: string[] = []
  for (const n of o.s.agents) {
    const clash = clashShown(o.s, n.id)
    if (!clash) continue
    const pair = [n.id, clash.with].sort().join('|')
    const key = `${clash.file}|${pair}`
    if (seen.has(key)) continue
    seen.add(key)
    const [first = n.id, second = clash.with] = pair.split('|')
    clashes.push(`${shortName(clash.file)} · ${nameOf(first)} + ${nameOf(second)}`)
  }
  const everyone = o.s.agents.filter(n => n.changed?.length || n.read?.length)
  const withFiles = everyone.slice(-TAB_AGENTS)
  let budget = FILES_BUDGET
  const fitted = (names: readonly string[] | undefined, tokens?: Record<string, number>): string[] => {
    const kept: string[] = []
    const order = tokens ? [...(names ?? [])].sort((x, y) => (tokens[x] ?? 0) - (tokens[y] ?? 0)) : [...(names ?? [])]
    for (const name of order.reverse()) {
      const estimate = tokens?.[name]
      const text = estimate === undefined ? shortName(name) : `${shortName(name)} ~${fmtTokens(estimate, o.w.decimal)}`
      if (budget < text.length + 3) break
      budget -= text.length + 3
      kept.push(text)
    }
    return kept
  }
  const newestFirst = [...withFiles].reverse()
  const changedOf = new Map(newestFirst.map(n => [n.id, fitted(n.changed)]))
  const readOf = new Map(newestFirst.map(n => [n.id, fitted(n.read, n.readTokens)]))
  const list = (label: string, names: readonly string[] | undefined, kept: readonly string[], tokens?: Record<string, number>) => {
    const total = names?.length ?? 0
    const rest = total - kept.length
    const shown = [...kept, ...(rest > 0 ? [`+${rest}`] : [])]
    const sum = tokens ? Object.values(tokens).reduce((a, b) => a + b, 0) : 0
    return `${label} (${total}${sum ? `, ~${fmtTokens(sum, o.w.decimal)}` : ''})${shown.length ? `: ${shown.join(' · ')}` : ''}`
  }
  return (
    <Box key="files-view" flexDirection="column" width={o.width} marginTop={1}>
      {clashes.length ? (
        <Box key="files-clash" flexDirection="column" width={o.width}>
          <Text bold color={o.palette.warn}>{`⚠ ${o.w.filesClash}`}</Text>
          {clashes.slice(0, CLASHES_SHOWN).map((line, i) => (
            <Text key={`clash:${i}`} color={o.palette.warn} wrap="wrap">
              {line}
            </Text>
          ))}
          {clashes.length > CLASHES_SHOWN ? <Text color={o.palette.warn}>{`+${clashes.length - CLASHES_SHOWN}`}</Text> : null}
        </Box>
      ) : null}
      {withFiles.length === 0 ? (
        <Text color={o.palette.dim}>{o.w.filesNone}</Text>
      ) : (
        withFiles.map((n, i) => (
          <Box key={`files:${n.id}`} flexDirection="column" width={o.width} marginTop={i > 0 || clashes.length ? 1 : 0}>
            <Text bold color={o.palette.agent} wrap="truncate-end">
              {`${typeLabel(n.type)} · ${n.description}`}
            </Text>
            <Text wrap="wrap">{list(o.w.changedFiles, n.changed, changedOf.get(n.id) ?? [])}</Text>
            <Text color={o.palette.dim} wrap="wrap">
              {list(o.w.readFiles, n.read, readOf.get(n.id) ?? [], n.readTokens)}
            </Text>
          </Box>
        ))
      )}
      {moreLine(ui, o, everyone.slice(0, everyone.length - withFiles.length))}
    </Box>
  )
}

export const USAGE_BAR = 5

export function usageRows(s: AgentTreeState): AgentTreeNode[] {
  return [...s.agents].sort((a, b) => (b.contextTokens ?? -1) - (a.contextTokens ?? -1))
}

export type UsageInput = ViewInput & {
  now: number
  limits: readonly { text: string; color: string }[]
  mainLine: string
}

export function drawUsage(ui: Ui, o: UsageInput) {
  const { Box, Text } = ui
  const sorted = usageRows(o.s)
  const rows = sorted.slice(0, TAB_AGENTS)
  const levelColor = (percent: number | undefined) => {
    const level = percent === undefined ? 'ok' : contextLevel(percent)
    return level === 'alert' ? o.palette.failed : level === 'warn' ? o.palette.warn : o.palette.agent
  }
  const bar = (percent: number) => {
    const filled = Math.max(0, Math.min(USAGE_BAR, Math.round((percent / 100) * USAGE_BAR)))
    return `${o.glyphs.bar.full.repeat(filled)}${o.glyphs.bar.empty.repeat(USAGE_BAR - filled)}`
  }
  const cell = (key: string, width: number, text: string, color?: string) => (
    <Box key={key} width={width} flexShrink={0}>
      <Text color={color} wrap="truncate-end">
        {text}
      </Text>
    </Box>
  )
  return (
    <Box key="usage-view" flexDirection="column" width={o.width} marginTop={1}>
      {o.limits.map((l, i) => (
        <Text key={`usage-limit:${i}`} color={l.color} wrap="truncate-end">
          {l.text}
        </Text>
      ))}
      <Text wrap="truncate-end">
        <Text bold color={o.palette.main}>
          {o.w.main}
        </Text>
        {` · ${o.mainLine}`}
      </Text>
      {rows.length === 0 ? (
        <Box key="usage-none" marginTop={1}>
          <Text color={o.palette.dim}>{o.w.noAgents}</Text>
        </Box>
      ) : (
        <Box key="usage-table" flexDirection="column" width={o.width} marginTop={1}>
          <Box key="usage-head" flexDirection="row" columnGap={1}>
            <Box key="usage-head-name" flexGrow={1} flexShrink={1}>
              <Text color={o.palette.dim} wrap="truncate-end">
                {o.w.agents}
              </Text>
            </Box>
            {cell('usage-head-model', 12, o.w.model, o.palette.dim)}
            {cell('usage-head-context', 14, o.w.context, o.palette.dim)}
            {cell('usage-head-tools', 10, o.w.tools, o.palette.dim)}
            {cell('usage-head-time', 8, o.w.duration, o.palette.dim)}
          </Box>
          {rows.map(n => {
            const percent = contextPercent(n.contextTokens, windowOf(o.s, n))
            const context =
              percent !== undefined
                ? `${bar(percent)} ${o.w.percent(Math.round(percent))}`
                : n.contextTokens !== undefined
                  ? fmtTokens(n.contextTokens, o.w.decimal)
                  : '·'
            return (
              <Box key={`usage:${n.id}`} flexDirection="row" columnGap={1}>
                <Box key={`usage-name:${n.id}`} flexGrow={1} flexShrink={1}>
                  <Text wrap="truncate-end">{`${n.description} · ${typeLabel(n.type)}`}</Text>
                </Box>
                {cell(`usage-model:${n.id}`, 12, modelLabel(n.model) || '·')}
                {cell(`usage-context:${n.id}`, 14, context, levelColor(percent))}
                {cell(`usage-tools:${n.id}`, 10, String(n.toolCount))}
                {cell(`usage-time:${n.id}`, 8, fmtShortDuration((n.endedAt ?? o.now) - n.startedAt))}
              </Box>
            )
          })}
          {moreLine(ui, o, sorted.slice(TAB_AGENTS))}
        </Box>
      )}
    </Box>
  )
}

export function drawHelp(ui: Ui, o: HelpInput) {
  const { Box, Text, Button } = ui
  const section = (key: string, title: string, lines: readonly (string | { text: string; color: string })[]) => (
    <Box key={key} flexDirection="column" width={o.width} marginTop={1}>
      <Text bold color={o.palette.main}>
        {title}
      </Text>
      {lines.map((line, i) =>
        typeof line === 'string' ? (
          <Text key={`${key}:${i}`} wrap="wrap">
            {line}
          </Text>
        ) : (
          <Text key={`${key}:${i}`} wrap="wrap" color={line.color}>
            {line.text}
          </Text>
        ),
      )}
    </Box>
  )
  const glyphLines = [
    { text: `${o.glyphs.spinner[0] ?? ''} ${o.w.status.running}`, color: statusColor(o.palette, 'running') },
    { text: `${o.glyphs.marks.done} ${o.w.status.done}`, color: statusColor(o.palette, 'done') },
    { text: `${o.glyphs.marks.failed} ${o.w.status.failed}`, color: statusColor(o.palette, 'failed') },
    { text: `${o.glyphs.marks.stopped} ${o.w.status.stopped}`, color: statusColor(o.palette, 'stopped') },
    { text: `⚠ ${o.w.filesClash}`, color: o.palette.warn },
  ]
  return (
    <Box key="help-view" flexDirection="column" width={o.width}>
      {section('help-keys', o.w.helpKeys, helpItems(o.w, o.s.main.fast !== undefined))}
      {o.docked ? section('help-size', o.w.helpSize, o.w.helpSizeLines) : null}
      {section('help-version', `${o.w.helpVersion} ${VERSION}`, [...newsBetween(undefined, VERSION, o.lang), o.w.helpCodeMode])}
      {section('help-glyphs', o.w.helpGlyphs, glyphLines)}
      {section('help-commands', o.w.helpCommands, [`/agent-tree ${o.w.commandHint}`])}
      {section('help-guide', o.w.helpGuide, [o.w.guideUrl])}
      {o.starAsk ? (
        <Box key="help-star" flexDirection="column" width={o.width} marginTop={1}>
          <Text key="help-star:text" wrap="wrap" bold color={o.palette.warn}>
            {o.w.starAsk}
          </Text>
          <Text key="help-star:url" wrap="truncate-end" color={o.palette.warn}>
            {o.w.starUrl}
          </Text>
          {o.starOff ? <Button key="star:off" plain label={`× ${o.w.starAskOff}`} onPress={o.starOff} /> : null}
        </Box>
      ) : null}
    </Box>
  )
}

export type ReportsInput = ViewInput & {
  now: number
  agentId?: string
  report?: AgentTreeReport
  pick?: (agentId: string) => void
}

export function drawReports(ui: Ui, o: ReportsInput) {
  const { Box, Text, Button, Markdown } = ui
  const pick = o.pick
  const node = o.s.agents.find(n => n.id === o.agentId)
  if (!node) {
    return (
      <Box key="reports-view" flexDirection="column" width={o.width} marginTop={1}>
        <Text color={o.palette.dim}>{o.w.noAgents}</Text>
      </Box>
    )
  }
  const mark = (n: AgentTreeNode) => (n.status === 'running' ? (o.glyphs.spinner[0] ?? '') : o.glyphs.marks[n.status])
  const recent = o.s.agents.slice(-TAB_AGENTS)
  const chips = recent.some(n => n.id === node.id) ? recent : [node, ...recent.slice(1)]
  const chip = (n: AgentTreeNode) => {
    const chosen = n.id === node.id
    const shown = (
      <Text bold={chosen} inverse={chosen} color={chosen ? o.palette.main : o.palette.dim}>
        {` ${mark(n)} ${[...n.description].slice(0, 24).join('')} `}
      </Text>
    )
    return pick ? (
      <Button key={`report:${n.id}`} plain onPress={() => pick(n.id)}>
        {shown}
      </Button>
    ) : (
      <Box key={`report:${n.id}`}>{shown}</Box>
    )
  }
  const report = o.report?.agentId === node.id ? o.report : undefined
  const task = report?.task ?? node.task
  const answer = report?.answer ?? node.answer
  const note = report?.state === 'denied' ? o.w.noAccess : report?.state === 'ready' ? undefined : o.w.loading
  return (
    <Box key="reports-view" flexDirection="column" width={o.width} marginTop={1}>
      <Box key="report-agents" flexDirection="row" flexWrap="wrap" columnGap={1} width={o.width}>
        {chips.map(chip)}
      </Box>
      {moreLine(ui, o, o.s.agents.filter(n => !chips.includes(n)))}
      <Box key="report-body" flexDirection="column" width={o.width} marginTop={1}>
        <Text bold color={o.palette.agent} wrap="truncate-end">
          {`${typeLabel(node.type)} · ${node.description} · ${modelLabel(node.model) || o.w.model} · ${o.w.status[node.status]} · ${fmtShortDuration((node.endedAt ?? o.now) - node.startedAt)}`}
        </Text>
        {note ? <Text color={o.palette.dim}>{note}</Text> : null}
        <Text color={o.palette.dim}>{o.w.task}</Text>
        <Text wrap="wrap">{task || '?'}</Text>
        <Text color={o.palette.dim}>{node.status === 'running' ? o.w.latest : o.w.reply}</Text>
        {!answer ? <Text color={o.palette.dim}>{o.w.noReply}</Text> : Markdown ? <Markdown key="report-answer" text={answer} /> : <Text wrap="wrap">{answer}</Text>}
      </Box>
    </Box>
  )
}
