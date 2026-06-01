import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { FileExporter, HttpExporter, NullExporter } from "./exporters.js";
import { instrumentAnthropic } from "./instrumentations/anthropic.js";
import type { Exporter, Span, SpanKind, Trace, TracerOptions, Usage } from "./types.js";

interface Ctx {
  trace: Trace;
  spanStack: Span[];
}

export class Tracer {
  readonly serviceName: string;
  private exporter: Exporter;
  private als = new AsyncLocalStorage<Ctx>();

  constructor(opts: TracerOptions = {}) {
    this.serviceName = opts.serviceName ?? "default";
    this.exporter = pickExporter(opts);
  }

  /** Wrap an Anthropic SDK client so every messages.create becomes an llm.call span. */
  instrument<T>(client: T): T {
    return instrumentAnthropic(client, this) as T;
  }

  /** Root span. All spans recorded inside fn attach to this trace. */
  async trace<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const traceId = randomUUID();
    const root: Span = newSpan({
      traceId,
      parentId: null,
      name,
      kind: "agent.run",
    });
    const trace: Trace = {
      id: traceId,
      serviceName: this.serviceName,
      rootName: name,
      startTime: root.startTime,
      spans: [root],
    };
    const ctx: Ctx = { trace, spanStack: [root] };

    try {
      const result = await this.als.run(ctx, fn);
      root.status = "ok";
      return result;
    } catch (err) {
      finishWithError(root, err);
      throw err;
    } finally {
      root.endTime = Date.now();
      trace.endTime = root.endTime;
      await this.exporter.export(trace);
    }
  }

  async tool<T>(name: string, args: unknown, fn: () => Promise<T>): Promise<T> {
    return this.span(name, fn, { kind: "tool.call", attributes: { args } });
  }

  async span<T>(
    name: string,
    fn: () => Promise<T>,
    opts: { kind?: SpanKind; attributes?: Record<string, unknown> } = {},
  ): Promise<T> {
    const ctx = this.als.getStore();
    if (!ctx) return fn();

    const parent = ctx.spanStack[ctx.spanStack.length - 1]!;
    const span = newSpan({
      traceId: ctx.trace.id,
      parentId: parent.id,
      name,
      kind: opts.kind ?? "custom",
      attributes: opts.attributes ?? {},
    });
    ctx.trace.spans.push(span);
    ctx.spanStack.push(span);

    try {
      const result = await fn();
      span.status = "ok";
      if (opts.kind === "tool.call") span.attributes.result = redactLarge(result);
      return result;
    } catch (err) {
      finishWithError(span, err);
      throw err;
    } finally {
      span.endTime = Date.now();
      ctx.spanStack.pop();
    }
  }

  /** Used by instrumentations to record a completed llm.call. */
  recordLlmSpan(input: {
    name: string;
    attributes: Record<string, unknown>;
    usage?: Usage;
    startTime: number;
    endTime: number;
    error?: unknown;
  }): void {
    const ctx = this.als.getStore();
    if (!ctx) return;
    const parent = ctx.spanStack[ctx.spanStack.length - 1]!;
    const span: Span = {
      id: randomUUID(),
      traceId: ctx.trace.id,
      parentId: parent.id,
      name: input.name,
      kind: "llm.call",
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.error ? "error" : "ok",
      attributes: input.attributes,
      events: [],
      usage: input.usage,
    };
    if (input.error) {
      const e = input.error as Error;
      span.error = { message: e?.message ?? String(input.error), stack: e?.stack };
    }
    ctx.trace.spans.push(span);
  }
}

function newSpan(p: {
  traceId: string;
  parentId: string | null;
  name: string;
  kind: SpanKind;
  attributes?: Record<string, unknown>;
}): Span {
  return {
    id: randomUUID(),
    traceId: p.traceId,
    parentId: p.parentId,
    name: p.name,
    kind: p.kind,
    startTime: Date.now(),
    status: "unset",
    attributes: p.attributes ?? {},
    events: [],
  };
}

function finishWithError(span: Span, err: unknown): void {
  span.status = "error";
  const e = err as Error;
  span.error = { message: e?.message ?? String(err), stack: e?.stack };
}

function redactLarge(value: unknown): unknown {
  const s = safeStringify(value);
  if (s.length > 32_000) return { __truncated: true, preview: s.slice(0, 4_000) };
  return value;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return "";
  }
}

function pickExporter(opts: TracerOptions): Exporter {
  if (opts.exporter && typeof opts.exporter === "object") return opts.exporter;
  const kind = opts.exporter ?? (opts.endpoint ? "http" : "file");
  if (kind === "http") {
    if (!opts.endpoint) throw new Error("Tracer: exporter='http' requires endpoint");
    return new HttpExporter(opts.endpoint);
  }
  if (kind === "null") return new NullExporter();
  return new FileExporter(opts.dir ?? ".opentrace");
}
