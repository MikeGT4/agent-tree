// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { isNewer } from './update.ts'
import type { Lang } from './words.ts'

export const VERSION = '0.7.9'
export const SEEN_VERSION_KEY = 'seenVersion'
export const NOTICE_MS = 3000
export const NOTICE_LINES = 3

export const NEWS: Readonly<Record<string, Readonly<Record<Lang, readonly string[]>>>> = {
  '0.7.7': {
    de: ['Läuft im Code Mode von Claude Code', 'Stopp und Schreiben auch im Code Mode'],
    en: ["Works in Claude Code's Code Mode", 'Stop and write work in Code Mode too'],
  },
  '0.7.8': {
    de: ['Zeigt nach einem Update, was neu ist'],
    en: ['Shows what is new after an update'],
  },
  '0.7.9': {
    de: ['Nachrichten an Agenten: ein Weg in jeder Sitzung'],
    en: ['Messages to agents: one path in every session'],
  },
}

export type UpdateNotice = { from?: string; to: string; lines: string[] }

export function newsBetween(from: string | undefined, to: string, lang: Lang): string[] {
  return Object.keys(NEWS)
    .filter(version => (from === undefined || isNewer(version, from)) && !isNewer(version, to))
    .sort((a, b) => (isNewer(a, b) ? -1 : isNewer(b, a) ? 1 : 0))
    .flatMap(version => NEWS[version]?.[lang] ?? [])
    .slice(0, NOTICE_LINES)
}

export function noticeFor(seen: unknown, current: string, earlierUser: boolean, lang: Lang): UpdateNotice | undefined {
  const before = typeof seen === 'string' && /^\d+(\.\d+)*$/.test(seen) ? seen : undefined
  if (before !== undefined) return isNewer(current, before) ? { from: before, to: current, lines: newsBetween(before, current, lang) } : undefined
  return earlierUser ? { to: current, lines: newsBetween(undefined, current, lang) } : undefined
}
