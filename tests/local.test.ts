// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { LOCAL_DEFAULT_URL, localAnswerOf, localAskOf, localErrorOf, localSetup, tallied } from '../hooks/local.ts'

describe('Lokales Modell, Bausteine', () => {
  test('ohne Modellname aus, Adresse ohne Schrägstrich und ohne Endpunkt, nur http und https', () => {
    expect(localSetup('', 'http://x')).toBeUndefined()
    expect(localSetup('  ', undefined)).toBeUndefined()
    expect(localSetup('qwen', undefined)).toEqual({ model: 'qwen', url: LOCAL_DEFAULT_URL })
    expect(localSetup('qwen', 'http://127.0.0.1:1234/v1/chat/completions')).toEqual({ model: 'qwen', url: 'http://127.0.0.1:1234/v1' })
    expect(localSetup('qwen', 'file:///etc')).toBeUndefined()
  })

  test('Eingabe braucht einen Text, Antwort im OpenAI-Format mit Tokens', () => {
    expect(localAskOf({ prompt: ' ' })).toBeUndefined()
    expect(localAskOf({ prompt: 'a', system: '' })).toEqual({ prompt: 'a' })
    expect(localAnswerOf('kein json')).toBeUndefined()
    expect(localAnswerOf(JSON.stringify({ choices: [] }))).toBeUndefined()
    expect(localAnswerOf(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 3, completion_tokens: 4 } }))).toEqual({ text: 'ok', tokens: 7 })
  })

  test('die Fehlermeldung des Servers wird mitgegeben, im OpenAI- und im einfachen Format', () => {
    expect(localErrorOf(JSON.stringify({ error: { message: 'model "x" not found' } }))).toBe('model "x" not found')
    expect(localErrorOf(JSON.stringify({ error: 'kaputt' }))).toBe('kaputt')
    expect(localErrorOf('<html>')).toBeUndefined()
    expect(localErrorOf(undefined)).toBeUndefined()
  })

  test('die Zählung trennt Aufrufe und Fehler', () => {
    const zero = { calls: 0, tokens: 0, ms: 0, failed: 0 }
    expect(tallied(tallied(zero, { text: 'a', tokens: 10 }, 500), undefined, 100)).toEqual({ calls: 1, tokens: 10, ms: 500, failed: 1 })
  })
})
