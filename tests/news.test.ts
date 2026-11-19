// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { NEWS, NOTICE_LINES, VERSION, newsBetween, noticeFor } from '../hooks/news.ts'
import { arrowLength } from '../hooks/notice.tsx'

describe('Update-Hinweis', () => {
  test('die eigene Version hat Neuigkeiten in beiden Sprachen', () => {
    expect(VERSION).toBe('0.7.10')
    expect(NEWS[VERSION]?.de.length).toBeGreaterThan(0)
    expect(NEWS[VERSION]?.en.length).toBe(NEWS[VERSION]?.de.length)
  })

  test('Neuigkeiten nur aus dem Sprung, neueste zuerst, höchstens drei Zeilen', () => {
    expect(newsBetween('0.7.7', '0.7.8', 'de')).toEqual(['Zeigt nach einem Update, was neu ist'])
    expect(newsBetween('0.7.6', '0.7.8', 'en')).toEqual(['Shows what is new after an update', "Works in Claude Code's Code Mode", 'Stop and write work in Code Mode too'])
    expect(newsBetween(undefined, '0.7.8', 'de').length).toBe(NOTICE_LINES)
    expect(newsBetween('0.7.6', '0.7.7', 'de')).toEqual(['Läuft im Code Mode von Claude Code', 'Stopp und Schreiben auch im Code Mode'])
    expect(newsBetween('0.7.8', '0.7.8', 'de')).toEqual([])
  })

  test('der Hinweis kommt nur nach einem echten Sprung oder für bisherige Nutzer', () => {
    expect(noticeFor('0.7.7', '0.7.8', false, 'de')).toEqual({ from: '0.7.7', to: '0.7.8', lines: ['Zeigt nach einem Update, was neu ist'] })
    expect(noticeFor('0.7.8', '0.7.8', true, 'de')).toBeUndefined()
    expect(noticeFor('0.7.9', '0.7.8', true, 'de')).toBeUndefined()
    expect(noticeFor(undefined, '0.7.8', false, 'de')).toBeUndefined()
    expect(noticeFor(undefined, '0.7.8', true, 'de')?.from).toBeUndefined()
    expect(noticeFor('kaputt', '0.7.8', true, 'de')?.to).toBe('0.7.8')
  })

  test('der Pfeil wächst in 450 ms auf volle Länge, ohne Bewegung steht er sofort', () => {
    expect([arrowLength(20, 0, true), arrowLength(20, 450, true), arrowLength(20, 0, false)]).toEqual([1, 20, 20])
    expect(arrowLength(20, 150, true)).toBeGreaterThan(arrowLength(20, 50, true))
  })
})
