// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
type Drawn = { type?: unknown; props?: Record<string, unknown>; children?: unknown } | string | number | null | undefined | boolean | readonly unknown[]

import type { Elements, RenderElement } from 'claude-code'

type Ui = Pick<Elements['terminal'], 'Box' | 'Text'>

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function kids(node: Drawn): unknown[] {
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(n => (Array.isArray(n) ? kids(n) : [n]))
  if (typeof node !== 'object') return []
  const own = (node as { children?: unknown }).children ?? (node as { props?: { children?: unknown } }).props?.children
  if (own === undefined || own === null) return []
  return Array.isArray(own) ? own.flatMap(n => (Array.isArray(n) ? kids(n) : [n])) : [own]
}

function plain(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(plain).join('')
  const props = (node as { props?: Record<string, unknown> }).props ?? {}
  const label = typeof props.label === 'string' ? props.label : ''
  return label + kids(node as Drawn).map(plain).join('')
}

function textRows(text: string, width: number, wraps: boolean): number {
  const lines = text.split('\n')
  if (!wraps) return lines.length
  const room = Math.max(1, width)
  return lines.reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].length / room)), 0)
}

export function rowsOf(node: unknown, width: number): number {
  if (node === null || node === undefined || typeof node === 'boolean') return 0
  if (typeof node === 'string' || typeof node === 'number') return textRows(String(node), width, true)
  if (Array.isArray(node)) return node.reduce((sum: number, n) => sum + rowsOf(n, width), 0)
  const element = node as { type?: unknown; props?: Record<string, unknown> }
  const props = element.props ?? {}
  if (props.display === 'none' || props.position === 'absolute') return 0
  const type = typeof element.type === 'string' ? element.type : typeof element.type === 'function' ? (element.type as { name?: string }).name ?? '' : ''
  const own = typeof props.width === 'number' ? Math.min(props.width, width) : width
  if (type === 'Text' || type === 'Markdown') {
    const wraps = typeof props.wrap !== 'string' || props.wrap === 'wrap'
    const body = type === 'Markdown' && typeof props.children === 'string' ? props.children : plain(node)
    return textRows(body, own, wraps)
  }
  if (type === 'Button') return 1
  const border = props.borderStyle ? 2 : 0
  const padY = num(props.paddingY) * 2 + num(props.paddingTop) + num(props.paddingBottom) + num(props.padding) * 2
  const padX = num(props.paddingX) * 2 + num(props.paddingLeft) + num(props.paddingRight) + num(props.padding) * 2
  const margin = num(props.marginY) * 2 + num(props.marginTop) + num(props.marginBottom) + num(props.margin) * 2
  const inner = Math.max(1, own - border - padX)
  const children = kids(node as Drawn).filter(c => c !== null && c !== undefined && typeof c !== 'boolean')
  if (typeof props.height === 'number') return props.height + margin
  const column = props.flexDirection === 'column' || props.flexDirection === 'column-reverse'
  const gap = num(props.rowGap) || num(props.gap)
  const body = column
    ? children.reduce((sum: number, c) => sum + rowsOf(c, inner), 0) + gap * Math.max(0, children.length - 1)
    : children.reduce((most: number, c) => Math.max(most, rowsOf(c, inner)), 0)
  return body + border + padY + margin
}

export type ScrollWindow = { offset: number; rows: number; total: number }

export function thumbOf(view: ScrollWindow): { start: number; size: number } | undefined {
  const { rows, total } = view
  if (rows < 2 || total <= rows) return undefined
  const size = Math.max(1, Math.min(rows, Math.round((rows * rows) / total)))
  const travel = rows - size
  const reach = Math.max(1, total - rows)
  const offset = Math.max(0, Math.min(view.offset, reach))
  return { start: Math.round((offset / reach) * travel), size }
}

export function withScrollBar(ui: Ui, drawn: RenderElement, width: number, view: ScrollWindow, colors: { track: string; thumb: string }): RenderElement {
  const thumb = thumbOf(view)
  if (!thumb) return drawn
  const { Box, Text } = ui
  const top = Math.max(0, Math.min(view.offset, view.total - view.rows))
  return (
    <Box key="scrollbar-frame" flexDirection="column" width={width + 1}>
      {drawn}
      <Box key="scrollbar" position="absolute" top={top} left={width} width={1} height={view.rows} flexDirection="column">
        {Array.from({ length: view.rows }, (_, i) => {
          const on = i >= thumb.start && i < thumb.start + thumb.size
          return (
            <Text key={`scrollbar:${i}`} color={on ? colors.thumb : colors.track}>
              {on ? '┃' : '│'}
            </Text>
          )
        })}
      </Box>
    </Box>
  )
}
