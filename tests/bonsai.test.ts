// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { GROW_TO, INTRO_MS, bonsaiPlant, brailleRows, introPhase, visibleDots } from '../hooks/bonsai.ts'
import { introFrame, introInfo, introLines, introRows } from '../hooks/intro-model.ts'
import { PALETTES } from '../hooks/looks.ts'
import { createTree } from '../hooks/model.ts'
import { WORDS } from '../hooks/words.ts'

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

  test('die Pflanze passt ins Raster, in jeder Größe', () => {
    for (const [cols, rows] of [[40, 20], [81, 30], [100, 40]] as const) {
      const { dots } = bonsaiPlant(3, cols * 2, rows * 4)
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

  test('der Topf steht ab dem ersten Bild ganz unten', () => {
    const dots = bonsaiPlant(4, 162, 88).dots
    const lowest = Math.max(...dots.map(d => d.y))
    expect(dots.filter(d => d.y === lowest).every(d => d.part === 'pot')).toBe(true)
    expect(dots.filter(d => d.part === 'pot').every(d => d.at === 0)).toBe(true)
  })

  test('Holz und Laub vorhanden, kein Punkt doppelt, Zeiten von 0 bis 1', () => {
    const { dots } = bonsaiPlant(11, 162, 88)
    expect(dots.some(d => d.part === 'wood') && dots.some(d => d.part === 'leaf')).toBe(true)
    expect(new Set(dots.map(d => `${d.x},${d.y}`)).size).toBe(dots.length)
    expect(dots.every(d => d.at >= 0 && d.at <= 1)).toBe(true)
  })
  test('Phasen nach der Zeit: wachsen, dann stehen bis zum Ende', () => {
    expect([0, 1100, 1700, 1999, 2000].map(introPhase)).toEqual(['grow', 'hold', 'hold', 'hold', 'done'])
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

  test('nach dem Wachsen bleibt der Baum aufrecht stehen, nichts wird abgebaut', () => {
    const { dots } = bonsaiPlant(7, 162, 88)
    for (let ms = GROW_TO; ms < INTRO_MS; ms += 40) expect(visibleDots(dots, ms)).toEqual(dots)
    expect(visibleDots(dots, INTRO_MS - 1)).toEqual(dots)
    expect(visibleDots(dots, INTRO_MS)).toEqual(dots)
  })
  test('Zeilen des Intros: Braille in voller Breite, Teile je Zelle, neu gerechnet für eine kleinere Leiste', () => {
    const big = bonsaiPlant(7, 162, 88)
    const rows = introRows(visibleDots(big.dots, 1100), 81, 22)
    expect(rows).toHaveLength(22)
    expect(rows.every(row => row.reduce((n, run) => n + [...run.text].length, 0) === 81)).toBe(true)
    expect(rows.flat().some(run => /[⠁-⣿]/.test(run.text))).toBe(true)
    expect(new Set(rows.flat().map(run => run.part ?? 'leer'))).toEqual(new Set(['leer', 'wood', 'leaf', 'pot']))
    const small = bonsaiPlant(7, 120, 60)
    const smaller = introRows(visibleDots(small.dots, 1100), 60, 15)
    expect(smaller.every(row => row.reduce((n, run) => n + [...run.text].length, 0) === 60)).toBe(true)
  })

  test('Startzeilen nennen nur, was bekannt ist', () => {
    expect(introLines({ advisor: 'Opus' }, WORDS.de)).toEqual(['Berater Opus'])
    expect(introLines({ model: 'Opus 5.5', effort: 'max', subAgents: 'Sonnet · Low', limits: '5 h 27 % · Woche 6 %' }, WORDS.de)).toEqual([
      'Modell Opus 5.5 · max',
      'Unteragenten Sonnet · Low',
      'Limits 5 h 27 % · Woche 6 %',
    ])
    expect(introLines({ model: 'Haiku 5.5' }, WORDS.en)).toEqual(['model Haiku 5.5'])
    expect(introLines({}, WORDS.en)).toEqual([])
  })
  test('die Pflanze wird nie beschnitten und füllt die ganze Wachstumszeit', () => {
    for (const [wide, high] of [[162, 88], [80, 32], [280, 32], [80, 800], [400, 120]] as const)
      for (let seed = 1; seed <= 12; seed++) {
        const plant = bonsaiPlant(seed, wide, high)
        expect(plant.clipped).toBe(0)
        expect(Math.max(...plant.dots.map(d => d.at))).toBe(1)
      }
  })

  test('Startzeilen und Titel passen in die Breite', () => {
    const look = { palette: PALETTES.original, leaf: PALETTES.original.done, lang: 'de' as const, seed: 3, info: { limits: '5 h 35 % · Woche 8 % · Budget 12 %', subAgents: 'Sonnet · XHigh' } }
    const frame = introFrame(40, 20, 1600, look)
    expect(frame).toBeDefined()
    expect([frame?.title ?? '', ...(frame?.lines ?? [])].every(line => [...line].length <= 40)).toBe(true)
  })

  test('Startzeilen: Denkstufe als Wort, Modell aus der Einstellung, wenn die Sitzung noch keins kennt', () => {
    const tree = createTree(0)
    expect(introInfo({ ...tree, main: { ...tree.main, model: 'claude-opus-5-5', effort: 'max' } }, WORDS.de)).toEqual({ model: 'Opus 5.5', effort: 'Max' })
    expect(introInfo(tree, WORDS.de, 'opus[1m]')).toEqual({ model: 'Opus' })
  })
})
