# OpenTrace

> Sentry for AI agents. Capture every LLM call and tool invocation, replay any run with edits.

OpenTrace gives you a complete, replayable timeline of what your agent did — every prompt, every tool call, every token spent — and lets you edit any step and re-run from there. It's the missing piece between "my agent worked on my laptop" and "my agent works in production."

## Why

Existing observability stacks (Sentry, Datadog, OpenTelemetry) were built for stateless services. Agents are stateful, expensive, and probabilistic. You need to see:

- The **exact prompt** that produced a bad response (not just `prompt.length=2847`)
- **Tool calls as first-class spans** — not nested HTTP logs
- **Per-trace token cost** broken down by model and cache hit rate
- **Replay** — edit the system prompt at step 3, re-run from there with the same tool responses mocked

That's what OpenTrace does.

## Status

Early. The SDK + local viewer work. Hosted backend, replay UI, and team features are on the roadmap below.

## Quick start

```bash
pnpm add @opentrace/sdk
```

```ts
import Anthropic from "@anthropic-ai/sdk";
import { Tracer } from "@opentrace/sdk";

const tracer = new Tracer({ endpoint: "http://localhost:3000" });
const anthropic = tracer.instrument(new Anthropic());

await tracer.trace("research-agent", async () => {
  await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [{ role: "user", content: "What is OpenTrace?" }],
  });
});
```

Then run the viewer:

```bash
pnpm --filter @opentrace/viewer dev
# open http://localhost:3000
```

## What you get

- **Trace timeline** — every span (LLM call, tool call, custom) with start/end, duration, status
- **Full payloads** — input messages, output, system prompt, tool definitions, all preserved
- **Cost attribution** — input/output/cache tokens × current model pricing per span and per trace
- **Local-first** — traces live in `.opentrace/` as JSONL by default, no network required

## Roadmap

- [x] TypeScript SDK with Anthropic instrumentation
- [x] Local viewer (trace list + timeline)
- [ ] OpenAI instrumentation
- [ ] MCP tool-call auto-instrumentation
- [ ] Replay with edits
- [ ] Diff view (compare two traces side-by-side)
- [ ] Self-hosted backend (Postgres + S3-compatible blob storage)
- [ ] Cost budgets + alerts
- [ ] Eval harness integration (snapshot a trace, assert against future runs)

## Design principles

1. **Capture by default, sample later.** Storage is cheap. A truncated trace is useless.
2. **Local-first.** Your prompts are sensitive. Default exporter writes to disk. Cloud is opt-in.
3. **No code changes to instrument.** Wrap the client once. Tool calls inside `tracer.trace()` are auto-captured.
4. **Replay is the killer feature.** If you can't re-run with one variable changed, you can't iterate.

## License

MIT
