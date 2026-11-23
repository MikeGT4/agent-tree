// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { PEER_FILES, changeNoted, crossClashes, folderOf, isForgotten, isMarkdown, isOpen, peerNews, peerOf } from '../hooks/peers.ts'
import type { Peer } from '../hooks/peers.ts'

const peer = (id: string, at: number, rootKey = id): Peer => ({ id, folder: `ordner-${id}`, rootKey, running: 0, at, changed: [], notes: [] })

describe('Terminals', () => {
  test('ein Eintrag aus dem Speicher wird geprüft, Fremdes fällt weg', () => {
    expect(peerOf({ id: 'a', folder: 'x', rootKey: 'k', running: 2, at: 5, changed: [{ key: 'h', name: 'n', at: 1 }, { bad: 1 }], notes: 'nein' })).toEqual({ id: 'a', folder: 'x', rootKey: 'k', running: 2, at: 5, changed: [{ key: 'h', name: 'n', at: 1 }], notes: [] })
    expect(peerOf({ id: 'a' })).toBeUndefined()
    expect(peerOf('text')).toBeUndefined()
  })

  test('offen bis zehn Minuten nach dem letzten Lebenszeichen, vergessen nach einer Stunde', () => {
    expect(isOpen(peer('a', 0), 10 * 60_000)).toBe(true)
    expect(isOpen(peer('a', 0), 10 * 60_000 + 1)).toBe(false)
    expect(isForgotten(peer('a', 0), 60 * 60_000 + 1)).toBe(true)
    expect(isForgotten(undefined, 0)).toBe(true)
  })

  test('Ordnername, Markdown und begrenzte Dateiliste', () => {
    expect(folderOf('/home/u/claude_hermes')).toBe('claude_hermes')
    expect(folderOf('C:\\\\Users\\\\u\\\\proj\\\\')).toBe('proj')
    expect(isMarkdown('/a/CLAUDE.md')).toBe(true)
    expect(isMarkdown('/a/x.ts')).toBe(false)
    let p = peer('a', 0)
    for (let i = 0; i < PEER_FILES + 5; i++) p = changeNoted(p, { key: `k${i}`, name: `f${i}`, at: i }, undefined)
    expect(p.changed.length).toBe(PEER_FILES)
    expect(p.changed.at(-1)?.name).toBe(`f${PEER_FILES + 4}`)
  })

  test('gleiche Datei in einem anderen offenen Terminal ist ein Konflikt, ein geschlossenes nicht', () => {
    const self = changeNoted(peer('a', 0), { key: 'h1', name: 'auth.ts', at: 0 }, undefined)
    const open = changeNoted(peer('b', 0), { key: 'h1', name: 'auth.ts', at: 0 }, undefined)
    const gone = changeNoted(peer('c', -20 * 60_000), { key: 'h1', name: 'auth.ts', at: -20 * 60_000 }, undefined)
    expect(crossClashes(self, [open, gone], 1000)).toEqual([{ name: 'auth.ts', folder: 'ordner-b', id: 'b' }])
  })

  test('Markdown aus einem anderen Projekt erscheint, aus demselben Projekt und nach dem Wegklicken nicht', () => {
    const self = peer('a', 0, 'projekt')
    const other = changeNoted(peer('b', 0), { key: 'h', name: 'CLAUDE.md', at: 100 }, { path: '/b/CLAUDE.md', name: 'CLAUDE.md', at: 100 })
    const twin = changeNoted(peer('c', 0, 'projekt'), { key: 'h', name: 'TODO.md', at: 100 }, { path: '/a/TODO.md', name: 'TODO.md', at: 100 })
    const news = peerNews(self, [other, twin], new Set(), 200)
    expect(news.map(n => n.name)).toEqual(['CLAUDE.md'])
    expect(peerNews(self, [other], new Set([news[0]?.mark ?? '']), 200)).toEqual([])
    expect(peerNews(self, [other], new Set(), 100 + 2 * 60 * 60_000)).toEqual([])
  })
})
