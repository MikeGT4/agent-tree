// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { EngineInterface } from 'claude-code'

export const LATEST_URL = 'https://raw.githubusercontent.com/MikeGT4/agent-tree/main/.claude-plugin/plugin.json'
export const UPDATE_KEY = 'update'

const DAY_MS = 24 * 60 * 60 * 1000
const UPDATE_TIMEOUT_MS = 120_000
const ALREADY_LATEST = /already at the latest version/i
const OFF_SWITCHES = ['DO_NOT_TRACK', 'DISABLE_AUTOUPDATER', 'DISABLE_UPDATES', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']

export type Install = { marketplace: string; version: string }

export type UpdateOutcome =
  | { kind: 'off' | 'skipped' | 'current' }
  | { kind: 'installed'; version: string }
  | { kind: 'failed'; version: string; command: string }

type UpdateState = { checkedAt?: number; tried?: string }

export type UpdateHost = {
  env: (name: string) => Promise<string | undefined>
  load: () => Promise<unknown>
  save: (value: unknown) => Promise<void>
  fetchText: (url: string) => Promise<{ ok: boolean; text: string } | undefined>
  run: (argv: readonly string[]) => Promise<{ exitCode: number; stdout: string } | undefined>
}

async function offSwitch($: EngineInterface, name: string): Promise<string | undefined> {
  switch (name) {
    case 'DO_NOT_TRACK':
      return $.env.get('DO_NOT_TRACK').catch(() => undefined)
    case 'DISABLE_AUTOUPDATER':
      return $.env.get('DISABLE_AUTOUPDATER').catch(() => undefined)
    case 'DISABLE_UPDATES':
      return $.env.get('DISABLE_UPDATES').catch(() => undefined)
    case 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC':
      return $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC').catch(() => undefined)
    default:
      return undefined
  }
}

export function hostOf($: EngineInterface): UpdateHost {
  return {
    env: name => offSwitch($, name),
    load: () => $.store.get(UPDATE_KEY).catch(() => undefined),
    save: value => $.store.set(UPDATE_KEY, value).catch(() => undefined),
    fetchText: url => $.http.fetch(url).catch(() => undefined),
    run: argv =>
      $.process
        .run(argv, { timeoutMs: UPDATE_TIMEOUT_MS })
        .then(result => ({ exitCode: result.exitCode, stdout: result.stdout }))
        .catch(() => undefined),
  }
}

export function installFrom(root: string): Install | undefined {
  const found = /[\\/]cache[\\/]([^\\/]+)[\\/]agent-tree[\\/]([^\\/]+)[\\/]?$/.exec(root)
  return found ? { marketplace: found[1]!, version: found[2]! } : undefined
}

export function isNewer(candidate: string, current: string): boolean {
  const numbers = (version: string) => (/^\d+(\.\d+)*$/.test(version) ? version.split('.').map(Number) : undefined)
  const a = numbers(candidate)
  const b = numbers(current)
  if (!a || !b) return false
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return false
}

function switchedOn(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false'
}

function versionIn(text: string): string | undefined {
  try {
    const version = (JSON.parse(text) as { version?: unknown }).version
    return typeof version === 'string' ? version : undefined
  } catch {
    return undefined
  }
}

async function updatesSwitchedOff(host: UpdateHost): Promise<boolean> {
  for (const name of OFF_SWITCHES) {
    if (switchedOn(await host.env(name))) return true
  }
  return false
}

export async function checkForUpdate(
  host: UpdateHost,
  root: string,
  enabled: boolean,
  now: number,
): Promise<UpdateOutcome> {
  if (!enabled || (await updatesSwitchedOff(host))) return { kind: 'off' }
  const install = installFrom(root)
  if (!install) return { kind: 'skipped' }
  const state = ((await host.load()) ?? {}) as UpdateState
  if (typeof state.checkedAt === 'number' && now - state.checkedAt < DAY_MS) return { kind: 'skipped' }
  await host.save({ ...state, checkedAt: now })
  const response = await host.fetchText(LATEST_URL)
  const latest = response?.ok ? versionIn(response.text) : undefined
  if (!latest) return { kind: 'skipped' }
  if (!isNewer(latest, install.version)) return { kind: 'current' }
  if (latest === state.tried) return { kind: 'skipped' }
  await host.save({ checkedAt: now, tried: latest })
  const plugin = `agent-tree@${install.marketplace}`
  const result = await host.run(['claude', 'plugin', 'update', plugin])
  if (result?.exitCode === 0 && ALREADY_LATEST.test(result.stdout)) return { kind: 'current' }
  if (result?.exitCode === 0) return { kind: 'installed', version: latest }
  return { kind: 'failed', version: latest, command: `claude plugin update ${plugin}` }
}
