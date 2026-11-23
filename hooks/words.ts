// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { AgentTreeCorrectionState, AgentTreeLogEntry, AgentTreeLogSource, AgentTreePhase, AgentTreeStatus, AgentTreeTab } from '../types'
import type { LookRow } from './looks.ts'
import { DEFAULT_LOOK, LOOK_OPTIONS } from './looks.ts'
import { effortLabel, familyLabel, fmtDuration, fmtTokens, toolKind } from './model.ts'

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
  usageEffort: string
  usageTokens: string
  quiet: (time: string) => string
  localName: string
  localCalls: (n: number) => string
  localFails: (n: number) => string
  localHint: string
  localOff: string
  localNoPrompt: string
  localFailed: (url: string, status: number | undefined, reason?: string) => string
  limitRest: (time: string) => string
  minutes: (n: number) => string
  hoursMinutes: (h: number, m: number) => string
  usageSummary: string
  usageTotal: string
  usageAgents: (n: number) => string
  peerHere: string
  peerOthers: string
  peerNone: string
  peerClashTitle: string
  peerNotesTitle: string
  peerTake: string
  peerAgents: (n: number) => string
  peerDirty: (n: number) => string
  peerAgo: (time: string) => string
  peerClashLine: (name: string, folder: string) => string
  peerClashToast: (name: string, folder: string) => string
  peerNoteToast: (folder: string, name: string) => string
  peerNotesToast: (folder: string, count: number) => string
  peerNotePrompt: (folder: string, path: string) => string
  peerNoteFilled: string
  notAsked: string
  writes: [string, string]
  log: string
  logEmpty: string
  source: Record<AgentTreeLogSource, string>
  pickerFor: (name: string) => string
  effortFor: string
  mainEffortFor: string
  mainEffortHint: readonly string[]
  mainModelFor: string
  mainModelHint: string
  mainModelUnavailable: string
  effortNextMessage: string
  newAgents: string
  help: readonly string[]
  tips: readonly string[]
  tabs: Record<AgentTreeTab, string>
  fullReport: string
  helpKeys: string
  helpFast: string
  helpSize: string
  helpSizeLines: readonly string[]
  helpGlyphs: string
  helpCommands: string
  helpGuide: string
  quoted: (text: string) => string
  helpVersion: string
  helpCodeMode: string
  guideUrl: string
  filesNone: string
  filesClash: string
  logAll: string
  logOrder: string
  logEntries: (count: number) => string
  logQuestionSize: (count: number) => string
  logHint: string
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
  stopping: string
  stopAnswer: (tools: number) => string
  writeWord: string
  writeHint: (label: string) => string
  writeSent: (label: string) => string
  writeFailed: (label: string) => string
  writeUnknown: (id: string) => string
  writeEmpty: (label: string) => string
  writeNoPrompt: string
  savedChoice: (label: string) => string
  savedMainEffort: (label: string) => string
  limitKind: (kind: string) => string
  limitReset: (time: string) => string
  locale: string
  introModel: (model: string) => string
  introAdvisor: (advisor: string) => string
  introSubAgents: (choice: string) => string
  introLimits: (limits: string) => string
  introPlaying: string
  introSkip: string
  noticeUpdated: string
  noticeContinue: string
  correctionFrame: (text: string, tool: string) => string
  correctionFrameCode: (text: string) => string
  codeModeTag: string
  mainNote: (agent: string, text: string) => string
  mainNoteLost: (agent: string) => string
  correctionWaiting: (tool: string) => string
  correctionFailedStatus: string
  correctionLabel: string
  correction: Record<AgentTreeCorrectionState, string>
  toolWords: Record<string, string>
  activity: {
    read: (x: string) => string
    change: (x: string) => string
    search: (x: string) => string
    searchCode: string
    run: (x: string) => string
    web: (x: string) => string
    webSearch: string
    agent: string
  }
  actionHint: string
  stopButton: string
  writeButton: string
  detailsButton: string
  readFiles: string
  changedFiles: string
  alsoChanges: (file: string, other: string) => string
  changedFirst: (file: string, other: string) => string
  feedback: {
    modelPending: (x: string) => string
    modelDone: (x: string) => string
    effortPending: (x: string) => string
    effortDone: (x: string) => string
    mainEffortPending: (x: string) => string
    writePending: string
    writeDone: string
    writeFailed: string
    stopPending: string
    stopDone: string
  }
  subModel: string
  advisorOn: string
  advisorOff: string
  advisorUnavailable: string
  advisorUnchanged: string
  fastOn: string
  fastOff: string
  fastUnavailable: string
  fastUnchanged: string
  starHint: string
  starAsk: string
  starUrl: string
  starAskOff: string
  updateInstalled: (version: string) => string
  updateFailed: (version: string, command: string) => string
  look: string
  lookRow: Record<LookRow, string>
  lookOption: { [R in LookRow]: Record<(typeof LOOK_OPTIONS)[R][number], string> }
  lookReset: string
  lookSet: (row: string, option: string) => string
  lookUnknown: (name: string, row: string, options: string) => string
  commandDescription: string
  commandHint: string
  commandUnknown: (arg: string) => string
  lookResetDone: string
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
    effort: (d: Record<string, string | number>) => string
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
    more: (n, r) => `+${n} ${n === 1 ? 'weiterer' : 'weitere'}${r > 0 ? `, ${r} davon ${r === 1 ? 'läuft' : 'laufen'}` : ' beendet'}`,
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
    usageEffort: 'Stufe',
    usageTokens: 'Tokens',
    quiet: time => `still seit ${time}`,
    localName: 'Lokales Modell',
    localCalls: n => (n === 1 ? '1 Aufruf' : `${n} Aufrufe`),
    localFails: n => (n === 1 ? '1 Fehler' : `${n} Fehler`),
    localHint: 'Lokales Modell aus: in den Plugin-Optionen ein Modell eintragen (Ollama, LM Studio), dann gibt Claude Code ihm einfache Aufgaben',
    localOff: 'Das lokale Modell ist in dieser Sitzung nicht eingeschaltet.',
    localNoPrompt: 'Der Aufruf braucht einen Text im Feld prompt.',
    localFailed: (url, status, reason) => `Das lokale Modell unter ${url} hat nicht geantwortet${status ? ` (HTTP ${status}${reason ? `: ${reason}` : ''})` : ' (Server nicht erreichbar)'}. Erledige die Aufgabe selbst.`,
    limitRest: time => `bei diesem Tempo voll in ~${time}`,
    minutes: n => `${n} min`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    usageSummary: 'Auswertung',
    usageTotal: 'Zusammen',
    usageAgents: n => (n === 1 ? '1 Agent' : `${n} Agenten`),
    peerHere: 'Dieses Terminal',
    peerOthers: 'Andere Terminals',
    peerNone: 'kein anderes Terminal mit Agent Tree offen',
    peerClashTitle: 'Gleiche Datei in zwei Terminals',
    peerNotesTitle: 'Markdown in anderen Terminals geändert',
    peerTake: 'Hier prüfen',
    peerAgents: n => (n === 1 ? '1 Agent läuft' : `${n} Agenten laufen`),
    peerDirty: n => (n === 1 ? '1 Änderung offen' : `${n} Änderungen offen`),
    peerAgo: time => `vor ${time}`,
    peerClashLine: (name, folder) => `${name} · hier und in ${folder}`,
    peerClashToast: (name, folder) => `⚠ ${name} wurde auch im Terminal ${folder} geändert`,
    peerNoteToast: (folder, name) => `Terminal ${folder} hat ${name} geändert, siehe Reiter Fenster`,
    peerNotesToast: (folder, count) => `Terminal ${folder} hat ${count} Markdown-Dateien geändert, siehe Reiter Fenster`,
    peerNotePrompt: (folder, path) => `Im Terminal ${folder} wurde ${path} geändert. Lies die Änderung und prüfe, ob sie auch die Markdown-Dateien dieses Projekts betrifft. Frag mich, bevor du etwas einträgst.`,
    peerNoteFilled: 'Die Frage steht in der Eingabe, Enter schickt sie ab',
    notAsked: 'noch nie gefragt',
    writes: ['schreibt nie', 'selbst Code'],
    log: 'Sitzungsprotokoll',
    logEmpty: 'noch nichts geschehen',
    source: { session: 'sitzung', main: 'haupt', agent: 'agent', advisor: 'berater' },
    pickerFor: name => `Modell für ${name}:`,
    effortFor: 'Denkstufe:',
    mainEffortFor: 'Denkstufe der Hauptsitzung:',
    mainEffortHint: ['ab deiner nächsten Nachricht ·', 'Standard = Einstellung von Claude Code ·', 'bleibt für neue Sitzungen'],
    mainModelFor: 'Modell der Hauptsitzung:',
    mainModelHint: 'Modell: wie /model, gilt auch für neue Sitzungen',
    mainModelUnavailable: 'Agent Tree: /model ist in dieser Sitzung nicht verfügbar',
    effortNextMessage: 'gilt, sobald es eine neue Nachricht bekommt (nur Modelle mit Denkstufe)',
    newAgents: 'neue Unteragenten',
    help: ['ctrl+x tab: Leiste', 'Kasten: wählen', 's: stoppen', 'e: Denkstufe', 'm: Modell', 'a: Aussehen', 'Tab: wandern'],
    tips: [
      'Tipp: Im Verlauf › anklicken: deine Frage oder der Bericht',
      'Tipp: Kasten anklicken: stoppen, schreiben, Modell, Denkstufe',
      'Tipp: Überschrift der Hauptsitzung anklicken: Modell wechseln',
      'Tipp: Reiter Berichte zeigt die ganze Antwort jedes Agenten',
      'Tipp: a öffnet das Aussehen: fünf Stile, vier Farbschemata',
      'Tipp: Reiter ? zeigt alle Tasten',
    ],
    tabs: { tree: 'Baum', reports: 'Berichte', files: 'Dateien', log: 'Verlauf', usage: 'Kosten', terminals: 'Fenster', help: '?' },
    fullReport: 'ganzer Bericht ›',
    helpKeys: 'Tasten',
    helpFast: 'f: Fast Mode',
    helpSize: 'Größe',
    helpSizeLines: ['Linke Kante der Leiste mit der Maus ziehen: breiter oder schmaler.', 'Die Breite bleibt für neue Sitzungen.'],
    helpGlyphs: 'Zeichen',
    helpCommands: 'Befehle',
    helpGuide: 'Anleitung',
    quoted: text => `„${text}“`,
    helpVersion: 'Zuletzt neu, Stand',
    helpCodeMode: '„CODE MODE“ im Titel: die Sitzung läuft im Code Mode.',
    guideUrl: 'https://github.com/MikeGT4/agent-tree/tree/main/docs',
    filesNone: 'noch keine Dateien',
    filesClash: 'Gleiche Datei',
    logAll: 'alle',
    logOrder: 'neueste zuerst',
    logEntries: count => (count === 1 ? '1 Eintrag' : `${count} Einträge`),
    logQuestionSize: count => `… · ${count} Zeichen`,
    logHint: 'Zeile mit › anklicken: deine Frage oder den Bericht zeigen',
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
    stopping: 'hält an …',
    stopAnswer: n => `Im Agent Tree vom Nutzer gestoppt, nach ${n} ${n === 1 ? 'Werkzeugaufruf' : 'Werkzeugaufrufen'}.`,
    writeWord: 'an',
    writeHint: label => `Agent Tree: Nachricht an ${label} eintippen, Enter schickt sie`,
    writeSent: label => `Nachricht an ${label} geschickt`,
    writeFailed: label => `Nachricht an ${label} nicht zugestellt`,
    writeUnknown: id => `Kein Agent mit der Kennung ${id} in der Leiste`,
    writeEmpty: label => `Text fehlt: /agent-tree an <Kennung> <Text> schickt ihn an ${label}`,
    writeNoPrompt: 'Agent Tree: die Eingabe ist gerade belegt, ein Dialog ist offen',
    savedChoice: label => `Agent Tree: gespeicherte Wahl für Unteragenten: ${label} (m in der Leiste ändert sie)`,
    savedMainEffort: label => `Agent Tree: gespeicherte Denkstufe der Hauptsitzung: ${label} (e in der Leiste ändert sie)`,
    limitKind: kind => (kind === 'five_hour' ? '5 h' : kind === 'seven_day' ? 'Woche' : kind === 'spend_limit' ? 'Budget' : kind),
    limitReset: time => `bis ${time}`,
    locale: 'de-DE',
    introModel: model => `Modell ${model}`,
    introAdvisor: advisor => `Berater ${advisor}`,
    introSubAgents: choice => `Unteragenten ${choice}`,
    introLimits: limits => `Limits ${limits}`,
    introPlaying: 'Intro läuft',
    introSkip: 'überspringen',
    noticeUpdated: 'wurde aktualisiert',
    noticeContinue: 'weiter',
    correctionFrame: (text, tool) =>
      `Nachricht des Nutzers über Agent Tree: ${text}\n\nSie gilt ab jetzt für deinen Auftrag. Berücksichtige sie bei der weiteren Arbeit und in deinem Bericht über ${tool}.`,
    correctionFrameCode: text =>
      `Nachricht des Nutzers über Agent Tree: ${text}\n\nSie gilt ab jetzt für deinen Auftrag. Berücksichtige sie bei der weiteren Arbeit und in deinem Abschlussbericht.`,
    codeModeTag: 'CODE MODE',
    mainNote: (agent, text) =>
      `Der Nutzer hat dem Unteragenten ${agent} über Agent Tree geschrieben: „${text}“. Sein Ergebnis kann deshalb vom Auftrag abweichen.`,
    mainNoteLost: agent => `Hinweis: Die Nachricht des Nutzers an ${agent} ist nicht mehr angekommen; sein Ergebnis berücksichtigt sie nicht.`,
    correctionWaiting: tool =>
      `Bevor du abschließt: Der Nutzer hat dir eine neue Nachricht geschrieben. Siehst du sie noch nicht, wird sie dir jetzt zugestellt. Setz sie um und ruf danach ${tool} erneut auf, mit einem Bericht, der sie berücksichtigt.`,
    correctionFailedStatus: 'Agent Tree: Korrektur nicht zugestellt',
    correctionLabel: 'Korrektur',
    correction: { sent: 'geschickt', read: 'gelesen', failed: 'nicht zugestellt' },
    toolWords: { SubagentHandback: 'Antwort übergeben', REPL: 'führt Code aus' },
    activity: {
      read: x => `liest ${x}`,
      change: x => `ändert ${x}`,
      search: x => `sucht ${x}`,
      searchCode: 'sucht im Code',
      run: x => `führt ${x} aus`,
      web: x => `liest im Netz ${x}`,
      webSearch: 'sucht im Netz',
      agent: 'startet einen Agenten',
    },
    actionHint: 'Kasten anklicken: stoppen, schreiben, Modell, Denkstufe',
    stopButton: 'Stoppen',
    writeButton: 'Schreiben',
    detailsButton: 'Details',
    readFiles: 'Gelesen',
    changedFiles: 'Geändert',
    alsoChanges: (file, other) => `⚠ ${other} ändert ${file} auch`,
    changedFirst: (file, other) => `Agent Tree: ${other} hat ${file} in diesem Lauf schon geändert. Lies die Datei neu ein und nimm deine Änderung dann vor.`,
    feedback: {
      modelPending: x => `✓ Modell auf ${x} gestellt, gilt ab seinem nächsten Schritt`,
      modelDone: x => `✓ läuft jetzt mit ${x}`,
      effortPending: x => `✓ Denkstufe ${x} gewählt, wirkt ab seiner nächsten Nachricht`,
      effortDone: x => `✓ arbeitet jetzt mit Denkstufe ${x}`,
      mainEffortPending: x => `✓ Denkstufe ${x} gewählt, wirkt ab deiner nächsten Nachricht`,
      writePending: '✎ Nachricht angekommen',
      writeDone: '✎ Nachricht gelesen',
      writeFailed: '✎ Nachricht nicht angekommen',
      stopPending: '■ Agent wird gestoppt',
      stopDone: '■ gestoppt',
    },
    subModel: 'Unteragenten-Modell',
    advisorOn: 'einschalten',
    advisorOff: 'ausschalten',
    advisorUnavailable: 'Agent Tree: /advisor ist in dieser Sitzung nicht verfügbar',
    advisorUnchanged: 'Agent Tree: Claude Code hat den Berater nicht umgestellt, der Grund steht im Chat',
    fastOn: '↯ Fast Mode: an',
    fastOff: '↯ Fast Mode: aus',
    fastUnavailable: 'Agent Tree: /fast ist in dieser Sitzung nicht verfügbar',
    fastUnchanged: 'Agent Tree: Claude Code hat den Fast Mode nicht umgestellt, der Grund steht im Chat',
    starHint: 'Gefällt dir Agent Tree? Ein Stern auf GitHub hilft: https://github.com/MikeGT4/agent-tree',
    starAsk: '★ Bist du zufrieden mit Agent Tree? Dann freue ich mich über einen Stern auf GitHub:',
    starAskOff: 'Nicht mehr zeigen',
    starUrl: 'https://github.com/MikeGT4/agent-tree',
    updateInstalled: version => `Agent Tree ${version} ist installiert und lädt beim nächsten Start`,
    updateFailed: (version, command) => `Agent Tree ${version} ist da, aktualisieren mit: ${command}`,
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
    commandDescription: 'Agentenbaum der Sitzung als Kästen (an, stop, clear, intro, stil, farben, licht)',
    commandHint: '[an <Kennung> <Text>|stop|clear|intro|stil <name>|farben <name>|licht <name>|aussehen zurück]',
    commandUnknown: arg => `Agent Tree: „${arg}“ gibt es nicht. Möglich: an <Kennung> <Text>, stop, clear, intro, stil <Name>, farben <Name>, licht <Name>, aussehen zurück`,
    lookResetDone: 'Agent Tree · Aussehen zurück auf Standard',
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
      workflowDone: d => `Workflow fertig: ${d.size} ${Number(d.size) === 1 ? 'Agent' : 'Agenten'}`,
      resumed: d => `${d.type} fortgesetzt: ${d.description}`,
      adopted: d => `${d.count} ${Number(d.count) === 1 ? 'Agent' : 'Agenten'} aus der Agentenliste übernommen`,
      advisor: d => `gefragt aus ${d.where ? d.where : 'Hauptsitzung'}`,
      choice: d => `Modell für ${d.who ? d.who : 'neue Unteragenten'}: ${familyOr(d.family, 'Standard')}`,
      effort: d =>
        `${d.main ? 'Denkstufe der Hauptsitzung' : `Denkstufe für ${d.who ? d.who : 'neue Unteragenten'}`}: ${d.effort ? effortLabel(String(d.effort)) : 'Standard'}`,
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
    usageEffort: 'Effort',
    usageTokens: 'Tokens',
    quiet: time => `quiet for ${time}`,
    localName: 'Local model',
    localCalls: n => (n === 1 ? '1 call' : `${n} calls`),
    localFails: n => (n === 1 ? '1 failure' : `${n} failures`),
    localHint: 'Local model off: enter a model in the plugin options (Ollama, LM Studio) and Claude Code hands it simple tasks',
    localOff: 'The local model is not turned on in this session.',
    localNoPrompt: 'The call needs text in the prompt field.',
    localFailed: (url, status, reason) => `The local model at ${url} did not answer${status ? ` (HTTP ${status}${reason ? `: ${reason}` : ''})` : ' (server not reachable)'}. Do the task yourself.`,
    limitRest: time => `full in ~${time} at this pace`,
    minutes: n => `${n} min`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    usageSummary: 'Summary',
    usageTotal: 'Total',
    usageAgents: n => (n === 1 ? '1 agent' : `${n} agents`),
    peerHere: 'This terminal',
    peerOthers: 'Other terminals',
    peerNone: 'no other terminal with Agent Tree open',
    peerClashTitle: 'Same file in two terminals',
    peerNotesTitle: 'Markdown changed in other terminals',
    peerTake: 'Check here',
    peerAgents: n => (n === 1 ? '1 agent running' : `${n} agents running`),
    peerDirty: n => (n === 1 ? '1 uncommitted change' : `${n} uncommitted changes`),
    peerAgo: time => `${time} ago`,
    peerClashLine: (name, folder) => `${name} · here and in ${folder}`,
    peerClashToast: (name, folder) => `⚠ ${name} was also changed in the terminal ${folder}`,
    peerNoteToast: (folder, name) => `The terminal ${folder} changed ${name}, see the Terminals tab`,
    peerNotesToast: (folder, count) => `The terminal ${folder} changed ${count} Markdown files, see the Terminals tab`,
    peerNotePrompt: (folder, path) => `In the terminal ${folder}, ${path} was changed. Read the change and check whether it also concerns the Markdown files of this project. Ask me before you write anything.`,
    peerNoteFilled: 'The question is in your prompt, Enter sends it',
    notAsked: 'not asked yet',
    writes: ['never writes', 'code itself'],
    log: 'Session log',
    logEmpty: 'nothing happened yet',
    source: { session: 'session', main: 'main', agent: 'agent', advisor: 'advisor' },
    pickerFor: name => `Model for ${name}:`,
    effortFor: 'Effort:',
    mainEffortFor: 'Main session effort:',
    mainEffortHint: ['from your next message ·', "Default = Claude Code's setting ·", 'kept for new sessions'],
    mainModelFor: 'Main session model:',
    mainModelHint: 'Model: like /model, also saved for new sessions',
    mainModelUnavailable: 'Agent Tree: /model is not available in this session',
    effortNextMessage: 'applies once it gets a new message (models with effort only)',
    newAgents: 'new sub-agents',
    help: ['ctrl+x tab: pane', 'box: select', 's: stop', 'e: effort', 'm: model', 'a: look', 'Tab: move'],
    tips: [
      'Tip: in the Log, click › for your prompt or the report',
      'Tip: click a box to stop, write, switch model or effort',
      'Tip: click the main session title to switch its model',
      'Tip: the Reports tab shows each agent’s full answer',
      'Tip: a opens the look: five styles, four color schemes',
      'Tip: the ? tab lists every key',
    ],
    tabs: { tree: 'Tree', reports: 'Reports', files: 'Files', log: 'Log', usage: 'Cost', terminals: 'Terminals', help: '?' },
    fullReport: 'full report ›',
    helpKeys: 'Keys',
    helpFast: 'f: fast mode',
    helpSize: 'Size',
    helpSizeLines: ['Drag the left edge of the pane with the mouse: wider or narrower.', 'The width is kept for new sessions.'],
    helpGlyphs: 'Signs',
    helpCommands: 'Commands',
    helpGuide: 'Guide',
    quoted: text => `"${text}"`,
    helpVersion: 'Recent, as of',
    helpCodeMode: '"CODE MODE" in the title: the session runs in Code Mode.',
    guideUrl: 'https://github.com/MikeGT4/agent-tree/tree/main/docs',
    filesNone: 'no files yet',
    filesClash: 'Same file',
    logAll: 'all',
    logOrder: 'newest first',
    logEntries: count => (count === 1 ? '1 entry' : `${count} entries`),
    logQuestionSize: count => `… · ${count} characters`,
    logHint: 'Click a row with ›: show your prompt or the report',
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
    stopping: 'stopping …',
    stopAnswer: n => `Stopped by the user in Agent Tree after ${n} tool ${n === 1 ? 'call' : 'calls'}.`,
    writeWord: 'to',
    writeHint: label => `Agent Tree: type the message to ${label}, Enter sends it`,
    writeSent: label => `Message sent to ${label}`,
    writeFailed: label => `Message to ${label} not delivered`,
    writeUnknown: id => `No agent ${id} in the pane`,
    writeEmpty: label => `Text missing: /agent-tree to <id> <text> sends it to ${label}`,
    writeNoPrompt: 'Agent Tree: the prompt is busy, a dialog is open',
    savedChoice: label => `Agent Tree: saved sub-agent choice: ${label} (m in the pane changes it)`,
    savedMainEffort: label => `Agent Tree: saved main session effort: ${label} (e in the pane changes it)`,
    limitKind: kind => (kind === 'five_hour' ? '5h' : kind === 'seven_day' ? 'week' : kind === 'spend_limit' ? 'spend' : kind),
    limitReset: time => `resets ${time}`,
    locale: 'en-US',
    introModel: model => `model ${model}`,
    introAdvisor: advisor => `advisor ${advisor}`,
    introSubAgents: choice => `sub-agents ${choice}`,
    introLimits: limits => `limits ${limits}`,
    introPlaying: 'Intro playing',
    introSkip: 'skip',
    noticeUpdated: 'was updated',
    noticeContinue: 'continue',
    correctionFrame: (text, tool) =>
      `Message from the user via Agent Tree: ${text}\n\nIt applies to your task from now on. Take it into account in your remaining work and in your report via ${tool}.`,
    correctionFrameCode: text =>
      `Message from the user via Agent Tree: ${text}\n\nIt applies to your task from now on. Take it into account in your remaining work and in your final report.`,
    codeModeTag: 'CODE MODE',
    mainNote: (agent, text) =>
      `The user wrote to the sub-agent ${agent} via Agent Tree: "${text}". Its result may differ from the task for that reason.`,
    mainNoteLost: agent => `Note: the user's message to ${agent} did not arrive; its result does not reflect it.`,
    correctionWaiting: tool => `Before you finish: the user sent you a new message. If you do not see it yet, it is delivered to you now. Act on it, then call ${tool} again with a report that reflects it.`,
    correctionFailedStatus: 'Agent Tree: correction not delivered',
    correctionLabel: 'Correction',
    correction: { sent: 'sent', read: 'read', failed: 'not delivered' },
    toolWords: { SubagentHandback: 'answer handed back', REPL: 'runs code' },
    activity: {
      read: x => `reads ${x}`,
      change: x => `edits ${x}`,
      search: x => `searches ${x}`,
      searchCode: 'searches the code',
      run: x => `runs ${x}`,
      web: x => `browses ${x}`,
      webSearch: 'searches the web',
      agent: 'starts an agent',
    },
    actionHint: 'Click a box: stop, write, model, effort',
    stopButton: 'Stop',
    writeButton: 'Write',
    detailsButton: 'Details',
    readFiles: 'Read',
    changedFiles: 'Changed',
    alsoChanges: (file, other) => `⚠ ${other} edits ${file} too`,
    changedFirst: (file, other) => `Agent Tree: ${other} already changed ${file} during this run. Read the file again, then make your change.`,
    feedback: {
      modelPending: x => `✓ Model set to ${x}, applies from its next step`,
      modelDone: x => `✓ now running on ${x}`,
      effortPending: x => `✓ Effort ${x} chosen, applies from its next message`,
      effortDone: x => `✓ now working at effort ${x}`,
      mainEffortPending: x => `✓ Effort ${x} chosen, applies from your next message`,
      writePending: '✎ Message delivered',
      writeDone: '✎ Message read',
      writeFailed: '✎ Message not delivered',
      stopPending: '■ Stopping agent',
      stopDone: '■ Stopped',
    },
    subModel: 'Sub-agent model',
    advisorOn: 'turn on',
    advisorOff: 'turn off',
    advisorUnavailable: 'Agent Tree: /advisor is not available in this session',
    advisorUnchanged: 'Agent Tree: Claude Code did not switch the advisor, the transcript says why',
    fastOn: '↯ Fast mode: on',
    fastOff: '↯ Fast mode: off',
    fastUnavailable: 'Agent Tree: /fast is not available in this session',
    fastUnchanged: 'Agent Tree: Claude Code did not switch fast mode, the transcript says why',
    starHint: 'Like Agent Tree? A star on GitHub helps: https://github.com/MikeGT4/agent-tree',
    starAsk: '★ Happy with Agent Tree? A star on GitHub would make my day:',
    starAskOff: 'Do not show again',
    starUrl: 'https://github.com/MikeGT4/agent-tree',
    updateInstalled: version => `Agent Tree ${version} is installed and loads at the next start`,
    updateFailed: (version, command) => `Agent Tree ${version} is out, update with: ${command}`,
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
    commandDescription: "The session's agent tree as boxes (to, stop, clear, intro, style, colors, glow)",
    commandHint: '[to <id> <text>|stop|clear|intro|style <name>|colors <name>|glow <name>|look reset]',
    commandUnknown: arg => `Agent Tree: "${arg}" is not a command. Try: to <id> <text>, stop, clear, intro, style <name>, colors <name>, glow <name>, look reset`,
    lookResetDone: 'Agent Tree · look back to default',
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
      workflowDone: d => `Workflow done: ${d.size} ${Number(d.size) === 1 ? 'agent' : 'agents'}`,
      resumed: d => `${d.type} resumed: ${d.description}`,
      adopted: d => `${d.count} ${Number(d.count) === 1 ? 'agent' : 'agents'} taken over from the agent list`,
      advisor: d => `consulted from ${d.where ? d.where : 'main session'}`,
      choice: d => `Model for ${d.who ? d.who : 'new sub-agents'}: ${familyOr(d.family, 'Default')}`,
      effort: d =>
        `${d.main ? 'Main session effort' : `Effort for ${d.who ? d.who : 'new sub-agents'}`}: ${d.effort ? effortLabel(String(d.effort)) : 'Default'}`,
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
  if (wanted === 'standard' || wanted === 'default') return { row, id: DEFAULT_LOOK[row] }
  const id = (LOOK_OPTIONS[row] as readonly string[]).find(option =>
    [option, lookOptionLabel(WORDS.de, row, option), lookOptionLabel(WORDS.en, row, option)].some(label => fold(label) === wanted),
  )
  return id ? { row, id } : { row }
}

export function helpItems(w: Words, fast: boolean): readonly string[] {
  return fast ? [...w.help.slice(0, -1), w.helpFast, ...w.help.slice(-1)] : w.help
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

export function activityText(label: string | undefined, lang: Lang = 'de'): string | undefined {
  if (label === undefined) return undefined
  const space = label.indexOf(' ')
  const tool = space < 0 ? label : label.slice(0, space)
  const detail = space < 0 ? '' : label.slice(space + 1)
  const words = wordsFor(lang).activity
  const kind = toolKind(tool)
  if (kind === 'read' && detail) return words.read(detail)
  if (kind === 'change' && detail) return words.change(detail)
  if (kind === 'search') return detail ? words.search(detail) : words.searchCode
  if (kind === 'run' && detail) return detail.includes(' ') ? detail : words.run(detail)
  if (kind === 'web') return detail ? words.web(detail) : words.webSearch
  if (kind === 'agent') return words.agent
  return toolText(label, lang)
}
