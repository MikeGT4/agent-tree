// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'
import { rowsOf, thumbOf } from '../hooks/scrollbar.tsx'

describe('Scrollbalken', () => {
  test('ohne Überlauf kein Griff', () => {
    expect(thumbOf({ offset: 0, rows: 10, total: 10 })).toBeUndefined()
  })

  test('der Griff ist so groß wie der sichtbare Anteil', () => {
    expect(thumbOf({ offset: 0, rows: 10, total: 40 })).toEqual({ start: 0, size: 3 })
  })

  test('am Ende sitzt der Griff unten', () => {
    expect(thumbOf({ offset: 30, rows: 10, total: 40 })).toEqual({ start: 7, size: 3 })
  })

  test('umbrechender Text zählt seine Zeilen', () => {
    const box = { type: 'Box', props: { flexDirection: 'column' }, children: [{ type: 'Text', props: { wrap: 'wrap' }, children: ['x'.repeat(25)] }, { type: 'Text', props: { wrap: 'truncate-end' }, children: ['y'.repeat(25)] }] }
    expect(rowsOf(box, 10)).toBe(4)
  })

  test('Rahmen und Abstand zählen mit', () => {
    const box = { type: 'Box', props: { flexDirection: 'column', borderStyle: 'round', marginTop: 1 }, children: [{ type: 'Text', props: {}, children: ['a'] }] }
    expect(rowsOf(box, 20)).toBe(4)
  })
})
