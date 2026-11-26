// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { LOGO_COLORS, LOGO_EMPTY, LOGO_FLASH, LOGO_SIZE, cellColor } from './logo.ts'
import type { LogoLayout, LogoRun } from './logo.ts'

export type Holiday = 'christmas' | 'newyear' | 'halloween' | 'easter'

export const HOLIDAY_COLS = 21
export const HOLIDAY_ROWS = 17
export const HOLIDAY_MS = 3000
export const GREETING_FROM = 1800
export const GREETING_STEP = 35
const LOGO_X = 4
const LOGO_Y = 2
const FLASH_MS = 80
const GOLD = '#F2C14E'
const SNOW = '#F4F4FC'
const GROUND = '#C9D2E6'
const ORANGE = LOGO_COLORS.O ?? '#E6845D'
const GREY = LOGO_COLORS.G ?? '#8E8E9A'
const BLUE = LOGO_COLORS.B ?? '#7CAAE8'
const GREEN = LOGO_COLORS.N ?? '#7BE396'

export const HOLIDAY_FULL: LogoLayout = { cell: 3, pitch: 4, glyphs: ['█', '▀'], width: HOLIDAY_COLS * 4 - 1, height: HOLIDAY_ROWS * 2 }
export const HOLIDAY_SMALL: LogoLayout = { cell: 1, pitch: 2, glyphs: ['▀'], width: HOLIDAY_COLS * 2 - 1, height: HOLIDAY_ROWS }

export function holidayLayout(cols: number, rows: number): LogoLayout | undefined {
  if (cols >= HOLIDAY_FULL.width && rows >= HOLIDAY_FULL.height) return HOLIDAY_FULL
  if (cols >= HOLIDAY_SMALL.width && rows >= HOLIDAY_SMALL.height) return HOLIDAY_SMALL
  return undefined
}

function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

const DAY_MS = 86_400_000

function dayNumber(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

export function holidayAt(epochMs: number): Holiday | undefined {
  const date = new Date(epochMs)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (month === 12 && day >= 24 && day <= 26) return 'christmas'
  if ((month === 12 && day === 31) || (month === 1 && day === 1)) return 'newyear'
  if (month === 10 && day === 31) return 'halloween'
  const easter = easterSunday(year)
  const offset = dayNumber(year, month, day) - dayNumber(year, easter.month, easter.day)
  if (offset >= -2 && offset <= 1) return 'easter'
  return undefined
}

export function newYearOf(epochMs: number): number {
  const date = new Date(epochMs)
  return date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear()
}

type Spot = readonly [x: number, y: number, color: string, from: number]
type Field = Map<string, string>

const spot = (x: number, y: number) => `${x},${y}`

function flashIn(field: Field, spots: readonly Spot[], ms: number): void {
  for (const [x, y, color, from] of spots) if (ms >= from) field.set(spot(x, y), ms < from + FLASH_MS ? LOGO_FLASH : color)
}

function falling(field: Field, flakes: readonly (readonly [x: number, endY: number, from: number])[], ms: number): void {
  for (const [x, endY, from] of flakes) {
    if (ms < from) continue
    const y = Math.min(endY, -1 + Math.floor((ms - from) / 70))
    if (y >= 0) field.set(spot(x, y), SNOW)
  }
}

function christmas(ms: number): Field {
  const field: Field = new Map()
  falling(field, [[1, 2, 1000], [19, 1, 1060], [3, 6, 1120], [17, 4, 1180], [0, 9, 1240], [20, 7, 1300], [2, 12, 1360], [18, 10, 1420], [1, 14, 1480], [19, 13, 1540]], ms)
  const ground: Spot[] = Array.from({ length: HOLIDAY_COLS }, (_, x) => [x, 16, GROUND, 1500 + 35 * Math.abs(x - 10)])
  const star: Spot[] = [[10, 0, GOLD, 1150], [9, 1, GOLD, 1230], [11, 1, GOLD, 1230], [10, 1, GOLD, 1190], [10, 2, GOLD, 1270]]
  flashIn(field, [...ground, ...star], ms)
  return field
}

function newYear(ms: number): Field {
  const field: Field = new Map()
  const rockets: Spot[] = [[2, 4, ORANGE, 1000], [18, 3, BLUE, 1250], [18, 12, GOLD, 1500], [2, 12, GREEN, 1750]]
  for (const [cx, cy, color, from] of rockets) {
    const flight = 30 * (16 - cy)
    if (ms >= from && ms < from + flight) {
      field.set(spot(cx, 16 - Math.floor((ms - from) / 30)), GREY)
      continue
    }
    const burst = from + flight
    if (ms < burst) continue
    const sparks: Spot[] = [[cx, cy, color, burst]]
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) sparks.push([cx + dx, cy + dy, color, burst + 60])
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) sparks.push([cx + dx, cy + dy, color, burst + 130])
    flashIn(field, sparks.filter(([x, y]) => x >= 0 && x < HOLIDAY_COLS && y >= 0 && y < HOLIDAY_ROWS), ms)
  }
  return field
}

function halloween(ms: number): Field {
  const field: Field = new Map()
  const moon: Spot[] = [[1, 0, GOLD, 1100], [2, 0, GOLD, 1140], [0, 1, GOLD, 1180], [0, 2, GOLD, 1220], [1, 3, GOLD, 1260], [2, 3, GOLD, 1300]]
  const pumpkin: Spot[] = [[2, 11, GREEN, 1500], [1, 12, ORANGE, 1540], [2, 12, ORANGE, 1540]]
  for (let x = 0; x < 4; x++) pumpkin.push([x, 13, x === 1 || x === 2 ? GOLD : ORANGE, 1580])
  for (let x = 0; x < 4; x++) pumpkin.push([x, 14, ORANGE, 1620])
  pumpkin.push([1, 15, ORANGE, 1660], [2, 15, ORANGE, 1660])
  flashIn(field, [...moon, ...pumpkin], ms)
  for (const [targetX, y, from] of [[17, 1, 1000], [18, 6, 1200], [17, 10, 1400]] as const) {
    if (ms < from) continue
    const x = Math.max(targetX, 23 - Math.floor((ms - from) / 60))
    const wingsUp = x === targetX || Math.floor(ms / 120) % 2 === 0
    const shape = wingsUp ? [[0, 0], [1, 1], [2, 0]] : [[0, 1], [1, 0], [2, 1]]
    for (const [dx, dy] of shape) if (x + (dx ?? 0) >= 0 && x + (dx ?? 0) < HOLIDAY_COLS) field.set(spot(x + (dx ?? 0), y + (dy ?? 0)), GREY)
  }
  return field
}

function egg(left: number, base: string, stripe: string, from: number): Spot[] {
  const shape: [number, number, string][] = [[1, 0, base], [0, 1, base], [1, 1, base], [2, 1, base], [0, 2, stripe], [1, 2, stripe], [2, 2, stripe], [0, 3, base], [1, 3, base], [2, 3, base]]
  return shape.map(([dx, dy, color]) => [left + dx, 12 + dy, color, from + 50 * dy])
}

function easter(ms: number): Field {
  const field: Field = new Map()
  const grass: Spot[] = Array.from({ length: HOLIDAY_COLS }, (_, x) => [x, 16, GREEN, 1000 + 30 * x])
  const flower: Spot[] = [[16, 15, GREEN, 2050], [16, 14, GREEN, 2100], [16, 13, GOLD, 2150], [15, 13, GOLD, 2200], [17, 13, GOLD, 2200], [16, 12, GOLD, 2200]]
  flashIn(field, [...grass, ...egg(0, BLUE, GOLD, 1450), ...egg(18, ORANGE, BLUE, 1700), ...flower], ms)
  return field
}

const SCENES: Readonly<Record<Holiday, (ms: number) => Field>> = { christmas, newyear: newYear, halloween, easter }

export function holidayColor(holiday: Holiday, x: number, y: number, ms: number, field: Field = SCENES[holiday](ms)): string {
  const r = y - LOGO_Y
  const c = x - LOGO_X
  const logo = r >= 0 && r < LOGO_SIZE && c >= 0 && c < LOGO_SIZE ? cellColor(r, c, ms) : LOGO_EMPTY
  return logo !== LOGO_EMPTY ? logo : field.get(spot(x, y)) ?? LOGO_EMPTY
}

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

export function holidayRows(holiday: Holiday, ms: number, layout: LogoLayout, cols: number, rows: number): LogoRun[][] {
  const field = SCENES[holiday](ms)
  const left = Math.max(0, Math.floor((cols - layout.width) / 2))
  const top = Math.max(0, Math.floor((rows - layout.height) / 2))
  const span = layout.glyphs.length
  return Array.from({ length: rows }, (_, line) => {
    const inside = line - top
    const y = Math.floor(inside / span)
    if (inside < 0 || y >= HOLIDAY_ROWS) return [{ text: ' '.repeat(cols) }]
    const glyph = layout.glyphs[inside % span] ?? '▀'
    const runs: LogoRun[] = [{ text: ' '.repeat(left) }]
    for (let x = 0; x < HOLIDAY_COLS; x++) {
      if (x > 0) runs.push({ text: ' '.repeat(layout.pitch - layout.cell) })
      runs.push({ text: glyph.repeat(layout.cell), color: holidayColor(holiday, x, y, ms, field) })
    }
    runs.push({ text: ' '.repeat(Math.max(0, cols - left - layout.width)) })
    return joined(runs)
  })
}
