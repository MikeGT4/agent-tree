// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
export const UPDATE_KEY = 'update'
export const UPDATE_COMMAND = 'claude plugin update agent-tree'

const DAY_MS = 24 * 60 * 60 * 1000
const ALREADY_LATEST = /already at the latest version/i
const OFF_SWITCHES = ['DO_NOT_TRACK', 'DISABLE_AUTOUPDATER', 'DISABLE_UPDATES', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']
const NOT_FROM_A_MARKETPLACE = new Set(['skills-dir', 'inline', 'synced', 'builtin'])

export type Install = { id: string; version: string }

export type UpdateOutcome =
  | { kind: 'off' | 'skipped' | 'current' }
  | { kind: 'installed'; version: string }
  | { kind: 'failed'; version: string; command: string }

export type UpdateHost = {
  env: (name: string) => Promise<string | undefined>
  load: () => Promise<unknown>
  save: (value: unknown) => Promise<void>
  listPlugins: () => Promise<string | undefined>
  fetchLatest: () => Promise<{ ok: boolean; text: string } | undefined>
  update: () => Promise<{ exitCode: number; stdout: string } | undefined>
}

type UpdateState = { checkedAt?: number; tried?: string }

export function installedFrom(listJson: string): Install | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(listJson)
  } catch {
    return undefined
  }
  const entries = Array.isArray(parsed) ? parsed : (parsed as { plugins?: unknown } | null)?.plugins
  if (!Array.isArray(entries)) return undefined
  for (const entry of entries) {
    const { id, version, enabled } = (entry ?? {}) as { id?: unknown; version?: unknown; enabled?: unknown }
    if (typeof id !== 'string' || typeof version !== 'string' || enabled === false) continue
    const [name, origin] = id.split('@')
    if (name === 'agent-tree' && origin && !NOT_FROM_A_MARKETPLACE.has(origin)) return { id, version }
  }
  return undefined
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

export async function checkForUpdate(host: UpdateHost, enabled: boolean, now: number): Promise<UpdateOutcome> {
  if (!enabled || (await updatesSwitchedOff(host))) return { kind: 'off' }
  const state = ((await host.load()) ?? {}) as UpdateState
  if (typeof state.checkedAt === 'number' && now - state.checkedAt < DAY_MS) return { kind: 'skipped' }
  await host.save({ ...state, checkedAt: now })
  const listed = await host.listPlugins()
  const install = listed ? installedFrom(listed) : undefined
  if (!install) return { kind: 'skipped' }
  const response = await host.fetchLatest()
  const latest = response?.ok ? versionIn(response.text) : undefined
  if (!latest) return { kind: 'skipped' }
  if (!isNewer(latest, install.version)) return { kind: 'current' }
  if (latest === state.tried) return { kind: 'skipped' }
  await host.save({ checkedAt: now, tried: latest })
  const result = await host.update()
  if (result?.exitCode === 0 && ALREADY_LATEST.test(result.stdout)) return { kind: 'current' }
  if (result?.exitCode === 0) return { kind: 'installed', version: latest }
  return { kind: 'failed', version: latest, command: UPDATE_COMMAND }
}
