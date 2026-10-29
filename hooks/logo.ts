// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
export const LOGO_MAP = [
  '.............',
  '....OOOOO....',
  '....OOOOO....',
  '......G......',
  '..GGGGGGGGG..',
  '.BBB.BBB.NNN.',
  '.BBB.BBB.NNN.',
  '.BBB.BBB.NNN.',
  '..GGGGGGGGG..',
  '......G......',
  '....OOOOO....',
  '....OOOOO....',
  '.............',
] as const

export const LOGO_SIZE = LOGO_MAP.length
export const LOGO_COLORS: Readonly<Record<string, string>> = { O: '#E6845D', G: '#8E8E9A', B: '#7CAAE8', N: '#7BE396' }
export const LOGO_EMPTY = '#252532'
export const LOGO_FLASH = '#F4F4FC'
export const LOGO_TITLE = LOGO_COLORS.O ?? '#E6845D'
const FLASH_MS = 80
const GREEN_FROM = 760

export const INTRO_MS = 2000
export const GROW_TO = 1000
export type IntroPhase = 'grow' | 'hold' | 'done'

export function introPhase(ms: number): IntroPhase {
  return ms >= INTRO_MS ? 'done' : ms >= GROW_TO ? 'hold' : 'grow'
}

export function cellTime(r: number, c: number): number {
  if (r === 1 || r === 2) return 40 + (160 * (Math.abs(c - 6) / 2 + (r - 1) * 0.5)) / 2.5
  if (r === 3) return 230
  if (r === 4) return 270 + 30 * Math.abs(c - 6)
  if (r >= 5 && r <= 7) {
    const box = Math.floor((c - 1) / 4)
    return 430 + 40 * box + 50 * (r - 5) + 20 * Math.abs(c - (2 + 4 * box))
  }
  if (r === 8) return 680 + 30 * (4 - Math.abs(c - 6))
  if (r === 9) return 840
  if (r === 10 || r === 11) return 870 + (130 * (Math.abs(c - 6) / 2 + (r - 10) * 0.5)) / 2.5
  return 0
}

export function cellColor(r: number, c: number, ms: number): string {
  const kind = LOGO_MAP[r]?.[c] ?? '.'
  if (kind === '.') return LOGO_EMPTY
  const start = cellTime(r, c)
  if (ms < start) return LOGO_EMPTY
  if (ms < start + FLASH_MS) return LOGO_FLASH
  if (kind === 'N' && ms < GREEN_FROM) return LOGO_COLORS.B ?? LOGO_EMPTY
  if (kind === 'N' && ms < GREEN_FROM + FLASH_MS) return LOGO_FLASH
  return LOGO_COLORS[kind] ?? LOGO_EMPTY
}

export type LogoLayout = { cell: number; pitch: number; glyphs: readonly string[]; width: number; height: number }

export const LOGO_FULL: LogoLayout = { cell: 3, pitch: 4, glyphs: ['█', '▀'], width: 51, height: 26 }
export const LOGO_SMALL: LogoLayout = { cell: 1, pitch: 2, glyphs: ['▀'], width: 25, height: 13 }

export function logoLayout(cols: number, rows: number): LogoLayout | undefined {
  if (cols >= LOGO_FULL.width && rows >= LOGO_FULL.height) return LOGO_FULL
  if (cols >= LOGO_SMALL.width && rows >= LOGO_SMALL.height) return LOGO_SMALL
  return undefined
}

export type LogoRun = { text: string; color?: string }

function joined(runs: readonly LogoRun[]): LogoRun[] {
  const out: LogoRun[] = []
  for (const run of runs) {
    if (!run.text) continue
    const last = out[out.length - 1]
    if (last && last.color === run.color) last.text += run.text
    else out.push(run.color ? { text: run.text, color: run.color } : { text: run.text })
  }
  return out
}

export function logoRows(ms: number, layout: LogoLayout, cols: number, rows: number): LogoRun[][] {
  const left = Math.max(0, Math.floor((cols - layout.width) / 2))
  const top = Math.max(0, Math.floor((rows - layout.height) / 2))
  const span = layout.glyphs.length
  return Array.from({ length: rows }, (_, y) => {
    const inside = y - top
    const r = Math.floor(inside / span)
    if (inside < 0 || r >= LOGO_SIZE) return [{ text: ' '.repeat(cols) }]
    const glyph = layout.glyphs[inside % span] ?? '▀'
    const runs: LogoRun[] = [{ text: ' '.repeat(left) }]
    for (let c = 0; c < LOGO_SIZE; c++) {
      if (c > 0) runs.push({ text: ' '.repeat(layout.pitch - layout.cell) })
      runs.push({ text: glyph.repeat(layout.cell), color: cellColor(r, c, ms) })
    }
    runs.push({ text: ' '.repeat(Math.max(0, cols - left - layout.width)) })
    return joined(runs)
  })
}
