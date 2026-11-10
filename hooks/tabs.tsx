// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { Elements } from 'claude-code'

import type { AgentTreeTab } from '../types'
import { logoMark } from './logo.ts'
import { frameEdges, restyleLine } from './looks.ts'
import type { Glyphs, Palette } from './looks.ts'
import { TABS } from './model.ts'

type Ui = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

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
  if (tight) return stripLines(names, width)
  return reiterPad(names, width) === undefined ? stripLines(names, width) + 1 : 3
}

export function drawMark(ui: Ui) {
  const { Box, Text } = ui
  return (
    <Box key="mark" flexDirection="row" flexShrink={0}>
      {logoMark().map((cell, i) =>
        cell.top && cell.bottom ? (
          <Text key={`mark:${i}`} color={cell.top} backgroundColor={cell.bottom}>
            {'▀'}
          </Text>
        ) : cell.top ? (
          <Text key={`mark:${i}`} color={cell.top}>
            {'▀'}
          </Text>
        ) : (
          <Text key={`mark:${i}`} color={cell.bottom}>
            {cell.bottom ? '▄' : ' '}
          </Text>
        ),
      )}
    </Box>
  )
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
  const pad = o.tight ? undefined : reiterPad(o.names, o.width)
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
