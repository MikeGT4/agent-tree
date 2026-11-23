// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { LOCAL_DEFAULT_URL, candidatesOf, choiceOf, localAnswerOf, localAskOf, localErrorOf, localSetup, modelsOf, nextMode, setupOf, tallied } from '../hooks/local.ts'

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

  test('gespeicherte Wahl vor der Option, Stufen reihum, Modellliste aus OpenAI- und Ollama-Format', () => {
    expect(choiceOf(undefined, undefined)).toEqual({ mode: 'off' })
    expect(choiceOf(undefined, { model: 'a', url: 'http://x/v1' })).toEqual({ model: 'a', url: 'http://x/v1', mode: 'ask' })
    expect(choiceOf({ model: 'b', url: 'http://y/v1', mode: 'auto' }, { model: 'a', url: 'http://x/v1' })).toEqual({ model: 'b', url: 'http://y/v1', mode: 'auto' })
    expect(choiceOf({ mode: 'kaputt' }, undefined)).toEqual({ mode: 'off' })
    expect(setupOf({ model: 'b', url: 'http://y/v1', mode: 'off' })).toBeUndefined()
    expect([nextMode('off'), nextMode('ask'), nextMode('auto')]).toEqual(['ask', 'auto', 'off'])
    expect(modelsOf(JSON.stringify({ data: [{ id: 'g' }, { id: 'g' }], models: [{ name: 'q' }] }))).toEqual(['g', 'q'])
    expect(candidatesOf({ mode: 'off' }, 'http://z/v1')).toEqual(['http://z/v1', 'http://127.0.0.1:11434/v1', 'http://127.0.0.1:1234/v1'])
  })
})
