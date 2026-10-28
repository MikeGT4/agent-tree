// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { Elements } from 'claude-code'

import { GROW_TO, bonsaiPlant, brailleChar, dotBit, introPhase, visibleDots } from './bonsai.ts'
import type { BonsaiForm, Dot, Part, Plant } from './bonsai.ts'
import type { Palette } from './looks.ts'
import { wordsFor } from './words.ts'
import type { Lang, Words } from './words.ts'

type IntroUi = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export const INTRO_MIN = { cols: 40, rows: 14 }
export const INTRO_ROWS = 28
export const INTRO_TITLE = 'AGENT TREE'
const TITLE_FROM = 600
const TITLE_STEP = 35
const LINE_STEP = 110
const CELL_RANK: Record<Part, number> = { pot: 1, leaf: 2, wood: 3 }

export type IntroInfo = { model?: string; effort?: string; advisor?: string; subAgents?: string; limits?: string }
export type IntroLook = { palette: Palette; leaf: string; lang: Lang; info: IntroInfo; seed: number; form: BonsaiForm }
export type IntroRun = { text: string; part?: Part }

export function introLines(info: IntroInfo, w: Words): string[] {
  const model = info.model && (info.effort ? `${info.model} · ${info.effort}` : info.model)
  return [
    model ? w.introModel(model) : undefined,
    info.advisor ? w.introAdvisor(info.advisor) : undefined,
    info.subAgents ? w.introSubAgents(info.subAgents) : undefined,
    info.limits ? w.introLimits(info.limits) : undefined,
  ].filter((line): line is string => line !== undefined)
}

export function introRows(dots: readonly Dot[], cols: number, rows: number): IntroRun[][] {
  const masks = new Uint8Array(Math.max(0, cols * rows))
  const parts: (Part | undefined)[] = []
  for (const d of dots) {
    if (d.x < 0 || d.y < 0 || d.x >= cols * 2 || d.y >= rows * 4) continue
    const cell = Math.floor(d.y / 4) * cols + Math.floor(d.x / 2)
    masks[cell] = (masks[cell] ?? 0) | dotBit(d.x, d.y)
    const old = parts[cell]
    if (!old || CELL_RANK[d.part] > CELL_RANK[old]) parts[cell] = d.part
  }
  return Array.from({ length: rows }, (_, row) => {
    const runs: IntroRun[] = []
    for (let col = 0; col < cols; col++) {
      const cell = row * cols + col
      const mask = masks[cell] ?? 0
      const part = mask ? parts[cell] : undefined
      const last = runs[runs.length - 1]
      if (last && last.part === part) last.text += brailleChar(mask)
      else runs.push(part ? { text: brailleChar(mask), part } : { text: brailleChar(mask) })
    }
    return runs
  })
}

let cachedPlant: { key: string; plant: Plant } | undefined

function plantFor(seed: number, wide: number, high: number, form: BonsaiForm): Plant {
  const key = `${seed}:${wide}:${high}:${form}`
  if (!cachedPlant || cachedPlant.key !== key) cachedPlant = { key, plant: bonsaiPlant(seed, wide, high, form) }
  return cachedPlant.plant
}

function centered(text: string, width: number): string {
  return ' '.repeat(Math.max(0, Math.floor((width - [...text].length) / 2))) + text
}

export function drawIntro(ui: IntroUi, width: number, height: number | undefined, ms: number, look: IntroLook, onSkip: () => void) {
  const { Box, Text, Button } = ui
  const total = height ?? INTRO_ROWS
  if (width < INTRO_MIN.cols || total < INTRO_MIN.rows || introPhase(ms) === 'done') return undefined
  const lines = introLines(look.info, wordsFor(look.lang))
  const canvasRows = total - lines.length - 2
  const rows = introRows(visibleDots(plantFor(look.seed, width * 2, canvasRows * 4, look.form).dots, ms), width, canvasRows)
  const color = (part: Part) => (part === 'wood' ? look.palette.main : part === 'leaf' ? look.leaf : look.palette.dim)
  const titleChars = Math.max(0, Math.min(INTRO_TITLE.length, Math.floor((ms - TITLE_FROM) / TITLE_STEP)))
  const shownLines = ms < GROW_TO ? 0 : Math.min(lines.length, Math.floor((ms - GROW_TO) / LINE_STEP) + 1)
  return (
    <Box key="intro" flexDirection="column" width={width}>
      {rows.map((runs, i) => (
        <Button key={`intro:skip:${i}`} plain onPress={onSkip}>
          {runs.map((run, j) =>
            run.part ? (
              <Text key={`intro-run:${i}:${j}`} color={color(run.part)}>
                {run.text}
              </Text>
            ) : (
              run.text
            ),
          )}
        </Button>
      ))}
      <Text key="intro-gap"> </Text>
      <Text key="intro-title" bold color={look.palette.main}>
        {centered(INTRO_TITLE.slice(0, titleChars), width) || ' '}
      </Text>
      {lines.map((line, i) => (
        <Text key={`intro-line:${i}`} color={look.palette.dim}>
          {i < shownLines ? centered(line, width) : ' '}
        </Text>
      ))}
    </Box>
  )
}
