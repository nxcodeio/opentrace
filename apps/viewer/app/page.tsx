import { listTraces, totalCost, totalTokens } from "@/lib/store";

export const dynamic = "force-dynamic";

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtCost(usd: number): string {
  if (usd === 0) return "—";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString();
}

export default async function Page() {
  const traces = await listTraces();

  if (traces.length === 0) {
    return (
      <div className="empty">
        <h2 style={{ marginBottom: 8 }}>No traces yet</h2>
        <p>
          Point your SDK at <code>http://localhost:3000</code> and start tracing.
        </p>
        <pre style={{ textAlign: "left", maxWidth: 560, margin: "24px auto" }}>{`import { Tracer } from "@opentrace/sdk";
import Anthropic from "@anthropic-ai/sdk";

const tracer = new Tracer({ endpoint: "http://localhost:3000" });
const anthropic = tracer.instrument(new Anthropic());

await tracer.trace("hello", async () => {
  await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 256,
    messages: [{ role: "user", content: "hi" }],
  });
});`}</pre>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Traces</h2>
      {traces.map((t) => {
        const duration = (t.endTime ?? Date.now()) - t.startTime;
        const cost = totalCost(t);
        const tokens = totalTokens(t);
        const hasError = t.spans.some((s) => s.status === "error");
        return (
          <a key={t.id} href={`/traces/${t.id}`} className="card">
            <div className="row row-spread">
              <div className="row" style={{ gap: 12 }}>
                <strong>{t.rootName}</strong>
                <span className="pill pill-agent">{t.spans.length} spans</span>
                {hasError && <span className="pill pill-err">error</span>}
              </div>
              <span className="muted" style={{ fontSize: 12 }}>{fmtTime(t.startTime)}</span>
            </div>
            <div className="row" style={{ gap: 24, marginTop: 8, fontSize: 13 }}>
              <span className="muted">duration <strong style={{ color: "var(--text)" }}>{fmtDuration(duration)}</strong></span>
              <span className="muted">tokens <strong style={{ color: "var(--text)" }}>{tokens.input.toLocaleString()} in / {tokens.output.toLocaleString()} out</strong></span>
              <span className="muted">cost <strong style={{ color: "var(--text)" }}>{fmtCost(cost)}</strong></span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
