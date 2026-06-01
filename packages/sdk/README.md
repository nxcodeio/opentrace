# @opentrace/sdk

TypeScript SDK for OpenTrace.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { Tracer } from "@opentrace/sdk";

const tracer = new Tracer({
  endpoint: "http://localhost:3000",
  // or: exporter: "file", dir: ".opentrace"
});

const anthropic = tracer.instrument(new Anthropic());

await tracer.trace("research-agent", async () => {
  const reply = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [{ role: "user", content: "hi" }],
  });

  await tracer.tool("search", { query: "opentrace" }, async () => {
    return ["result-1", "result-2"];
  });
});
```

## API

- `new Tracer(opts)` — create a tracer. Opts: `{ endpoint?, exporter?, dir?, serviceName? }`.
- `tracer.instrument(client)` — wrap an Anthropic SDK client. Returns the same shape, all `messages.create` calls become spans.
- `tracer.trace(name, fn)` — open a root span. All spans created inside `fn` (including via instrumented clients) attach to this trace.
- `tracer.tool(name, args, fn)` — wrap a tool call. Captures args, result, and errors.
- `tracer.span(name, fn, attrs?)` — generic custom span.

## Exporters

- `http` (default if `endpoint` is set) — POSTs each completed trace to `{endpoint}/api/traces`.
- `file` — appends JSONL to `{dir}/{traceId}.jsonl`. Default `dir` is `./.opentrace`.
- `null` — discard (useful in tests).
