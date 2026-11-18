# Agent Tree guide

Agent Tree shows your Claude Code agents as a live tree beside the chat, with a lever for each.

## What you see

![Tree](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-1.png)

Main session: model, effort, context, cost.

One box per sub-agent: task, current step, context (yellow from 70%, red from 85%).

⚠: two running agents change one file.

## What you can do

![Actions](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-2.png)

Click a box, or ctrl+x tab, Tab, Enter: Stop (s), Write, Model, Effort, Details.

Write fills your prompt, read at the agent's next step.

e: main session effort, m: new sub-agents, a: look.

## Tabs

![Reports](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-3.png)

Reports: each agent's task and full answer.

![Files](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-4.png)

Files: changed and read per agent, shared first. Read files show estimated tokens (~), heaviest first.

![Usage](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-5.png)

Usage: limits, context, tools, time.

![Log](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-6.png)

Log: every event, by source.

![Help](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.2/guide-7.png)

Help: keys, signs, commands.

## Code Mode

When Claude Code runs in Code Mode, the title shows "CODE MODE". Each code block an agent runs counts as a step ("runs code"), and the calls inside it appear one by one. Stop: the running call finishes, and every further call from the agent's code is refused, even if the code outlives the agent. Write: the message reaches the running agent. If it ends before reading it, the message stays "sent"; after a stop it counts as "not delivered".

## After an update

When Agent Tree starts in a new version for the first time, a card shows in the pane for 3 seconds: the old and new version number and what is new. Click "continue" or type to close it earlier. A first install shows no card.

## What it gives you

Stop one agent, not the whole session.

Move a running agent to a cheaper model.
