// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { brailleRows } from '../hooks/bonsai.ts'

describe('Bonsai', () => {
  test('Braille-Raster: Punkte auf Zeichen', () => {
    expect(brailleRows(1, 1, [[0, 0]])).toEqual(['⠁'])
    expect(brailleRows(1, 1, [[1, 0]])).toEqual(['⠈'])
    expect(brailleRows(1, 1, [[0, 3]])).toEqual(['⡀'])
    expect(brailleRows(1, 1, [[1, 3]])).toEqual(['⢀'])
    const all: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3]]
    expect(brailleRows(1, 1, all)).toEqual(['⣿'])
    expect(brailleRows(2, 1, [])).toEqual(['  '])
    expect(brailleRows(1, 1, [[5, 5]])).toEqual([' '])
    expect(brailleRows(2, 2, [[3, 7]])).toEqual(['  ', ' ⢀'])
  })
})
