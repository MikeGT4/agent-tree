// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
export const LOCAL_TOOL = 'local_model'
export const LOCAL_DEFAULT_URL = 'http://127.0.0.1:11434/v1'
export const LOCAL_TIMEOUT_MS = 120_000
export const LOCAL_PROMPT_LIMIT = 200_000
export const LOCAL_ANSWER_LIMIT = 60_000

export type LocalSetup = { model: string; url: string }
export type LocalAsk = { prompt: string; system?: string }
export type LocalAnswer = { text: string; tokens?: number }
export type LocalTally = { calls: number; tokens: number; ms: number; failed: number }

export function localSetup(model: unknown, url: unknown): LocalSetup | undefined {
  const name = typeof model === 'string' ? model.trim() : ''
  if (!name) return undefined
  const raw = typeof url === 'string' && url.trim() ? url.trim() : LOCAL_DEFAULT_URL
  if (!/^https?:\/\//i.test(raw)) return undefined
  return { model: name, url: raw.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '') }
}

export function localDescription(model: string): string {
  return [
    `Sends a self-contained task to the user's own local model (${model}) and returns its answer as text.`,
    'Use it for cheap, simple work where a small model is enough: summarising or reformatting text you already have, short translations, boilerplate, classifying or extracting from a given text.',
    'The local model cannot read files, run tools or see this conversation, so put everything it needs into the prompt.',
    'Check its answer before you rely on it; for anything hard, do the work yourself.',
  ].join(' ')
}

export const LOCAL_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string', description: 'The whole task with all the text it needs' },
    system: { type: 'string', description: 'Optional instructions on how to answer' },
  },
  required: ['prompt'],
}

export function localAskOf(input: unknown): LocalAsk | undefined {
  const i = input as { prompt?: unknown; system?: unknown } | null
  if (!i || typeof i.prompt !== 'string' || !i.prompt.trim()) return undefined
  return {
    prompt: i.prompt.slice(0, LOCAL_PROMPT_LIMIT),
    ...(typeof i.system === 'string' && i.system.trim() ? { system: i.system.slice(0, LOCAL_PROMPT_LIMIT) } : {}),
  }
}

export function localBody(setup: LocalSetup, ask: LocalAsk): string {
  return JSON.stringify({
    model: setup.model,
    stream: false,
    messages: [...(ask.system ? [{ role: 'system', content: ask.system }] : []), { role: 'user', content: ask.prompt }],
  })
}

export function localAnswerOf(text: string): LocalAnswer | undefined {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return undefined
  }
  const d = data as { choices?: { message?: { content?: unknown } }[]; usage?: { total_tokens?: unknown; prompt_tokens?: unknown; completion_tokens?: unknown } }
  const content = d.choices?.[0]?.message?.content
  if (typeof content !== 'string') return undefined
  const u = d.usage
  const total = typeof u?.total_tokens === 'number' ? u.total_tokens : typeof u?.prompt_tokens === 'number' && typeof u?.completion_tokens === 'number' ? u.prompt_tokens + u.completion_tokens : undefined
  return { text: content.slice(0, LOCAL_ANSWER_LIMIT), ...(total !== undefined ? { tokens: total } : {}) }
}

export function localErrorOf(text: string | undefined): string | undefined {
  if (!text) return undefined
  try {
    const d = JSON.parse(text) as { error?: { message?: unknown } | string }
    const message = typeof d.error === 'string' ? d.error : d.error?.message
    return typeof message === 'string' && message.trim() ? message.trim().slice(0, 200) : undefined
  } catch {
    return undefined
  }
}

export function tallied(t: LocalTally, answer: LocalAnswer | undefined, ms: number): LocalTally {
  return answer ? { calls: t.calls + 1, tokens: t.tokens + (answer.tokens ?? 0), ms: t.ms + ms, failed: t.failed } : { ...t, failed: t.failed + 1 }
}

export type LocalMode = 'off' | 'ask' | 'auto'
export const LOCAL_MODES: readonly LocalMode[] = ['off', 'ask', 'auto']
export const LOCAL_KEY = 'localChoice'
export const LOCAL_CANDIDATES: readonly string[] = ['http://127.0.0.1:11434/v1', 'http://127.0.0.1:1234/v1']
export const LOCAL_GUIDE_URL = 'https://github.com/MikeGT4/agent-tree/blob/main/docs/LOCAL.md'
export const LOCAL_PICKS = 12

export type LocalChoice = { model?: string; url?: string; mode: LocalMode }
export type LocalFound = { url: string; models: string[] }
export type LocalPick = { url: string; model: string }
export type LocalView = { choice: LocalChoice; tally: LocalTally; picks: readonly LocalPick[]; searched: boolean; searching: boolean; busy: boolean; error?: string; open: boolean }

export function choiceOf(stored: unknown, fallback: LocalSetup | undefined): LocalChoice {
  const c = stored as Partial<LocalChoice> | null
  const mode = c && LOCAL_MODES.includes(c.mode as LocalMode) ? (c.mode as LocalMode) : undefined
  if (c && mode) {
    const setup = localSetup(c.model, c.url)
    return setup ? { model: setup.model, url: setup.url, mode } : { mode: 'off' }
  }
  return fallback ? { model: fallback.model, url: fallback.url, mode: 'ask' } : { mode: 'off' }
}

export function setupOf(choice: LocalChoice): LocalSetup | undefined {
  return choice.mode !== 'off' && choice.model ? localSetup(choice.model, choice.url) : undefined
}

export function nextMode(mode: LocalMode): LocalMode {
  return LOCAL_MODES[(LOCAL_MODES.indexOf(mode) + 1) % LOCAL_MODES.length] ?? 'off'
}

export function modelsOf(text: string | undefined): string[] {
  if (!text) return []
  try {
    const d = JSON.parse(text) as { data?: { id?: unknown }[]; models?: { name?: unknown }[] }
    const ids = (d.data ?? []).map(m => m.id).concat((d.models ?? []).map(m => m.name))
    return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim() !== ''))]
  } catch {
    return []
  }
}

export function candidatesOf(choice: LocalChoice, optionUrl: string | undefined): string[] {
  return [...new Set([choice.url, optionUrl, ...LOCAL_CANDIDATES].filter((u): u is string => typeof u === 'string' && u !== ''))]
}

export function picksOf(found: readonly LocalFound[]): LocalPick[] {
  return found.flatMap(f => f.models.map(model => ({ url: f.url, model }))).slice(0, LOCAL_PICKS)
}

export function hostOf(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
}

export function localDescriptionFor(model: string, mode: LocalMode): string {
  if (mode === 'off') return 'Turned off by the user in Agent Tree. Do not call this tool.'
  const base = localDescription(model)
  return mode === 'ask'
    ? `${base} Call it only when the user asks for the local model; otherwise do the work yourself.`
    : `${base} Prefer it for longer texts where it saves real work, not for a sentence or two.`
}
