// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
export const PEER_PREFIX = 'peer:'
export const PEER_OPEN_MS = 10 * 60_000
export const PEER_FORGET_MS = 60 * 60_000
export const PEER_BEAT_MS = 30_000
export const PEER_FILES = 40
export const PEER_NOTES = 10
export const NOTE_FRESH_MS = 60 * 60_000
export const CLASH_WINDOW_MS = 30 * 60_000

export type PeerFile = { key: string; name: string; at: number }
export type PeerNote = { path: string; name: string; at: number }
export type Peer = {
  id: string
  folder: string
  rootKey: string
  branch?: string
  dirty?: number
  running: number
  costUsd?: number
  at: number
  changed: PeerFile[]
  notes: PeerNote[]
}

export type PeerClash = { name: string; folder: string; id: string }
export type PeerNews = PeerNote & { folder: string; id: string; mark: string }

const isText = (v: unknown): v is string => typeof v === 'string'
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function fileOf(v: unknown): PeerFile | undefined {
  const f = v as Partial<PeerFile> | null
  return f && isText(f.key) && isText(f.name) && isCount(f.at) ? { key: f.key, name: f.name, at: f.at } : undefined
}

function noteOf(v: unknown): PeerNote | undefined {
  const n = v as Partial<PeerNote> | null
  return n && isText(n.path) && isText(n.name) && isCount(n.at) ? { path: n.path, name: n.name, at: n.at } : undefined
}

export function peerOf(v: unknown): Peer | undefined {
  const p = v as Partial<Peer> | null
  if (!p || typeof p !== 'object' || !isText(p.id) || !isText(p.folder) || !isText(p.rootKey) || !isCount(p.at) || !isCount(p.running)) return undefined
  return {
    id: p.id,
    folder: p.folder,
    rootKey: p.rootKey,
    ...(isText(p.branch) && p.branch ? { branch: p.branch } : {}),
    ...(isCount(p.dirty) ? { dirty: p.dirty } : {}),
    running: p.running,
    ...(isCount(p.costUsd) ? { costUsd: p.costUsd } : {}),
    at: p.at,
    changed: (Array.isArray(p.changed) ? p.changed : []).map(fileOf).filter((f): f is PeerFile => f !== undefined).slice(-PEER_FILES),
    notes: (Array.isArray(p.notes) ? p.notes : []).map(noteOf).filter((n): n is PeerNote => n !== undefined).slice(-PEER_NOTES),
  }
}

export function isPeerKey(key: string): boolean {
  return key.startsWith(PEER_PREFIX)
}

export function peerKey(id: string): string {
  return `${PEER_PREFIX}${id}`
}

export function isOpen(p: Peer, now: number): boolean {
  return now - p.at <= PEER_OPEN_MS
}

export function isForgotten(p: Peer | undefined, now: number): boolean {
  return !p || now - p.at > PEER_FORGET_MS
}

export function folderOf(root: string): string {
  const parts = root.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] ?? root
}

export function isMarkdown(path: string): boolean {
  return /\.(?:md|markdown)$/i.test(path)
}

export function changeNoted(p: Peer, file: PeerFile, note: PeerNote | undefined): Peer {
  return {
    ...p,
    at: Math.max(p.at, file.at),
    changed: [...p.changed.filter(f => f.key !== file.key), file].slice(-PEER_FILES),
    notes: note ? [...p.notes.filter(n => n.path !== note.path), note].slice(-PEER_NOTES) : p.notes,
  }
}

export function crossClashes(self: Peer, others: readonly Peer[], now: number): PeerClash[] {
  const recent = (f: PeerFile) => now - f.at <= CLASH_WINDOW_MS
  const mine = new Set(self.changed.filter(recent).map(f => f.key))
  const found: PeerClash[] = []
  for (const other of others) {
    if (other.id === self.id || !isOpen(other, now)) continue
    for (const f of other.changed) if (recent(f) && mine.has(f.key)) found.push({ name: f.name, folder: other.folder, id: other.id })
  }
  return found
}

export function noteMark(id: string, note: PeerNote): string {
  return `${id}|${note.path}|${note.at}`
}

export function peerNews(self: Peer, others: readonly Peer[], dropped: ReadonlySet<string>, now: number): PeerNews[] {
  const found: PeerNews[] = []
  for (const other of others) {
    if (other.id === self.id || other.rootKey === self.rootKey) continue
    for (const note of other.notes) {
      const mark = noteMark(other.id, note)
      if (now - note.at > NOTE_FRESH_MS || dropped.has(mark)) continue
      found.push({ ...note, folder: other.folder, id: other.id, mark })
    }
  }
  return found.sort((a, b) => b.at - a.at)
}
