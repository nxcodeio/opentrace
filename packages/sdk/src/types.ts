export type SpanKind = "llm.call" | "tool.call" | "agent.run" | "custom";

export type SpanStatus = "ok" | "error" | "unset";

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
}

export interface Span {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
  events: Array<{ time: number; name: string; attrs?: Record<string, unknown> }>;
  error?: { message: string; stack?: string };
  usage?: Usage;
}

export interface Trace {
  id: string;
  serviceName: string;
  rootName: string;
  startTime: number;
  endTime?: number;
  spans: Span[];
}

export interface Exporter {
  export(trace: Trace): Promise<void>;
}

export interface TracerOptions {
  serviceName?: string;
  endpoint?: string;
  exporter?: "http" | "file" | "null" | Exporter;
  dir?: string;
}
