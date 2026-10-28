// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { checkForUpdate, installFrom, isNewer, LATEST_URL } from '../hooks/update.ts'
import type { UpdateHost } from '../hooks/update.ts'

const ROOT = '/home/u/.claude/plugins/cache/agent-tree/agent-tree/0.4.0'
const DAY = 24 * 60 * 60 * 1000
const NOW = DAY * 10

type Calls = { fetched: string[]; ran: string[][] }
type Fake = { latest?: string; ok?: boolean; exitCode?: number; stdout?: string; env?: Record<string, string>; stored?: unknown }

function fake(o: Fake = {}): { host: UpdateHost; calls: Calls } {
  const calls: Calls = { fetched: [], ran: [] }
  let stored: unknown = o.stored
  const host: UpdateHost = {
    env: async name => o.env?.[name],
    load: async () => stored,
    save: async value => {
      stored = value
    },
    fetchText: async url => {
      calls.fetched.push(url)
      return { ok: o.ok !== false, text: JSON.stringify({ name: 'agent-tree', version: o.latest ?? '0.4.0' }) }
    },
    run: async argv => {
      calls.ran.push([...argv])
      return { exitCode: o.exitCode ?? 0, stdout: o.stdout ?? 'Restart to apply changes.' }
    },
  }
  return { host, calls }
}

describe('Auto-Update', () => {
  test('erkennt eine Installation aus einem Marktplatz am Pfad', () => {
    expect(installFrom(ROOT)).toEqual({ marketplace: 'agent-tree', version: '0.4.0' })
    expect(installFrom('C:\\Users\\u\\.claude\\plugins\\cache\\claude-community\\agent-tree\\0.4.1')).toEqual({
      marketplace: 'claude-community',
      version: '0.4.1',
    })
    expect(installFrom('/home/u/.claude/skills/agent-tree')).toBeUndefined()
    expect(installFrom('/tmp/agent-tree')).toBeUndefined()
  })

  test('vergleicht Versionen Stelle für Stelle', () => {
    expect(isNewer('0.4.1', '0.4.0')).toBe(true)
    expect(isNewer('0.10.0', '0.9.9')).toBe(true)
    expect(isNewer('0.4.0', '0.4.0')).toBe(false)
    expect(isNewer('0.3.9', '0.4.0')).toBe(false)
    expect(isNewer('unknown', '0.4.0')).toBe(false)
  })

  test('installiert eine neuere Version über claude plugin update', async () => {
    const { host, calls } = fake({ latest: '0.4.1' })
    expect(await checkForUpdate(host, ROOT, true, NOW)).toEqual({ kind: 'installed', version: '0.4.1' })
    expect(calls.fetched).toEqual([LATEST_URL])
    expect(calls.ran).toEqual([['claude', 'plugin', 'update', 'agent-tree@agent-tree']])
  })

  test('lässt eine aktuelle Installation in Ruhe', async () => {
    const { host, calls } = fake({ latest: '0.4.0' })
    expect((await checkForUpdate(host, ROOT, true, NOW)).kind).toBe('current')
    expect(calls.ran).toEqual([])
  })

  test('fragt höchstens einmal am Tag', async () => {
    const { host, calls } = fake({ latest: '0.4.1', stored: { checkedAt: NOW - 1000 } })
    expect((await checkForUpdate(host, ROOT, true, NOW)).kind).toBe('skipped')
    expect(calls.fetched).toEqual([])
  })

  test('die Einstellung und DO_NOT_TRACK schalten ihn ab', async () => {
    const { host, calls } = fake({ latest: '0.4.1', env: { DO_NOT_TRACK: '1' } })
    expect((await checkForUpdate(host, ROOT, false, NOW)).kind).toBe('off')
    expect((await checkForUpdate(host, ROOT, true, NOW)).kind).toBe('off')
    expect(calls.fetched).toEqual([])
  })

  for (const name of ['DISABLE_AUTOUPDATER', 'DISABLE_UPDATES', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']) {
    test(`${name} von Claude Code schaltet ihn ab`, async () => {
      const { host, calls } = fake({ latest: '0.4.1', env: { [name]: '1' } })
      expect((await checkForUpdate(host, ROOT, true, NOW)).kind).toBe('off')
      expect(calls.fetched).toEqual([])
    })
  }

  test('der Wert 0 oder false schaltet nichts ab', async () => {
    const { host } = fake({ latest: '0.4.1', env: { DO_NOT_TRACK: '0', DISABLE_AUTOUPDATER: 'false' } })
    expect((await checkForUpdate(host, ROOT, true, NOW)).kind).toBe('installed')
  })

  test('ohne Installation aus einem Marktplatz fragt er nicht', async () => {
    const { host, calls } = fake({ latest: '0.4.1' })
    expect((await checkForUpdate(host, '/home/u/.claude/skills/agent-tree', true, NOW)).kind).toBe('skipped')
    expect(calls.fetched).toEqual([])
  })

  test('ohne Antwort von GitHub bleibt alles, wie es ist', async () => {
    const { host, calls } = fake({ latest: '0.4.1', ok: false })
    expect((await checkForUpdate(host, ROOT, true, NOW)).kind).toBe('skipped')
    expect(calls.ran).toEqual([])
  })

  test('führt der Marktplatz die neue Version noch nicht, meldet er nichts und versucht sie nicht noch einmal', async () => {
    const { host, calls } = fake({ latest: '0.4.1', stdout: 'agent-tree is already at the latest version (0.4.0).' })
    expect((await checkForUpdate(host, ROOT, true, NOW)).kind).toBe('current')
    expect((await checkForUpdate(host, ROOT, true, NOW + 2 * DAY)).kind).toBe('skipped')
    expect(calls.ran.length).toBe(1)
  })

  test('scheitert das Update, nennt er den Befehl und versucht dieselbe Version nicht noch einmal', async () => {
    const { host, calls } = fake({ latest: '0.4.1', exitCode: 1 })
    expect(await checkForUpdate(host, ROOT, true, NOW)).toEqual({
      kind: 'failed',
      version: '0.4.1',
      command: 'claude plugin update agent-tree@agent-tree',
    })
    expect((await checkForUpdate(host, ROOT, true, NOW + 2 * DAY)).kind).toBe('skipped')
    expect(calls.ran.length).toBe(1)
  })
})
