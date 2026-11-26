// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { AgentTreeState } from '../types'
import { GREETING_FROM, GREETING_STEP, HOLIDAY_MS, holidayLayout, holidayRows } from './holiday.ts'
import type { Holiday } from './holiday.ts'
import { GROW_TO, INTRO_MS, logoLayout, logoRows } from './logo.ts'
import type { LogoRun } from './logo.ts'
import type { Palette } from './looks.ts'
import { choicesOf, effortLabel, modelLabel } from './model.ts'
import { familyOr, wordsFor } from './words.ts'
import type { Lang, Words } from './words.ts'

export const INTRO_MIN = { cols: 40, rows: 14 }
export const INTRO_ROWS = 28
export const INTRO_TITLE = 'AGENT TREE'
const TITLE_FROM = 600
const TITLE_STEP = 35
const LINE_STEP = 110

export type IntroInfo = { model?: string; effort?: string; advisor?: string; subAgents?: string; limits?: string }
export type IntroLook = { palette: Palette; lang: Lang; info: IntroInfo; holiday?: Holiday; year?: number }
export type IntroRun = LogoRun
export type IntroFrame = { rows: IntroRun[][]; title: string; greeting?: string; lines: string[]; skip: string }

export function introInfo(s: AgentTreeState, w: Words, modelSetting?: string): IntroInfo {
  const choices = choicesOf(s)
  const subAgents =
    choices.newAgents || choices.newEffort
      ? `${familyOr(choices.newAgents, w.standard)}${choices.newEffort ? ` · ${effortLabel(choices.newEffort)}` : ''}`
      : undefined
  const limits = s.main.limits?.length
    ? s.main.limits.map(l => `${w.limitKind(l.kind)} ${w.percent(Math.round(l.percent))}`).join(' · ')
    : undefined
  const model = s.main.model ?? modelSetting
  const effort = choices.mainEffort ?? s.main.effort
  return {
    ...(model ? { model: modelLabel(model) } : {}),
    ...(effort ? { effort: effortLabel(effort) } : {}),
    ...(s.advisor.model ? { advisor: modelLabel(s.advisor.model) } : {}),
    ...(subAgents ? { subAgents } : {}),
    ...(limits ? { limits } : {}),
  }
}

export function introLines(info: IntroInfo, w: Words): string[] {
  const model = info.model && (info.effort ? `${info.model} · ${info.effort}` : info.model)
  return [
    model ? w.introModel(model) : undefined,
    info.advisor ? w.introAdvisor(info.advisor) : undefined,
    info.subAgents ? w.introSubAgents(info.subAgents) : undefined,
    info.limits ? w.introLimits(info.limits) : undefined,
  ].filter((line): line is string => line !== undefined)
}

function centered(text: string, width: number): string {
  const shown = [...text].slice(0, width).join('')
  return shown ? ' '.repeat(Math.max(0, Math.floor((width - [...shown].length) / 2))) + shown : ''
}

export function introFrame(width: number, height: number | undefined, ms: number, look: IntroLook): IntroFrame | undefined {
  const total = height ?? INTRO_ROWS
  if (width < INTRO_MIN.cols || total < INTRO_MIN.rows || ms >= (look.holiday ? HOLIDAY_MS : INTRO_MS)) return undefined
  const w = wordsFor(look.lang)
  const lines = introLines(look.info, w)
  const scene = look.holiday ? holidayLayout(width, total - lines.length - 4) : undefined
  if (!scene && ms >= INTRO_MS) return undefined
  const canvasRows = total - lines.length - (scene ? 4 : 3)
  const layout = scene ?? logoLayout(width, canvasRows)
  if (!layout) return undefined
  const rows = scene && look.holiday ? holidayRows(look.holiday, ms, scene, width, canvasRows) : logoRows(ms, layout, width, canvasRows)
  const greetingText = scene && look.holiday ? w.holidayGreeting(look.holiday, look.year ?? 0) : undefined
  const greetingChars = ms < GREETING_FROM ? 0 : Math.floor((ms - GREETING_FROM) / GREETING_STEP) + 1
  const titleChars = Math.max(0, Math.min(INTRO_TITLE.length, Math.floor((ms - TITLE_FROM) / TITLE_STEP)))
  const shownLines = ms < GROW_TO ? 0 : Math.min(lines.length, Math.floor((ms - GROW_TO) / LINE_STEP) + 1)
  return {
    rows,
    title: centered(INTRO_TITLE.slice(0, titleChars), width),
    ...(greetingText !== undefined ? { greeting: centered([...greetingText].slice(0, greetingChars).join(''), width) } : {}),
    lines: lines.map((line, i) => (i < shownLines ? centered(line, width) : '')),
    skip: w.introSkip,
  }
}
