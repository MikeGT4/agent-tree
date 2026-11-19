// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { Elements } from 'claude-code'

import { LOGO_COLORS, LOGO_TITLE } from './logo.ts'
import type { Palette } from './looks.ts'
import type { UpdateNotice } from './news.ts'
import type { Words } from './words.ts'

type NoticeUi = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export const NOTICE_GROW_MS = 450
const CARD_MAX = 46

export function arrowLength(span: number, ms: number, animate: boolean): number {
  if (!animate) return span
  const t = Math.min(1, Math.max(0, ms / NOTICE_GROW_MS))
  return Math.max(1, Math.round(span * (1 - (1 - t) ** 3)))
}

export function drawNotice(
  ui: NoticeUi,
  width: number,
  shown: UpdateNotice,
  ms: number,
  look: { palette: Palette; animate: boolean; words: Words },
  onSkip: () => void,
) {
  const { Box, Text, Button } = ui
  const { palette, words } = look
  const card = Math.max(24, Math.min(CARD_MAX, width - 4))
  const inner = card - 4
  const from = shown.from ?? ''
  const span = Math.max(4, inner - from.length - shown.to.length - 4)
  const drawn = arrowLength(span, ms, look.animate)
  const done = drawn >= span
  return (
    <Box key="notice" flexDirection="column" alignItems="center" width={width} paddingTop={1}>
      <Box key="notice-card" flexDirection="column" width={card} borderStyle="round" borderColor={LOGO_TITLE} paddingX={1}>
        <Box key="notice-title" justifyContent="center">
          <Text bold color={LOGO_TITLE}>{`AGENT TREE ${shown.to}`}</Text>
        </Box>
        <Box key="notice-sub" justifyContent="center">
          <Text color={palette.dim}>{words.noticeUpdated}</Text>
        </Box>
        {from ? <Text key="notice-gap-1"> </Text> : null}
        {from ? <Box key="notice-jump" justifyContent="center">
          <Text>
            <Text color={palette.dim}>{`${from} `}</Text>
            <Text color={LOGO_COLORS.B}>{'━'.repeat(drawn)}</Text>
            <Text color={done ? LOGO_COLORS.N : LOGO_COLORS.B}>{'▶'}</Text>
            <Text color={palette.dim}>{' '.repeat(span - drawn)}</Text>
            <Text bold color={done ? LOGO_COLORS.N : palette.dim}>{` ${shown.to}`}</Text>
          </Text>
        </Box> : null}
        {shown.lines.length ? <Text key="notice-gap-2"> </Text> : null}
        {shown.lines.map((line, i) => (
          <Box key={`notice-line:${i}`} flexDirection="row">
            <Text color={LOGO_COLORS.N}>{'▪ '}</Text>
            <Text>{line}</Text>
          </Box>
        ))}
        <Text key="notice-gap-3"> </Text>
        <Box key="notice-skip-row" justifyContent="center">
          <Button key="notice:skip" plain dimColor label={words.noticeContinue} onPress={onSkip} />
        </Box>
      </Box>
    </Box>
  )
}
