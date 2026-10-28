// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import type { Elements } from 'claude-code'

import { introFrame, partColor } from './intro-model.ts'
import type { IntroLook } from './intro-model.ts'

type IntroUi = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export function drawIntro(ui: IntroUi, width: number, height: number | undefined, ms: number, look: IntroLook, onSkip: () => void) {
  const { Box, Text, Button } = ui
  const frame = introFrame(width, height, ms, look)
  if (!frame) return undefined
  return (
    <Box key="intro" flexDirection="column" width={width}>
      {frame.rows.map((runs, i) => (
        <Button key={`intro:skip:${i}`} plain onPress={onSkip}>
          {runs.map((run, j) =>
            run.part ? (
              <Text key={`intro-run:${i}:${j}`} color={partColor(run.part, look)}>
                {run.text}
              </Text>
            ) : (
              run.text
            ),
          )}
        </Button>
      ))}
      <Text key="intro-gap"> </Text>
      <Text key="intro-title" bold color={look.palette.main}>
        {frame.title || ' '}
      </Text>
      {frame.lines.map((line, i) => (
        <Text key={`intro-line:${i}`} color={look.palette.dim}>
          {line || ' '}
        </Text>
      ))}
    </Box>
  )
}
