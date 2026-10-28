// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { BONSAI_FORMS, bonsaiPlant, brailleRows, introPhase, visibleDots } from '../hooks/bonsai.ts'

describe('Bonsai', () => {
  test('Braille-Raster: Punkte auf Zeichen', () => {
    expect(brailleRows(1, 1, [[0, 0]])).toEqual(['⠁'])
    expect(brailleRows(1, 1, [[1, 0]])).toEqual(['⠈'])
    expect(brailleRows(1, 1, [[0, 3]])).toEqual(['⡀'])
    expect(brailleRows(1, 1, [[1, 3]])).toEqual(['⢀'])
    const all: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3]]
    expect(brailleRows(1, 1, all)).toEqual(['⣿'])
    expect(brailleRows(2, 1, [])).toEqual(['  '])
    expect(brailleRows(1, 1, [[5, 5]])).toEqual([' '])
    expect(brailleRows(2, 2, [[3, 7]])).toEqual(['  ', ' ⢀'])
  })

  test('gleicher Startwert, gleiche Pflanze; anderer Startwert, andere', () => {
    expect(bonsaiPlant(7, 162, 88)).toEqual(bonsaiPlant(7, 162, 88))
    expect(bonsaiPlant(7, 162, 88).dots).not.toEqual(bonsaiPlant(8, 162, 88).dots)
  })

  test('die Pflanze passt ins Raster, in jeder Form und Größe', () => {
    for (const form of BONSAI_FORMS)
      for (const [cols, rows] of [[40, 20], [81, 30], [100, 40]] as const) {
        const { dots } = bonsaiPlant(3, cols * 2, rows * 4, form)
        expect(dots.length).toBeGreaterThan(50)
        expect(dots.every(d => d.x >= 0 && d.x < cols * 2 && d.y >= 0 && d.y < rows * 4)).toBe(true)
      }
  })

  test('drei Äste bei kleiner Leiste, drei bis fünf bei großer', () => {
    expect(bonsaiPlant(5, 80, 60).branches).toBe(3)
    for (let seed = 1; seed <= 12; seed++) {
      const n = bonsaiPlant(seed, 200, 160).branches
      expect(n >= 3 && n <= 5).toBe(true)
    }
  })

  test('der Topf steht ab dem ersten Bild unten, die Kaskade fällt über den Rand', () => {
    const upright = bonsaiPlant(4, 162, 88, 'upright').dots
    const lowest = Math.max(...upright.map(d => d.y))
    expect(upright.filter(d => d.y === lowest).every(d => d.part === 'pot')).toBe(true)
    expect(upright.filter(d => d.part === 'pot').every(d => d.at === 0)).toBe(true)
    const cascade = bonsaiPlant(4, 162, 88, 'cascade').dots
    const potBottom = Math.max(...cascade.filter(d => d.part === 'pot').map(d => d.y))
    expect(cascade.some(d => d.part === 'wood' && d.y > potBottom)).toBe(true)
  })

  test('windgepeitscht: das Laub steht auf einer Seite', () => {
    const dots = bonsaiPlant(9, 162, 88, 'windswept').dots
    const pot = dots.filter(d => d.part === 'pot')
    const middle = (Math.min(...pot.map(d => d.x)) + Math.max(...pot.map(d => d.x))) / 2
    const leaves = dots.filter(d => d.part === 'leaf')
    const right = leaves.filter(d => d.x > middle).length
    expect(Math.max(right, leaves.length - right) / leaves.length).toBeGreaterThan(0.8)
  })

  test('Holz und Laub vorhanden, kein Punkt doppelt, Zeiten von 0 bis 1', () => {
    for (const form of BONSAI_FORMS) {
      const { dots } = bonsaiPlant(11, 162, 88, form)
      expect(dots.some(d => d.part === 'wood') && dots.some(d => d.part === 'leaf')).toBe(true)
      expect(new Set(dots.map(d => `${d.x},${d.y}`)).size).toBe(dots.length)
      expect(dots.every(d => d.at >= 0 && d.at <= 1)).toBe(true)
    }
  })
  test('Phasen nach der Zeit', () => {
    expect([0, 1100, 1700, 2000].map(introPhase)).toEqual(['grow', 'hold', 'handoff', 'done'])
  })

  test('der Topf steht ab dem ersten Bild, die erste Bewegung kommt vor 166 ms', () => {
    const { dots } = bonsaiPlant(7, 162, 88)
    const first = visibleDots(dots, 0)
    expect(first.every(d => d.part === 'pot')).toBe(true)
    expect(first.length).toBe(dots.filter(d => d.part === 'pot').length)
    expect(visibleDots(dots, 150).length).toBeGreaterThan(first.length)
  })

  test('Wachstum nimmt nichts weg, bei 1100 ms steht die ganze Pflanze', () => {
    const { dots } = bonsaiPlant(7, 162, 88)
    let shown = new Set<string>()
    for (let ms = 0; ms <= 1100; ms += 50) {
      const next = new Set(visibleDots(dots, ms).map(d => `${d.x},${d.y}`))
      expect([...shown].every(key => next.has(key))).toBe(true)
      shown = next
    }
    expect(shown.size).toBe(dots.length)
  })

  test('die Übergabe leert das Bild, der Topf geht zuletzt', () => {
    const { dots } = bonsaiPlant(7, 162, 88)
    expect(visibleDots(dots, 1700).length).toBe(dots.length)
    const late = visibleDots(dots, 1999)
    expect(late.length).toBeLessThan(dots.length)
    expect(late.every(d => d.part === 'pot')).toBe(true)
    expect(visibleDots(dots, 2000)).toEqual([])
  })
})
