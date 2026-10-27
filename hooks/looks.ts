// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { AgentTreeColors, AgentTreeLight, AgentTreeLook, AgentTreeStyle } from '../types'

export type Palette = { main: string; agent: string; advisor: string; done: string; dim: string; failed: string }

export type FrameGlyphs = {
  tl: string
  t: string
  tr: string
  l: string
  r: string
  bl: string
  b: string
  br: string
  tickLeft?: string
  tickRight?: string
}

export type Glyphs = {
  border?: string
  strongBorder?: string
  frame: FrameGlyphs
  lines: Record<string, string>
  node: string
  bar: { full: string; empty: string; litFull: string; litEmpty: string }
  spinner: string[]
  effort: [string, string]
  marks: { done: string; failed: string; stopped: string; legend: string }
  rail: { v: string; h: string; head: string }
}

export const DEFAULT_LOOK: AgentTreeLook = { style: 'line', colors: 'original', light: 'standard' }

export const LOOK_OPTIONS = {
  style: ['line', 'pixel', 'braille', 'hud', 'ascii'],
  colors: ['original', 'light', 'retro', 'mono'],
  light: ['standard', 'white', 'gold', 'cyan', 'magenta'],
} as const satisfies { style: readonly AgentTreeStyle[]; colors: readonly AgentTreeColors[]; light: readonly AgentTreeLight[] }

export type LookRow = keyof typeof LOOK_OPTIONS

export const LOOK_ROWS: readonly LookRow[] = ['style', 'colors', 'light']

export function isLookChoice(row: string, id: string): row is LookRow {
  return (LOOK_ROWS as readonly string[]).includes(row) && (LOOK_OPTIONS[row as LookRow] as readonly string[]).includes(id)
}

export const PALETTES: Record<AgentTreeColors, Palette> = {
  original: { main: '#E6845D', agent: '#7CAAE8', advisor: '#B1A7E6', done: '#7BE396', dim: '#8E8E9A', failed: 'error' },
  light: { main: '#BC4C00', agent: '#0969DA', advisor: '#8250DF', done: '#1A7F37', dim: '#59636E', failed: '#D1242F' },
  retro: { main: '#B8C76F', agent: '#70A4B2', advisor: '#8C80D6', done: '#9AD284', dim: '#959595', failed: '#B08070' },
  mono: { main: '#F2F2F5', agent: '#D2D2D8', advisor: '#B8B8C0', done: '#A3A3AC', dim: '#8E8E9A', failed: 'error' },
}

export const LIGHTS: Record<AgentTreeLight, string | undefined> = {
  standard: undefined,
  white: '#FFFFFF',
  gold: '#F2C14E',
  cyan: '#5FE1EA',
  magenta: '#F07AC0',
}

export const LIGHTS_ON_LIGHT: Record<AgentTreeLight, string | undefined> = {
  standard: undefined,
  white: '#1F2328',
  gold: '#9A6700',
  cyan: '#1B7C83',
  magenta: '#BF3989',
}

export function lightColor(look: AgentTreeLook): string | undefined {
  return (look.colors === 'light' ? LIGHTS_ON_LIGHT : LIGHTS)[look.light]
}

const LINE_GLYPHS = ['─', '│', '┌', '┐', '└', '┘', '┼', '├', '┤', '┬', '┴', '▼', '•', '·']

function lineMap(chars: string): Record<string, string> {
  const out = [...chars]
  return Object.fromEntries(LINE_GLYPHS.map((glyph, i) => [glyph, out[i] ?? glyph]))
}

export const STYLES: Record<AgentTreeStyle, Glyphs> = {
  line: {
    border: 'single',
    strongBorder: 'bold',
    frame: { tl: '┌', t: '─', tr: '┐', l: '│', r: '│', bl: '└', b: '─', br: '┘' },
    lines: lineMap('─│┌┐└┘┼├┤┬┴▼•·'),
    node: '●',
    bar: { full: '█', empty: '░', litFull: '▓', litEmpty: '▒' },
    spinner: ['◐', '◓', '◑', '◒'],
    effort: ['▮', '▯'],
    marks: { done: '●', failed: '✗', stopped: '○', legend: '■' },
    rail: { v: '┆', h: '┄', head: '▶' },
  },
  pixel: {
    frame: { tl: '▗', t: '▄', tr: '▖', l: '▐', r: '▌', bl: '▝', b: '▀', br: '▘' },
    lines: lineMap('━┃┏┓┗┛╋┣┫┳┻▼▪·'),
    node: '■',
    bar: { full: '█', empty: '▁', litFull: '▒', litEmpty: '▂' },
    spinner: ['▖', '▘', '▝', '▗'],
    effort: ['■', '□'],
    marks: { done: '■', failed: '✕', stopped: '□', legend: '■' },
    rail: { v: '▐', h: '━', head: '▶' },
  },
  braille: {
    frame: { tl: '⡏', t: '⠉', tr: '⢹', l: '⡇', r: '⢸', bl: '⣇', b: '⣀', br: '⣸' },
    lines: lineMap('⠒⡇⡖⡆⠓⠃⡗⡗⡇⡖⠓▾⠶⠂'),
    node: '⣿',
    bar: { full: '⣿', empty: '⣀', litFull: '⣷', litEmpty: '⣤' },
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    effort: ['⣿', '⣀'],
    marks: { done: '⣿', failed: '✕', stopped: '⣀', legend: '⣿' },
    rail: { v: '⡇', h: '⠒', head: '▸' },
  },
  hud: {
    frame: { tl: '┌', t: ' ', tr: '┐', l: ' ', r: ' ', bl: '└', b: ' ', br: '┘', tickLeft: '╴', tickRight: '╶' },
    lines: lineMap('╌╎┌┐└┘┼├┤┬┴▾◆◇'),
    node: '◆',
    bar: { full: '━', empty: '─', litFull: '◆', litEmpty: '◇' },
    spinner: ['◜', '◠', '◝', '◞', '◡', '◟'],
    effort: ['▰', '▱'],
    marks: { done: '◉', failed: '✕', stopped: '◌', legend: '◆' },
    rail: { v: '╎', h: '╌', head: '▸' },
  },
  ascii: {
    border: 'classic',
    frame: { tl: '+', t: '-', tr: '+', l: '|', r: '|', bl: '+', b: '-', br: '+' },
    lines: lineMap('-|+++++++++v*.'),
    node: 'o',
    bar: { full: '#', empty: '.', litFull: '=', litEmpty: ':' },
    spinner: ['-', '\\', '|', '/'],
    effort: ['#', '.'],
    marks: { done: '*', failed: 'x', stopped: 'o', legend: '#' },
    rail: { v: ':', h: '-', head: '>' },
  },
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export function lookFrom(value: unknown): AgentTreeLook {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return {
    style: oneOf(raw.style, LOOK_OPTIONS.style, DEFAULT_LOOK.style),
    colors: oneOf(raw.colors, LOOK_OPTIONS.colors, DEFAULT_LOOK.colors),
    light: oneOf(raw.light, LOOK_OPTIONS.light, DEFAULT_LOOK.light),
  }
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

export function contrast(fg: string, bg: string): number {
  const [high, low] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

export function frameEdges(glyphs: Glyphs, width: number): { top: string; bottom: string } {
  const f = glyphs.frame
  if (width <= 1) return { top: f.tl, bottom: f.bl }
  const inner = width - 2
  const edge = (fill: string) =>
    f.tickLeft && f.tickRight && inner >= 2 ? f.tickLeft + fill.repeat(inner - 2) + f.tickRight : fill.repeat(inner)
  return { top: f.tl + edge(f.t) + f.tr, bottom: f.bl + edge(f.b) + f.br }
}

export function restyleLine(line: string, glyphs: Glyphs): string {
  return [...line].map(ch => glyphs.lines[ch] ?? ch).join('')
}
