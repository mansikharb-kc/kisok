// RMS analytics ingest. Phase: P1.7
// POST = append a batch of interaction events to rms_events (dwell-time computed from timestamps).
// TODO: validate + bulk insert; rate-limit; partition by date/branch.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ status: "not_implemented" }, { status: 501 });
}
