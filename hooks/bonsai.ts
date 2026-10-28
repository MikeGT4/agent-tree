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
