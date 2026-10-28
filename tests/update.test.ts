// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { checkForUpdate, installedFrom, isNewer, UPDATE_COMMAND } from '../hooks/update.ts'
import type { UpdateHost } from '../hooks/update.ts'

const DAY = 24 * 60 * 60 * 1000
const NOW = DAY * 10
const LISTED = JSON.stringify([
  { id: 'agent-tree@agent-tree', version: '0.4.0', scope: 'user', enabled: true },
  { id: 'other@claude-plugins-official', version: '1.0.0', scope: 'user', enabled: true },
])

type Calls = { listed: number; fetched: number; updated: number }
type Fake = {
  latest?: string
  ok?: boolean
  exitCode?: number
  stdout?: string
  env?: Record<string, string>
  stored?: unknown
  listed?: string
}

function fake(o: Fake = {}): { host: UpdateHost; calls: Calls } {
  const calls: Calls = { listed: 0, fetched: 0, updated: 0 }
  let stored: unknown = o.stored
  const host: UpdateHost = {
    env: async name => o.env?.[name],
    load: async () => stored,
    save: async value => {
      stored = value
    },
    listPlugins: async () => {
      calls.listed++
      return o.listed ?? LISTED
    },
    fetchLatest: async () => {
      calls.fetched++
      return { ok: o.ok !== false, text: JSON.stringify({ name: 'agent-tree', version: o.latest ?? '0.4.0' }) }
    },
    update: async () => {
      calls.updated++
      return { exitCode: o.exitCode ?? 0, stdout: o.stdout ?? 'Restart to apply changes.' }
    },
  }
  return { host, calls }
}

describe('Auto-Update', () => {
  test('liest die Installation aus der Plugin-Liste von Claude Code', () => {
    expect(installedFrom(LISTED)).toEqual({ id: 'agent-tree@agent-tree', version: '0.4.0' })
    expect(installedFrom(JSON.stringify({ plugins: JSON.parse(LISTED) }))).toEqual({ id: 'agent-tree@agent-tree', version: '0.4.0' })
    expect(installedFrom(JSON.stringify([{ id: 'agent-tree@skills-dir', version: '0.4.1', enabled: true }]))).toBeUndefined()
    expect(installedFrom(JSON.stringify([{ id: 'agent-tree@inline', version: '0.4.1', enabled: true }]))).toBeUndefined()
    expect(installedFrom(JSON.stringify([{ id: 'agent-tree@agent-tree', version: '0.4.1', enabled: false }]))).toBeUndefined()
    expect(installedFrom('kein json')).toBeUndefined()
  })

  test('vergleicht Versionen Stelle für Stelle', () => {
    expect(isNewer('0.4.1', '0.4.0')).toBe(true)
    expect(isNewer('0.10.0', '0.9.9')).toBe(true)
    expect(isNewer('0.4.0', '0.4.0')).toBe(false)
    expect(isNewer('0.3.9', '0.4.0')).toBe(false)
    expect(isNewer('unknown', '0.4.0')).toBe(false)
  })

  test('installiert eine neuere Version mit dem festen Befehl', async () => {
    const { host, calls } = fake({ latest: '0.4.1' })
    expect(await checkForUpdate(host, true, NOW)).toEqual({ kind: 'installed', version: '0.4.1' })
    expect(calls).toEqual({ listed: 1, fetched: 1, updated: 1 })
    expect(UPDATE_COMMAND).toBe('claude plugin update agent-tree')
  })

  test('lässt eine aktuelle Installation in Ruhe', async () => {
    const { host, calls } = fake({ latest: '0.4.0' })
    expect((await checkForUpdate(host, true, NOW)).kind).toBe('current')
    expect(calls.updated).toBe(0)
  })

  test('fragt höchstens einmal am Tag, auch die Plugin-Liste', async () => {
    const { host, calls } = fake({ latest: '0.4.1', stored: { checkedAt: NOW - 1000 } })
    expect((await checkForUpdate(host, true, NOW)).kind).toBe('skipped')
    expect(calls).toEqual({ listed: 0, fetched: 0, updated: 0 })
  })

  test('die Einstellung und DO_NOT_TRACK schalten ihn ab', async () => {
    const { host, calls } = fake({ latest: '0.4.1', env: { DO_NOT_TRACK: '1' } })
    expect((await checkForUpdate(host, false, NOW)).kind).toBe('off')
    expect((await checkForUpdate(host, true, NOW)).kind).toBe('off')
    expect(calls).toEqual({ listed: 0, fetched: 0, updated: 0 })
  })

  for (const name of ['DISABLE_AUTOUPDATER', 'DISABLE_UPDATES', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']) {
    test(`${name} von Claude Code schaltet ihn ab`, async () => {
      const { host, calls } = fake({ latest: '0.4.1', env: { [name]: '1' } })
      expect((await checkForUpdate(host, true, NOW)).kind).toBe('off')
      expect(calls.fetched).toBe(0)
    })
  }

  test('der Wert 0 oder false schaltet nichts ab', async () => {
    const { host } = fake({ latest: '0.4.1', env: { DO_NOT_TRACK: '0', DISABLE_AUTOUPDATER: 'false' } })
    expect((await checkForUpdate(host, true, NOW)).kind).toBe('installed')
  })

  test('ohne Installation aus einem Marktplatz fragt er GitHub nicht', async () => {
    const { host, calls } = fake({ latest: '0.4.1', listed: JSON.stringify([{ id: 'agent-tree@skills-dir', version: '0.4.0', enabled: true }]) })
    expect((await checkForUpdate(host, true, NOW)).kind).toBe('skipped')
    expect(calls.fetched).toBe(0)
  })

  test('ohne Antwort von GitHub bleibt alles, wie es ist', async () => {
    const { host, calls } = fake({ latest: '0.4.1', ok: false })
    expect((await checkForUpdate(host, true, NOW)).kind).toBe('skipped')
    expect(calls.updated).toBe(0)
  })

  test('führt der Marktplatz die neue Version noch nicht, meldet er nichts und versucht sie nicht noch einmal', async () => {
    const { host, calls } = fake({ latest: '0.4.1', stdout: 'agent-tree is already at the latest version (0.4.0).' })
    expect((await checkForUpdate(host, true, NOW)).kind).toBe('current')
    expect((await checkForUpdate(host, true, NOW + 2 * DAY)).kind).toBe('skipped')
    expect(calls.updated).toBe(1)
  })

  test('scheitert das Update, nennt er den Befehl und versucht dieselbe Version nicht noch einmal', async () => {
    const { host, calls } = fake({ latest: '0.4.1', exitCode: 1 })
    expect(await checkForUpdate(host, true, NOW)).toEqual({ kind: 'failed', version: '0.4.1', command: UPDATE_COMMAND })
    expect((await checkForUpdate(host, true, NOW + 2 * DAY)).kind).toBe('skipped')
    expect(calls.updated).toBe(1)
  })
})
