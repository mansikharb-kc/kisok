// RMS device activation API. Phase: P1.1
// POST = create device access request (pending) for the branch Screen Manager.
// GET  = check this device's activation status.
// TODO: implement against screen_devices; issue signed cookie on approval.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ status: "not_implemented" }, { status: 501 });
}

export async function GET() {
  return NextResponse.json({ status: "not_implemented" }, { status: 501 });
}
