// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { AgentTreeCorrectionState, AgentTreeLogEntry, AgentTreeLogSource, AgentTreePhase, AgentTreeStatus } from '../types'
import type { LookRow } from './looks.ts'
import { LOOK_OPTIONS } from './looks.ts'
import { familyLabel, fmtDuration, fmtTokens } from './model.ts'

export type Lang = 'de' | 'en'

export type Words = {
  working: string
  idle: string
  advisorOnCall: (model: string) => string
  main: string
  agents: string
  advisor: string
  phase: Record<AgentTreePhase, string>
  status: Record<AgentTreeStatus, string>
  mainEnd: Record<AgentTreeStatus, string>
  running: (n: number) => string
  done: string
  effortNone: string
  context: string
  contextNone: string
  round: string
  noRound: string
  toAgents: string
  model: string
  standard: string
  noAgents: string
  back: string
  waiting: string
  ready: string
  answers: (n: number) => string
  tools: string
  under: string
  more: (n: number, running: number) => string
  earlier: (n: number) => string
  advisorTitle: string
  onCall: string
  off: string
  reads: [string, string]
  calls: string
  fromMain: string
  fromSub: string
  last: string
  duration: string
  notAsked: string
  writes: [string, string]
  log: string
  logEmpty: string
  source: Record<AgentTreeLogSource, string>
  pickerFor: (name: string) => string
  newAgents: string
  help: string
  task: string
  reply: string
  loading: string
  close: string
  noReply: string
  noAccess: string
  advisorShort: string
  contextShort: string
  cost: (usd: number) => string
  decimal: string
  percent: (p: number) => string
  latest: string
  stop: string
  stopping: string
  stopAnswer: (tools: number) => string
  sayPlaceholder: string
  send: string
  correctionFrame: (text: string, tool: string) => string
  mainNote: (agent: string, text: string) => string
  correctionWaiting: (tool: string) => string
  correctionFailedStatus: string
  correctionLabel: string
  correction: Record<AgentTreeCorrectionState, string>
  toolWords: Record<string, string>
  subModel: string
  advisorOn: string
  advisorOff: string
  advisorUnavailable: string
  look: string
  lookRow: Record<LookRow, string>
  lookOption: { [R in LookRow]: Record<(typeof LOOK_OPTIONS)[R][number], string> }
  lookReset: string
  lookSet: (row: string, option: string) => string
  lookUnknown: (name: string, row: string, options: string) => string
  commandDescription: string
  commandHint: string
  opened: (count: number) => string
  closedText: string
  cleared: string
  notOpened: (reason: string) => string
  commandFailed: string
  lines: {
    turn: (d: Record<string, string | number>) => string
    mainDone: (d: Record<string, string | number>) => string
    agentStarted: (d: Record<string, string | number>) => string
    workflowStarted: (d: Record<string, string | number>) => string
    agentEnded: (d: Record<string, string | number>) => string
    workflowDone: (d: Record<string, string | number>) => string
    resumed: (d: Record<string, string | number>) => string
    adopted: (d: Record<string, string | number>) => string
    advisor: (d: Record<string, string | number>) => string
    choice: (d: Record<string, string | number>) => string
    stopRequested: (d: Record<string, string | number>) => string
    correction: (d: Record<string, string | number>) => string
    correctionFailed: (d: Record<string, string | number>) => string
    correctionResent: (d: Record<string, string | number>) => string
  }
}

export const familyOr = (family: string | number | undefined, standard: string) => (family ? familyLabel(String(family)) : standard)

export const WORDS: Record<Lang, Words> = {
  de: {
    working: 'ARBEITET',
    idle: 'BEREIT',
    advisorOnCall: model => `BERATER ${model} AUF ABRUF`,
    main: 'Hauptsitzung',
    agents: 'Unteragenten',
    advisor: 'Berater',
    phase: { idle: 'bereit', planning: 'plant und entscheidet', delegating: 'wartet auf Unteragenten', reviewing: 'prüft und verifiziert' },
    status: { running: 'läuft', done: 'fertig', failed: 'fehlgeschlagen', stopped: 'gestoppt' },
    mainEnd: { running: 'läuft', done: 'fertig', failed: 'fehlgeschlagen', stopped: 'abgebrochen' },
    running: n => `${n} ${n === 1 ? 'läuft' : 'laufen'}`,
    done: 'fertig',
    effortNone: 'ohne Effort-Stufe',
    context: 'Kontext',
    contextNone: 'Kontext noch nicht gemessen',
    round: 'Runde',
    noRound: 'noch keine Runde',
    toAgents: 'an Unteragenten',
    model: 'Modell',
    standard: 'Standard',
    noAgents: 'noch keine Unteragenten',
    back: 'zurück zur Hauptsitzung',
    waiting: 'wartet auf Antworten',
    ready: 'bereit',
    answers: n => `${n} ${n === 1 ? 'Antwort' : 'Antworten'}`,
    tools: 'Werkzeuge',
    under: 'unter',
    more: (n, r) => (r > 0 ? `+${n} weitere, ${r} davon laufen` : `+${n} weitere beendet`),
    earlier: n => `aus früheren Runden: ${n} ${n === 1 ? 'Agent' : 'Agenten'}`,
    advisorTitle: 'BERATER',
    onCall: 'auf Abruf',
    off: 'nicht eingeschaltet',
    reads: ['liest die ganze', 'Sitzung mit'],
    calls: 'Aufrufe',
    fromMain: 'Haupt',
    fromSub: 'Sub',
    last: 'zuletzt',
    duration: 'Dauer',
    notAsked: 'noch nie gefragt',
    writes: ['schreibt nie', 'selbst Code'],
    log: 'Sitzungsprotokoll',
    logEmpty: 'noch nichts geschehen',
    source: { session: 'sitzung', main: 'haupt', agent: 'agent', advisor: 'berater' },
    pickerFor: name => `Modell für ${name}:`,
    newAgents: 'neue Unteragenten',
    help: 'ctrl+x tab: Leiste · Tab, Pfeile: wandern · m: Modell · a: Aussehen · 0 bis 4: wählen · x: schließen · s: stoppen · Typ anklicken: Details · Esc: Textfeld verlassen',
    task: 'Auftrag',
    reply: 'Antwort',
    loading: 'lädt …',
    close: 'schließen',
    noReply: 'noch keine Antwort',
    noAccess: 'nicht lesbar',
    advisorShort: 'Berater',
    contextShort: 'Kontext',
    cost: usd => `${usd.toFixed(2).replace('.', ',')} $`,
    decimal: ',',
    percent: p => `${p} %`,
    latest: 'Zuletzt',
    stop: 'stoppen',
    stopping: 'hält an …',
    stopAnswer: n => `Im Agent Tree vom Nutzer gestoppt, nach ${n} ${n === 1 ? 'Werkzeugaufruf' : 'Werkzeugaufrufen'}.`,
    sayPlaceholder: 'Nachricht an diesen Agenten … · Esc: zurück',
    send: 'senden',
    correctionFrame: (text, tool) =>
      `Nachricht des Nutzers über Agent Tree: ${text}\n\nSie gilt ab jetzt für deinen Auftrag. Berücksichtige sie bei der weiteren Arbeit und in deinem Bericht über ${tool}.`,
    mainNote: (agent, text) =>
      `Der Nutzer hat dem Unteragenten ${agent} über Agent Tree geschrieben: „${text}“. Sein Ergebnis kann deshalb vom Auftrag abweichen.`,
    correctionWaiting: tool =>
      `Bevor du abschließt: Der Nutzer hat dir eine neue Nachricht geschrieben, sie steht oben. Setz sie um und ruf danach ${tool} erneut auf, mit einem Bericht, der sie berücksichtigt.`,
    correctionFailedStatus: 'Agent Tree: Korrektur nicht zugestellt',
    correctionLabel: 'Korrektur',
    correction: { sent: 'geschickt', read: 'gelesen', failed: 'nicht zugestellt' },
    toolWords: { SubagentHandback: 'Antwort übergeben' },
    subModel: 'Unteragenten-Modell',
    advisorOn: 'einschalten',
    advisorOff: 'ausschalten',
    advisorUnavailable: 'Agent Tree: /advisor ist in dieser Sitzung nicht verfügbar',
    look: 'Aussehen',
    lookRow: { style: 'Stil', colors: 'Farben', light: 'Licht' },
    lookOption: {
      style: { line: 'Linie', pixel: 'Pixel', braille: 'Braille', hud: 'HUD', ascii: 'ASCII' },
      colors: { original: 'Original', light: 'Hell', retro: 'Retro', mono: 'Mono' },
      light: { standard: 'Standard', white: 'Weiß', gold: 'Gold', cyan: 'Cyan', magenta: 'Magenta' },
    },
    lookReset: 'zurück auf Standard',
    lookSet: (row, option) => `Agent Tree · ${row}: ${option}`,
    lookUnknown: (name, row, options) => `Agent Tree: ${name ? `„${name}“ gibt es nicht. ` : ''}${row}: ${options}`,
    commandDescription: 'Agentenbaum der Sitzung als Kästen (stop, clear, stil, farben, licht)',
    commandHint: '[stop|clear|stil <name>|farben <name>|licht <name>]',
    opened: n => `Agent Tree geöffnet · ${n} ${n === 1 ? 'Agent' : 'Agenten'} bisher · /agent-tree stop schließt`,
    closedText: 'Agent Tree geschlossen',
    cleared: 'Agent Tree geleert',
    notOpened: reason => `Agent Tree: Leiste nicht geöffnet: ${reason}`,
    commandFailed: 'Agent Tree: Befehl gescheitert',
    lines: {
      turn: d => `Runde ${d.turn}: ${d.excerpt}`,
      mainDone: d => `Hauptsitzung ${WORDS.de.mainEnd[d.status as AgentTreeStatus] ?? d.status} nach ${fmtDuration(Number(d.durationMs))}`,
      agentStarted: d => `${d.type} gestartet: ${d.description}`,
      workflowStarted: d => `Workflow gestartet: ${d.description}`,
      agentEnded: d =>
        d.status === 'done'
          ? `${d.type} fertig nach ${fmtDuration(Number(d.durationMs))} · ↑ ${fmtTokens(Number(d.tokens))}`
          : `${d.type} ${WORDS.de.status[d.status as AgentTreeStatus] ?? d.status}`,
      workflowDone: d => `Workflow fertig: ${d.size} Agenten`,
      resumed: d => `${d.type} fortgesetzt: ${d.description}`,
      adopted: d => `${d.count} ${Number(d.count) === 1 ? 'Agent' : 'Agenten'} aus der Agentenliste übernommen`,
      advisor: d => `gefragt aus ${d.where ? d.where : 'Hauptsitzung'}`,
      choice: d => `Modell für ${d.who ? d.who : 'neue Unteragenten'}: ${familyOr(d.family, 'Standard')}`,
      stopRequested: d => `Stopp für ${d.type} angefordert`,
      correction: d => `Korrektur an ${d.type}: ${d.text}`,
      correctionFailed: d => `Korrektur an ${d.type} nicht zugestellt${d.text ? `: ${d.text}` : ''}`,
      correctionResent: d => `Korrektur an ${d.type} nachgeschickt`,
    },
  },
  en: {
    working: 'WORKING',
    idle: 'IDLE',
    advisorOnCall: model => `ADVISOR ${model} ON CALL`,
    main: 'Main session',
    agents: 'Sub-agents',
    advisor: 'Advisor',
    phase: { idle: 'idle', planning: 'plans and decides', delegating: 'waits for sub-agents', reviewing: 'reviews and verifies' },
    status: { running: 'running', done: 'done', failed: 'failed', stopped: 'stopped' },
    mainEnd: { running: 'running', done: 'done', failed: 'failed', stopped: 'aborted' },
    running: n => `${n} running`,
    done: 'done',
    effortNone: 'no effort level',
    context: 'Context',
    contextNone: 'context not measured yet',
    round: 'Round',
    noRound: 'no round yet',
    toAgents: 'to sub-agents',
    model: 'Model',
    standard: 'Default',
    noAgents: 'no sub-agents yet',
    back: 'back to main session',
    waiting: 'waits for answers',
    ready: 'idle',
    answers: n => `${n} ${n === 1 ? 'answer' : 'answers'}`,
    tools: 'Tools',
    under: 'under',
    more: (n, r) => (r > 0 ? `+${n} more, ${r} of them running` : `+${n} more finished`),
    earlier: n => `from earlier rounds: ${n} ${n === 1 ? 'agent' : 'agents'}`,
    advisorTitle: 'ADVISOR',
    onCall: 'on call',
    off: 'not enabled',
    reads: ['reads the whole', 'session'],
    calls: 'Calls',
    fromMain: 'main',
    fromSub: 'sub',
    last: 'last',
    duration: 'took',
    notAsked: 'not asked yet',
    writes: ['never writes', 'code itself'],
    log: 'Session log',
    logEmpty: 'nothing happened yet',
    source: { session: 'session', main: 'main', agent: 'agent', advisor: 'advisor' },
    pickerFor: name => `Model for ${name}:`,
    newAgents: 'new sub-agents',
    help: 'ctrl+x tab: pane · Tab, arrows: move · m: model · a: look · 0 to 4: choose · x: close · s: stop · click a type: details · Esc: leave the text field',
    task: 'Task',
    reply: 'Answer',
    loading: 'loading …',
    close: 'close',
    noReply: 'no answer yet',
    noAccess: 'not readable',
    advisorShort: 'advisor',
    contextShort: 'context',
    cost: usd => `$${usd.toFixed(2)}`,
    decimal: '.',
    percent: p => `${p}%`,
    latest: 'Latest',
    stop: 'stop',
    stopping: 'stopping …',
    stopAnswer: n => `Stopped by the user in Agent Tree after ${n} tool ${n === 1 ? 'call' : 'calls'}.`,
    sayPlaceholder: 'Message to this agent … · Esc: back',
    send: 'send',
    correctionFrame: (text, tool) =>
      `Message from the user via Agent Tree: ${text}\n\nIt applies to your task from now on. Take it into account in your remaining work and in your report via ${tool}.`,
    mainNote: (agent, text) =>
      `The user wrote to the sub-agent ${agent} via Agent Tree: "${text}". Its result may differ from the task for that reason.`,
    correctionWaiting: tool => `Before you finish: the user sent you a new message, shown above. Act on it, then call ${tool} again with a report that reflects it.`,
    correctionFailedStatus: 'Agent Tree: correction not delivered',
    correctionLabel: 'Correction',
    correction: { sent: 'sent', read: 'read', failed: 'not delivered' },
    toolWords: { SubagentHandback: 'answer handed back' },
    subModel: 'Sub-agent model',
    advisorOn: 'turn on',
    advisorOff: 'turn off',
    advisorUnavailable: 'Agent Tree: /advisor is not available in this session',
    look: 'Look',
    lookRow: { style: 'Style', colors: 'Colors', light: 'Glow' },
    lookOption: {
      style: { line: 'Line', pixel: 'Pixel', braille: 'Braille', hud: 'HUD', ascii: 'ASCII' },
      colors: { original: 'Original', light: 'Light', retro: 'Retro', mono: 'Mono' },
      light: { standard: 'Default', white: 'White', gold: 'Gold', cyan: 'Cyan', magenta: 'Magenta' },
    },
    lookReset: 'Reset',
    lookSet: (row, option) => `Agent Tree · ${row}: ${option}`,
    lookUnknown: (name, row, options) => `Agent Tree: ${name ? `"${name}" is not a choice. ` : ''}${row}: ${options}`,
    commandDescription: "The session's agent tree as boxes (stop, clear, style, colors, glow)",
    commandHint: '[stop|clear|style <name>|colors <name>|glow <name>]',
    opened: n => `Agent Tree opened · ${n} ${n === 1 ? 'agent' : 'agents'} so far · /agent-tree stop closes`,
    closedText: 'Agent Tree closed',
    cleared: 'Agent Tree cleared',
    notOpened: reason => `Agent Tree: pane not opened: ${reason}`,
    commandFailed: 'Agent Tree: command failed',
    lines: {
      turn: d => `Round ${d.turn}: ${d.excerpt}`,
      mainDone: d => `Main session ${WORDS.en.mainEnd[d.status as AgentTreeStatus] ?? d.status} after ${fmtDuration(Number(d.durationMs))}`,
      agentStarted: d => `${d.type} started: ${d.description}`,
      workflowStarted: d => `Workflow started: ${d.description}`,
      agentEnded: d =>
        d.status === 'done'
          ? `${d.type} done after ${fmtDuration(Number(d.durationMs))} · ↑ ${fmtTokens(Number(d.tokens), '.')}`
          : `${d.type} ${WORDS.en.status[d.status as AgentTreeStatus] ?? d.status}`,
      workflowDone: d => `Workflow done: ${d.size} agents`,
      resumed: d => `${d.type} resumed: ${d.description}`,
      adopted: d => `${d.count} ${Number(d.count) === 1 ? 'agent' : 'agents'} taken over from the agent list`,
      advisor: d => `consulted from ${d.where ? d.where : 'main session'}`,
      choice: d => `Model for ${d.who ? d.who : 'new sub-agents'}: ${familyOr(d.family, 'Default')}`,
      stopRequested: d => `Stop requested for ${d.type}`,
      correction: d => `Correction to ${d.type}: ${d.text}`,
      correctionFailed: d => `Correction to ${d.type} not delivered${d.text ? `: ${d.text}` : ''}`,
      correctionResent: d => `Correction to ${d.type} sent again`,
    },
  },
}

const LOOK_WORDS = new Map<string, LookRow>([
  ['stil', 'style'],
  ['style', 'style'],
  ['farben', 'colors'],
  ['farbe', 'colors'],
  ['colors', 'colors'],
  ['colours', 'colors'],
  ['licht', 'light'],
  ['light', 'light'],
  ['glow', 'light'],
])

const fold = (text: string) => text.toLowerCase().replaceAll('ß', 'ss')

export function lookOptionLabel(w: Words, row: LookRow, id: string): string {
  return (w.lookOption[row] as Record<string, string>)[id] ?? id
}

export function lookChoice(word: string, name: string): { row: LookRow; id?: string } | undefined {
  const row = LOOK_WORDS.get(word.toLowerCase())
  if (!row) return undefined
  const wanted = fold(name)
  const id = (LOOK_OPTIONS[row] as readonly string[]).find(option =>
    [option, lookOptionLabel(WORDS.de, row, option), lookOptionLabel(WORDS.en, row, option)].some(label => fold(label) === wanted),
  )
  return id ? { row, id } : { row }
}

export function wordsFor(lang: string | undefined): Words {
  return lang === 'en' ? WORDS.en : WORDS.de
}

export function logLine(entry: AgentTreeLogEntry, lang: Lang = 'de'): string {
  const lines = wordsFor(lang).lines as Record<string, (d: Record<string, string | number>) => string>
  const render = entry.kind ? lines[entry.kind] : undefined
  if (render) return render(entry.data ?? {})
  return entry.text ?? ''
}

export function resolveLang(configured: unknown, sessionLanguage: unknown): Lang {
  if (configured === 'de' || configured === 'en') return configured
  return typeof sessionLanguage === 'string' && /^\s*(de|german|deutsch)/i.test(sessionLanguage) ? 'de' : 'en'
}

export function toolText(label: string | undefined, lang: Lang = 'de'): string | undefined {
  if (label === undefined) return undefined
  return wordsFor(lang).toolWords[label] ?? label
}
