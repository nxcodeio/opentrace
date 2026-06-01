import { notFound } from "next/navigation";
import { getTrace, totalCost, totalTokens, type ViewerSpan, type ViewerTrace } from "@/lib/store";

export const dynamic = "force-dynamic";

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtCost(usd: number): string {
  if (!usd) return "—";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function pillClass(kind: string): string {
  if (kind === "llm.call") return "pill pill-llm";
  if (kind === "tool.call") return "pill pill-tool";
  if (kind === "agent.run") return "pill pill-agent";
  return "pill pill-custom";
}

function barClass(kind: string): string {
  if (kind === "llm.call") return "bar bar-llm";
  if (kind === "tool.call") return "bar bar-tool";
  if (kind === "agent.run") return "bar bar-agent";
  return "bar bar-custom";
}

interface SpanWithChildren extends ViewerSpan {
  children: SpanWithChildren[];
  depth: number;
}

function buildTree(spans: ViewerSpan[]): SpanWithChildren[] {
  const byId = new Map<string, SpanWithChildren>();
  spans.forEach((s) => byId.set(s.id, { ...s, children: [], depth: 0 }));
  const roots: SpanWithChildren[] = [];
  byId.forEach((s) => {
    if (s.parentId && byId.has(s.parentId)) {
      const parent = byId.get(s.parentId)!;
      s.depth = parent.depth + 1;
      parent.children.push(s);
    } else {
      roots.push(s);
    }
  });
  return roots;
}

function flatten(roots: SpanWithChildren[]): SpanWithChildren[] {
  const out: SpanWithChildren[] = [];
  function visit(s: SpanWithChildren, depth: number) {
    s.depth = depth;
    out.push(s);
    s.children
      .slice()
      .sort((a, b) => a.startTime - b.startTime)
      .forEach((c) => visit(c, depth + 1));
  }
  roots.sort((a, b) => a.startTime - b.startTime).forEach((r) => visit(r, 0));
  return out;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

function SpanDetails({ span }: { span: ViewerSpan }) {
  const a = span.attributes ?? {};
  const system = a["llm.request.system"];
  const messages = a["llm.request.messages"];
  const tools = a["llm.request.tools"];
  const response = a["llm.response.content"];
  const args = a["args"];
  const result = a["result"];
  const model = a["llm.model"];
  return (
    <details>
      <summary>
        <span className={pillClass(span.kind)} style={{ marginRight: 8 }}>{span.kind}</span>
        {span.name}
        {span.status === "error" && <span className="pill pill-err" style={{ marginLeft: 8 }}>error</span>}
      </summary>
      <dl className="kv">
        <dt>id</dt><dd><code>{span.id}</code></dd>
        <dt>started</dt><dd>{new Date(span.startTime).toLocaleTimeString()}</dd>
        <dt>duration</dt><dd>{span.endTime ? fmtDuration(span.endTime - span.startTime) : "—"}</dd>
        {span.usage?.inputTokens != null && (
          <>
            <dt>tokens</dt>
            <dd>
              {span.usage.inputTokens.toLocaleString()} in / {(span.usage.outputTokens ?? 0).toLocaleString()} out
              {span.usage.cacheReadTokens ? ` · ${span.usage.cacheReadTokens.toLocaleString()} cache read` : ""}
              {span.usage.cacheWriteTokens ? ` · ${span.usage.cacheWriteTokens.toLocaleString()} cache write` : ""}
            </dd>
          </>
        )}
        {span.usage?.costUsd != null && (
          <>
            <dt>cost</dt><dd>{fmtCost(span.usage.costUsd)}</dd>
          </>
        )}
        {model != null && (<><dt>model</dt><dd>{String(model)}</dd></>)}
      </dl>
      {system != null && (
        <>
          <div className="section-title">system</div>
          <pre>{asString(system)}</pre>
        </>
      )}
      {messages != null && (
        <>
          <div className="section-title">request messages</div>
          <pre>{asString(messages)}</pre>
        </>
      )}
      {tools != null && (
        <>
          <div className="section-title">tools</div>
          <pre>{asString(tools)}</pre>
        </>
      )}
      {response != null && (
        <>
          <div className="section-title">response</div>
          <pre>{asString(response)}</pre>
        </>
      )}
      {args !== undefined && (
        <>
          <div className="section-title">args</div>
          <pre>{asString(args)}</pre>
        </>
      )}
      {result !== undefined && (
        <>
          <div className="section-title">result</div>
          <pre>{asString(result)}</pre>
        </>
      )}
      {span.error && (
        <>
          <div className="section-title">error</div>
          <pre>{span.error.message}{span.error.stack ? `\n\n${span.error.stack}` : ""}</pre>
        </>
      )}
    </details>
  );
}

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trace = await getTrace(id);
  if (!trace) notFound();

  const start = trace.startTime;
  const end = trace.endTime ?? Math.max(...trace.spans.map((s) => s.endTime ?? s.startTime));
  const total = Math.max(1, end - start);

  const tree = flatten(buildTree(trace.spans));
  const cost = totalCost(trace);
  const tokens = totalTokens(trace);

  return (
    <div>
      <a href="/" className="muted" style={{ fontSize: 13 }}>← all traces</a>
      <h2 style={{ marginTop: 12, marginBottom: 8 }}>{trace.rootName}</h2>
      <div className="row" style={{ gap: 24, fontSize: 13, marginBottom: 24 }}>
        <span className="muted">id <code>{trace.id.slice(0, 8)}</code></span>
        <span className="muted">duration <strong style={{ color: "var(--text)" }}>{fmtDuration(total)}</strong></span>
        <span className="muted">tokens <strong style={{ color: "var(--text)" }}>{tokens.input.toLocaleString()} in / {tokens.output.toLocaleString()} out</strong></span>
        <span className="muted">cost <strong style={{ color: "var(--text)" }}>{fmtCost(cost)}</strong></span>
        <span className="muted">{trace.spans.length} spans</span>
      </div>

      <div className="section-title">timeline</div>
      <div className="timeline">
        {tree.map((s) => {
          const offset = ((s.startTime - start) / total) * 100;
          const width = Math.max(0.5, (((s.endTime ?? end) - s.startTime) / total) * 100);
          return (
            <div key={s.id} className="span-row">
              <div className="span-left" style={{ paddingLeft: s.depth * 16 }}>
                <div className="span-name">
                  <span className={pillClass(s.kind)} style={{ marginRight: 8 }}>{s.kind.replace(".", " · ")}</span>
                  {s.name}
                </div>
                <div className="bar-track">
                  <div className={barClass(s.kind)} style={{ left: `${offset}%`, width: `${width}%` }} />
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12 }}>
                <div>{s.endTime ? fmtDuration(s.endTime - s.startTime) : "—"}</div>
                <div className="muted">{s.usage?.costUsd ? fmtCost(s.usage.costUsd) : ""}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">details</div>
      {tree.map((s) => (<SpanDetails key={s.id} span={s} />))}
    </div>
  );
}
