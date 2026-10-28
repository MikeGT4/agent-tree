// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
const DOT_BITS = [0x01, 0x08, 0x02, 0x10, 0x04, 0x20, 0x40, 0x80]

export function dotBit(x: number, y: number): number {
  return DOT_BITS[(y & 3) * 2 + (x & 1)] ?? 0
}

export function brailleChar(mask: number): string {
  return mask ? String.fromCharCode(0x2800 + mask) : ' '
}

export function brailleMasks(cols: number, rows: number, dots: Iterable<readonly [number, number]>): Uint8Array {
  const masks = new Uint8Array(Math.max(0, cols * rows))
  for (const [rawX, rawY] of dots) {
    const x = Math.floor(rawX)
    const y = Math.floor(rawY)
    if (x < 0 || y < 0 || x >= cols * 2 || y >= rows * 4) continue
    const cell = Math.floor(y / 4) * cols + Math.floor(x / 2)
    masks[cell] = (masks[cell] ?? 0) | dotBit(x, y)
  }
  return masks
}

export function brailleRows(cols: number, rows: number, dots: Iterable<readonly [number, number]>): string[] {
  const masks = brailleMasks(cols, rows, dots)
  return Array.from({ length: rows }, (_, row) => Array.from(masks.subarray(row * cols, (row + 1) * cols), brailleChar).join(''))
}

export type Part = 'pot' | 'wood' | 'leaf'
export type Dot = { x: number; y: number; at: number; part: Part }
export type BonsaiForm = 'upright' | 'cascade' | 'windswept'
export const BONSAI_FORMS: readonly BonsaiForm[] = ['upright', 'cascade', 'windswept']
export type Plant = { dots: Dot[]; branches: number }

type Point = { x: number; y: number }
type Curve = (t: number) => Point

const PART_RANK: Record<Part, number> = { leaf: 1, wood: 2, pot: 3 }
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]
const FIT_TRIES = 6
const FIT_SHRINK = 0.88

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point): Curve {
  return t => {
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const d = t * t * t
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
  }
}

function quadratic(p0: Point, p1: Point, p2: Point): Curve {
  return t => {
    const u = 1 - t
    return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y }
  }
}

function curveLength(curve: Curve): number {
  let length = 0
  let last = curve(0)
  for (let i = 1; i <= 16; i++) {
    const next = curve(i / 16)
    length += Math.hypot(next.x - last.x, next.y - last.y)
    last = next
  }
  return length
}

function sketch(wide: number, high: number) {
  const cells = new Map<number, Dot>()
  let outside = 0
  const put = (rawX: number, rawY: number, at: number, part: Part) => {
    const x = Math.round(rawX)
    const y = Math.round(rawY)
    if (x < 0 || y < 0 || x >= wide || y >= high) {
      outside++
      return
    }
    const key = y * wide + x
    const old = cells.get(key)
    if (!old || PART_RANK[part] > PART_RANK[old.part] || (part === old.part && at < old.at)) cells.set(key, { x, y, at, part })
  }
  const stroke = (curve: Curve, from: number, to: number, at: number, duration: number) => {
    const steps = Math.max(2, Math.ceil(curveLength(curve) * 2))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const p = curve(t)
      const radius = Math.max(0, (from + (to - from) * t) / 2 - 0.5)
      const when = at + duration * t
      const reach = Math.ceil(radius)
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) if (dx * dx + dy * dy <= radius * radius + 0.25) put(p.x + dx, p.y + dy, when, 'wood')
    }
  }
  const pad = (rand: () => number, center: Point, width: number, at: number, stretch: number) => {
    const height = width * (0.45 + 0.15 * rand())
    const count = 3 + Math.floor(rand() * 3)
    const lobes = Array.from({ length: count }, (_, j) => ({
      x: center.x + (count === 1 ? 0 : (j / (count - 1) - 0.5) * width * 0.6 * stretch) + (rand() - 0.5) * width * 0.1,
      y: center.y + (rand() - 0.5) * height * 0.3,
      rx: width * (0.22 + 0.1 * rand()) * stretch,
      ry: height * (0.4 + 0.15 * rand()),
    }))
    const inside = (x: number, y: number) => lobes.some(l => ((x - l.x) / l.rx) ** 2 + ((y - l.y) / l.ry) ** 2 <= 1)
    const density = 0.3 + 0.2 * rand()
    const duration = 0.2 + 0.1 * rand()
    const left = Math.floor(Math.min(...lobes.map(l => l.x - l.rx)))
    const right = Math.ceil(Math.max(...lobes.map(l => l.x + l.rx)))
    const top = Math.floor(Math.min(...lobes.map(l => l.y - l.ry)))
    const bottom = Math.ceil(Math.max(...lobes.map(l => l.y + l.ry)))
    const reach = Math.max(1, Math.hypot(right - left, bottom - top) / 2)
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        if (!inside(x, y)) continue
        const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
        const row = BAYER[((y % 4) + 4) % 4] ?? []
        const lit = rim || (row[((x % 4) + 4) % 4] ?? 0) < density * 16
        if (lit) put(x, y, at + duration * Math.min(1, Math.hypot(x - center.x, y - center.y) / reach), 'leaf')
      }
  }
  const pot = (centerX: number, top: number, width: number, height: number) => {
    const half = width / 2
    for (let x = Math.round(centerX - half - 1); x <= Math.round(centerX + half + 1); x++) put(x, top, 0, 'pot')
    const inset = Math.max(1, Math.round(width * 0.08))
    for (let y = 1; y <= height; y++) {
      const shift = (inset * y) / height
      put(centerX - half + shift, top + y, 0, 'pot')
      put(centerX + half - shift, top + y, 0, 'pot')
    }
    for (let x = Math.round(centerX - half + inset); x <= Math.round(centerX + half - inset); x++) put(x, top + height, 0, 'pot')
    put(centerX - half / 2, top + height + 1, 0, 'pot')
    put(centerX + half / 2, top + height + 1, 0, 'pot')
    for (let x = Math.round(centerX - half + 1); x <= Math.round(centerX + half - 1); x += 2) put(x, top - 1, 0, 'pot')
  }
  return { put, stroke, pad, pot, cells, outside: () => outside }
}

function growPlant(seed: number, wide: number, high: number, form: BonsaiForm, size: number) {
  const rand = mulberry32(seed)
  const between = (lo: number, hi: number) => lo + (hi - lo) * rand()
  const canvas = sketch(wide, high)
  const side = rand() < 0.5 ? -1 : 1
  const potWidth = between(0.45, 0.6) * size
  const potHeight = Math.max(3, between(0.08, 0.12) * size)
  const trunkBase = Math.min(12, Math.max(4, Math.round(size / 10)))
  const centerX = form === 'cascade' ? wide / 2 - side * 0.2 * size : form === 'windswept' ? wide / 2 - side * 0.15 * size : wide / 2
  const potTop = form === 'cascade' ? Math.round(high * 0.42) : Math.round(high - 2 - potHeight)
  canvas.pot(centerX, potTop, potWidth, potHeight)
  const base = { x: centerX, y: potTop - 1 }
  const height = (form === 'windswept' ? between(0.48, 0.56) : between(0.5, 0.62)) * size
  const sway = between(0.12, 0.2) * size * side
  const trunk =
    form === 'cascade'
      ? cubic(base, { x: centerX, y: potTop - 0.3 * size }, { x: centerX + side * 0.5 * size, y: potTop - 0.32 * size }, { x: centerX + side * 0.55 * size, y: potTop + 0.48 * size })
      : form === 'windswept'
        ? cubic(base, { x: centerX + side * 0.12 * size, y: potTop - height * 0.3 }, { x: centerX + side * 0.32 * size, y: potTop - height * 0.65 }, { x: centerX + side * 0.5 * size, y: potTop - height * 0.85 })
        : cubic(base, { x: centerX + sway, y: potTop - height * 0.35 }, { x: centerX - sway * 0.8, y: potTop - height * 0.7 }, { x: centerX + sway * 0.3, y: potTop - height })
  const trunkAt = (t: number) => 0.08 + 0.37 * t
  const trunkWidth = (t: number) => trunkBase + (trunkBase / 3 - trunkBase) * t
  canvas.stroke(trunk, trunkBase, trunkBase / 3, 0.08, 0.37)
  const count = size < 60 ? 3 : 3 + Math.floor(rand() * 3)
  const [from, to] = form === 'cascade' ? [0.4, 0.95] : [0.32, 0.9]
  let length = between(0.32, 0.45) * size * (form === 'cascade' ? 0.6 : 1)
  const padWidth = (form === 'windswept' ? 0.2 : 0.16) * size
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * (i + between(0.2, 0.8))) / count
    const anchor = trunk(t)
    const towards = form === 'windswept' ? side : i % 2 === 0 ? -side : side
    const rise = form === 'windswept' ? between(0.02, 0.18) : form === 'cascade' ? between(-0.3, 0.1) : between(0.15, 0.45)
    const norm = Math.hypot(1, rise)
    const end = { x: anchor.x + (towards * length) / norm, y: anchor.y - (rise * length) / norm }
    const bend = { x: (anchor.x + end.x) / 2, y: (anchor.y + end.y) / 2 - length * between(0.08, 0.18) }
    const start = trunkAt(t) + 0.02
    const duration = between(0.15, 0.25)
    canvas.stroke(quadratic(anchor, bend, end), Math.max(2, trunkWidth(t) * 0.55), 1, start, duration)
    canvas.pad(rand, { x: end.x + towards * padWidth * 0.15, y: end.y - padWidth * 0.2 }, padWidth * between(0.85, 1.15), start + duration - 0.03, form === 'windswept' ? 1.5 : 1)
    length *= between(0.75, 0.85)
  }
  const crown = form === 'cascade' ? trunk(0.3) : trunk(1)
  canvas.pad(rand, { x: crown.x, y: crown.y - padWidth * 0.25 }, padWidth * 1.3, 0.42, form === 'windswept' ? 1.5 : 1)
  if (form === 'cascade') canvas.pad(rand, trunk(1), padWidth * 0.9, 0.42, 1)
  return { canvas, branches: count }
}

export function bonsaiPlant(seed: number, dotsWide: number, dotsHigh: number, form: BonsaiForm = 'upright'): Plant {
  const fullSize = Math.min(0.9 * dotsHigh, 0.65 * dotsWide)
  let grown = growPlant(seed, dotsWide, dotsHigh, form, fullSize)
  for (let attempt = 1; attempt < FIT_TRIES && grown.canvas.outside() > 0; attempt++)
    grown = growPlant(seed, dotsWide, dotsHigh, form, fullSize * FIT_SHRINK ** attempt)
  const dots = [...grown.canvas.cells.values()]
  const latest = Math.max(1, ...dots.map(d => d.at))
  return {
    dots: dots.map(d => (latest > 1 ? { ...d, at: d.at / latest } : d)).sort((a, b) => a.at - b.at || a.y - b.y || a.x - b.x),
    branches: grown.branches,
  }
}

export const INTRO_MS = 2000
export const GROW_FROM = 50
export const GROW_TO = 1050
export const HOLD_TO = 1700
export type IntroPhase = 'grow' | 'hold' | 'handoff' | 'done'

export function introPhase(ms: number): IntroPhase {
  return ms >= INTRO_MS ? 'done' : ms >= HOLD_TO ? 'handoff' : ms >= GROW_TO ? 'hold' : 'grow'
}

export function visibleDots(dots: readonly Dot[], ms: number): Dot[] {
  const phase = introPhase(ms)
  if (phase === 'done') return []
  const limit =
    phase === 'handoff'
      ? 1 - ((ms - HOLD_TO) / (INTRO_MS - HOLD_TO)) ** 2
      : Math.min(1, Math.max(0, (ms - GROW_FROM) / (GROW_TO - GROW_FROM)))
  return dots.filter(d => d.at <= limit)
}
