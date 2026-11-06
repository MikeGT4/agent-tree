# Agent Tree guide

Agent Tree shows your Claude Code agents as a live tree beside the chat, with a lever for each.

## What you see

![Tree](https://github.com/MikeGT4/agent-tree/releases/download/v0.6.0/guide-1.png)

Main session: model, effort, context, cost.

One box per sub-agent: its task, what it does right now and how full its context is, yellow from 70 %, red from 85 %.

![Boxes](https://github.com/MikeGT4/agent-tree/releases/download/v0.6.0/guide-2.png)

⚠: two running agents change the same file.

## What you can do

![Action bar](https://github.com/MikeGT4/agent-tree/releases/download/v0.6.0/guide-3.png)

Click a box, or ctrl+x tab, Tab, Enter: Stop (s), Write, Model, Effort, Details.

Write fills your prompt, the agent reads it at its next step, and every action answers in the bar.

![Choice](https://github.com/MikeGT4/agent-tree/releases/download/v0.6.0/guide-4.png)

e: main session effort · m: new sub-agents · a: look.

## What it gives you

![Details](https://github.com/MikeGT4/agent-tree/releases/download/v0.6.0/guide-5.png)

Stop one agent instead of the whole session.

Move a running agent to a cheaper model.

Details: files read and changed, last message.
