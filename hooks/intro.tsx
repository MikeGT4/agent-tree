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
        <Box key={`intro-row:${i}`}>
          <Text>
            {runs.map((run, j) =>
              run.part ? (
                <Text key={`intro-run:${i}:${j}`} color={partColor(run.part, look)}>
                  {run.text}
                </Text>
              ) : (
                run.text
              ),
            )}
          </Text>
        </Box>
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
      <Box key="intro-skip-row" flexDirection="row" justifyContent="center" width={width}>
        <Button key="intro:skip" plain dimColor label={frame.skip} onPress={onSkip} />
      </Box>
    </Box>
  )
}
