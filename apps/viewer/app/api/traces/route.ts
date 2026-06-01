import { NextResponse } from "next/server";
import { listTraces, saveTrace, type ViewerTrace } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json()) as ViewerTrace;
  if (!body?.id || !Array.isArray(body.spans)) {
    return NextResponse.json({ error: "invalid trace payload" }, { status: 400 });
  }
  await saveTrace(body);
  return NextResponse.json({ ok: true, id: body.id });
}

export async function GET() {
  const traces = await listTraces();
  return NextResponse.json(traces.map((t) => ({
    id: t.id,
    serviceName: t.serviceName,
    rootName: t.rootName,
    startTime: t.startTime,
    endTime: t.endTime,
    spanCount: t.spans.length,
  })));
}
