# Local model

[Deutsch](LOCAL.de.md)

Agent Tree can hand simple tasks to a model on your computer, so Claude Code spends fewer tokens.

## Set it up

1. Install Ollama (ollama.com) or LM Studio (lmstudio.ai).
2. Load a small model, for example `ollama pull qwen2.5:3b`.
3. In the pane, click "Set up a local model", pick the model and choose its mode.

"Set it up for me" puts these steps into your prompt, and Claude Code asks before each command.

## Modes

Off means no tool, on request means only when you ask for it, and on its own means Claude Code hands over longer texts by itself.

## Good to know

Short tasks stay with Claude Code, since the call costs more. The local model sees only the text it gets, which goes only to the address you chose. The Cost tab and the Log tab count every call.
