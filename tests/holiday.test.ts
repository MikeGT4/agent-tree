// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { HOLIDAY_COLS, HOLIDAY_FULL, HOLIDAY_MS, HOLIDAY_ROWS, HOLIDAY_SMALL, holidayAt, holidayColor, holidayLayout, holidayRows, newYearOf } from '../hooks/holiday.ts'
import type { Holiday } from '../hooks/holiday.ts'
import { introFrame } from '../hooks/intro-model.ts'
import { LOGO_EMPTY, LOGO_SIZE, cellColor } from '../hooks/logo.ts'
import { PALETTES } from '../hooks/looks.ts'
import { WORDS } from '../hooks/words.ts'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()
const width = (row: readonly { text: string }[]) => row.reduce((n, run) => n + [...run.text].length, 0)

describe('Feiertage', () => {
  test('Zeiträume nach dem Datum des Rechners', () => {
    expect([at(2026, 12, 23), at(2026, 12, 24), at(2026, 12, 26), at(2026, 12, 27)].map(holidayAt)).toEqual([undefined, 'christmas', 'christmas', undefined])
    expect([at(2026, 12, 30), at(2026, 12, 31), at(2027, 1, 1), at(2027, 1, 2)].map(holidayAt)).toEqual([undefined, 'newyear', 'newyear', undefined])
    expect([at(2026, 10, 30), at(2026, 10, 31), at(2026, 11, 1)].map(holidayAt)).toEqual([undefined, 'halloween', undefined])
  })

  test('Ostern von Karfreitag bis Ostermontag, jedes Jahr neu berechnet', () => {
    expect([at(2026, 4, 2), at(2026, 4, 3), at(2026, 4, 5), at(2026, 4, 6), at(2026, 4, 7)].map(holidayAt)).toEqual([undefined, 'easter', 'easter', 'easter', undefined])
    expect([at(2027, 3, 25), at(2027, 3, 26), at(2027, 3, 29), at(2027, 3, 30)].map(holidayAt)).toEqual([undefined, 'easter', 'easter', undefined])
    expect([at(2028, 4, 14), at(2028, 4, 17)].map(holidayAt)).toEqual(['easter', 'easter'])
  })

  test('Neujahr grüßt mit dem kommenden Jahr', () => {
    expect(newYearOf(at(2026, 12, 31))).toBe(2027)
    expect(newYearOf(at(2027, 1, 1))).toBe(2027)
    expect(WORDS.de.holidayGreeting('newyear', 2027)).toBe('Frohes neues Jahr 2027!')
    expect(WORDS.en.holidayGreeting('christmas', 2027)).toBe('Merry Christmas!')
  })

  test('das Logo bleibt in jedem Fest unverändert, der Schmuck nur auf leeren Feldern', () => {
    for (const holiday of ['christmas', 'newyear', 'halloween', 'easter'] as Holiday[]) {
      for (const ms of [0, 500, 1200, 2000, HOLIDAY_MS - 1]) {
        for (let r = 0; r < LOGO_SIZE; r++) {
          for (let c = 0; c < LOGO_SIZE; c++) {
            const logo = cellColor(r, c, ms)
            if (logo !== LOGO_EMPTY) expect(holidayColor(holiday, c + 4, r + 2, ms)).toBe(logo)
          }
        }
      }
    }
  })

  test('vor einer Sekunde kein Schmuck, danach erscheint er', () => {
    for (const holiday of ['christmas', 'newyear', 'halloween', 'easter'] as Holiday[]) {
      const lit = (ms: number) => {
        let n = 0
        for (let y = 0; y < HOLIDAY_ROWS; y++) for (let x = 0; x < HOLIDAY_COLS; x++) {
          const inLogo = x >= 4 && x < 4 + LOGO_SIZE && y >= 2 && y < 2 + LOGO_SIZE
          if (!inLogo && holidayColor(holiday, x, y, ms) !== LOGO_EMPTY) n++
        }
        return n
      }
      expect(lit(900)).toBe(0)
      expect(lit(HOLIDAY_MS - 1)).toBeGreaterThan(5)
    }
    expect(holidayColor('christmas', 10, 0, 2500)).toBe('#F2C14E')
  })

  test('Fläche in zwei Größen, jede Zeile so breit wie die Leiste', () => {
    expect(holidayLayout(90, 40)).toBe(HOLIDAY_FULL)
    expect(holidayLayout(60, 30)).toBe(HOLIDAY_SMALL)
    expect(holidayLayout(40, 30)).toBeUndefined()
    for (const [cols, rows, layout] of [[90, 40, HOLIDAY_FULL], [50, 20, HOLIDAY_SMALL]] as const) {
      for (const row of holidayRows('easter', 2500, layout, cols, rows)) expect(width(row)).toBe(cols)
    }
  })

  test('der Gruß tippt sich ab 1,8 s ein, das Intro endet nach 3 s', () => {
    const look = { palette: PALETTES.original, lang: 'de' as const, info: {}, holiday: 'halloween' as const, year: 2027 }
    expect(introFrame(90, 60, 1500, look)?.greeting?.trim()).toBe('')
    expect(introFrame(90, 60, 2600, look)?.greeting?.trim()).toBe('Fröhliches Halloween!')
    expect(introFrame(90, 60, HOLIDAY_MS, look)).toBeUndefined()
    expect(introFrame(40, 30, 2600, look)).toBeUndefined()
    expect(introFrame(40, 30, 1200, look)?.greeting).toBeUndefined()
  })
})
