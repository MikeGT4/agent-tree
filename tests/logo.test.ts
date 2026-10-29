// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { introFrame, introInfo, introLines } from '../hooks/intro-model.ts'
import { GROW_TO, INTRO_MS, LOGO_COLORS, LOGO_EMPTY, LOGO_FLASH, LOGO_FULL, LOGO_SIZE, LOGO_SMALL, cellColor, introPhase, logoLayout, logoRows } from '../hooks/logo.ts'
import { PALETTES } from '../hooks/looks.ts'
import { createTree } from '../hooks/model.ts'
import { WORDS } from '../hooks/words.ts'

const GOLDEN: Record<number, string> = {
  0: '.........................................................................................................................................................................',
  39: '.........................................................................................................................................................................',
  40: '...................W.....................................................................................................................................................',
  41: '...................W.....................................................................................................................................................',
  100: '..................WWW...........W........................................................................................................................................',
  119: '.................WWWWW.........WWW.......................................................................................................................................',
  120: '.................WWOWW.........WWW.......................................................................................................................................',
  160: '.................WOOOW........WWOWW......................................................................................................................................',
  200: '.................OOOOO........WOOOW......................................................................................................................................',
  229: '.................OOOOO........OOOOO......................................................................................................................................',
  230: '.................OOOOO........OOOOO..........W...........................................................................................................................',
  270: '.................OOOOO........OOOOO..........W............W..............................................................................................................',
  309: '.................OOOOO........OOOOO..........W...........WWW.............................................................................................................',
  310: '.................OOOOO........OOOOO..........G...........WWW.............................................................................................................',
  350: '.................OOOOO........OOOOO..........G..........WWGWW............................................................................................................',
  360: '.................OOOOO........OOOOO..........G.........WWWGWWW...........................................................................................................',
  430: '.................OOOOO........OOOOO..........G........WWGGGGGWW....W.....................................................................................................',
  470: '.................OOOOO........OOOOO..........G........GGGGGGGGG...WWW..W.................................................................................................',
  509: '.................OOOOO........OOOOO..........G........GGGGGGGGG...WWW.WWW......WWW.......................................................................................',
  510: '.................OOOOO........OOOOO..........G........GGGGGGGGG...WBW.WWW..W...WWW.......................................................................................',
  560: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.WBW.WWW..WBW.WWW..W...WWW..........................................................................',
  600: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.WBW..BBB.WBW.WWW..WWW.WWW......................................................................',
  680: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.BBB..BBB.BBB.BBB..BBB.BBB.WWW...W.......W......................................................',
  700: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.BBB..BBB.BBB.BBB..BBB.BBB.WBW...W.......W......................................................',
  759: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.BBB..BBB.BBB.BBB..BBB.BBB.BBB...WWW...WWW......................................................',
  760: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.WWW..BBB.BBB.WWW..BBB.BBB.WWW...GWW...WWG......................................................',
  800: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.WWW..BBB.BBB.WWW..BBB.BBB.WWW...GGWWWWWGG......................................................',
  839: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.WWW..BBB.BBB.WWW..BBB.BBB.WWW...GGGWWWGGG......................................................',
  840: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGWWWGGG........W.............................................',
  870: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGWGGGG........W............W................................',
  919: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........W...........WWW...........W...................',
  920: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G...........WWW...........W...................',
  960: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G..........WWOWW........WWWWW.................',
  999: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G..........WOOOW........WWOWW.................',
  1000: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G..........WOOOW........WWOWW.................',
  1080: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G..........OOOOO........OOOOO.................',
  1100: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G..........OOOOO........OOOOO.................',
  1480: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G..........OOOOO........OOOOO.................',
  1960: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G..........OOOOO........OOOOO.................',
  1999: '.................OOOOO........OOOOO..........G........GGGGGGGGG...BBB.BBB.NNN..BBB.BBB.NNN..BBB.BBB.NNN...GGGGGGGGG........G..........OOOOO........OOOOO.................',
}

const LETTER: Record<string, string> = { [LOGO_EMPTY]: '.', [LOGO_FLASH]: 'W', ...Object.fromEntries(Object.entries(LOGO_COLORS).map(([k, v]) => [v, k])) }

function lettersAt(ms: number): string {
  let out = ''
  for (let r = 0; r < LOGO_SIZE; r++) for (let c = 0; c < LOGO_SIZE; c++) out += LETTER[cellColor(r, c, ms)] ?? '?'
  return out
}

const width = (row: readonly { text: string }[]) => row.reduce((n, run) => n + [...run.text].length, 0)

describe('Logo', () => {
  test('jede Farbe zu jedem Zeitpunkt wie in der freigegebenen Vorschau', () => {
    for (const [ms, expected] of Object.entries(GOLDEN)) expect(`${ms}: ${lettersAt(Number(ms))}`).toBe(`${ms}: ${expected}`)
  })

  test('Markenfarben fest, die rechte Box wird grün', () => {
    expect(LOGO_COLORS).toEqual({ O: PALETTES.original.main, G: PALETTES.original.dim, B: PALETTES.original.agent, N: PALETTES.original.done })
    expect(cellColor(5, 9, 700)).toBe(LOGO_COLORS.B)
    expect(cellColor(5, 9, 1200)).toBe(LOGO_COLORS.N)
  })

  test('Phasen nach der Zeit: aufbauen, dann stehen bis zum Ende', () => {
    expect([0, GROW_TO - 1, GROW_TO, 1999, INTRO_MS].map(introPhase)).toEqual(['grow', 'grow', 'hold', 'hold', 'done'])
  })

  test('der Aufbau nimmt nichts weg, ab 1080 ms steht das Logo unverändert bis zum Ende', () => {
    expect(lettersAt(0)).toBe('.'.repeat(LOGO_SIZE * LOGO_SIZE))
    let before = new Set<string>()
    for (let ms = 0; ms <= 1100; ms += 20) {
      const now = new Set(lettersAt(ms).split('').flatMap((ch, i) => (ch === '.' ? [] : [String(i)])))
      expect([...before].every(i => now.has(i))).toBe(true)
      before = now
    }
    for (let ms = 1080; ms < INTRO_MS; ms += 40) expect(lettersAt(ms)).toBe(lettersAt(1999))
  })

  test('groß in der angedockten Leiste, klein in der eingebetteten, darunter keins', () => {
    expect(logoLayout(90, 40)).toBe(LOGO_FULL)
    expect(logoLayout(90, 20)).toBe(LOGO_SMALL)
    expect(logoLayout(40, 30)).toBe(LOGO_SMALL)
    expect(logoLayout(24, 30)).toBeUndefined()
    expect(logoLayout(90, 12)).toBeUndefined()
  })

  test('Zeilen füllen die volle Breite, das Logo steht mittig, Felder 3 × 1,5 und klein 1 × 0,5', () => {
    for (const [layout, cols, rows] of [[LOGO_FULL, 81, 30], [LOGO_SMALL, 60, 15]] as const) {
      const out = logoRows(1500, layout, cols, rows)
      expect(out).toHaveLength(rows)
      expect(out.every(row => width(row) === cols)).toBe(true)
      const drawn = out.filter(row => row.some(run => run.color))
      expect(drawn).toHaveLength(layout.height)
    }
    const full = logoRows(1500, LOGO_FULL, 51, 26)
    expect(full[2]?.map(run => run.text).join('')).toMatch(/^█{3} █{3}/)
    expect(full[3]?.map(run => run.text).join('')).toMatch(/^▀{3} ▀{3}/)
    const small = logoRows(1500, LOGO_SMALL, 25, 13)
    expect(small[0]?.map(run => run.text).join('')).toBe('▀ '.repeat(12) + '▀')
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

  test('Startzeilen und Titel passen in die Breite', () => {
    const look = { palette: PALETTES.original, lang: 'de' as const, info: { limits: '5 h 35 % · Woche 8 % · Budget 12 %', subAgents: 'Sonnet · XHigh' } }
    const frame = introFrame(40, 20, 1600, look)
    expect(frame).toBeDefined()
    expect(frame?.skip).toBe('überspringen')
    expect([frame?.title ?? '', ...(frame?.lines ?? []), frame?.skip ?? ''].every(line => [...line].length <= 40)).toBe(true)
  })

  test('Startzeilen: Denkstufe als Wort, gewählte Stufe der Hauptsitzung vor der gemessenen, Modell aus der Einstellung', () => {
    const tree = createTree(0)
    expect(introInfo({ ...tree, main: { ...tree.main, model: 'claude-opus-5-5', effort: 'max' } }, WORDS.de)).toEqual({ model: 'Opus 5.5', effort: 'Max' })
    expect(introInfo({ ...tree, choices: { agents: {}, mainEffort: 'medium' }, main: { ...tree.main, model: 'claude-opus-5-5', effort: 'max' } }, WORDS.de)).toEqual({ model: 'Opus 5.5', effort: 'Medium' })
    expect(introInfo(tree, WORDS.de, 'opus[1m]')).toEqual({ model: 'Opus' })
  })
})
