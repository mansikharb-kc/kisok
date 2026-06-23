// RMS BOM cart API. Phase: P1.6
// GET = current BOM; POST = add item; DELETE = remove item. (No price.)
// TODO: implement against bom_lists/bom_items; tie to customer; quote export.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "not_implemented" }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ status: "not_implemented" }, { status: 501 });
}

export async function DELETE() {
  return NextResponse.json({ status: "not_implemented" }, { status: 501 });
}
