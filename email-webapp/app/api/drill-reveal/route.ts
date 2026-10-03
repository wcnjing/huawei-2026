import { NextRequest, NextResponse } from "next/server";

interface ReportEvent {
  email: string;
  drillId: string | null;
  reportedAt: string;
}

// Placeholder in-memory store — replace with a real DB for production use.
const reportLog: ReportEvent[] = [];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const drillId = searchParams.get("drillId");

  if (email) {
    reportLog.push({
      email,
      drillId: drillId ?? null,
      reportedAt: new Date().toISOString(),
    });
    console.log("Drill reported as suspicious:", email, drillId);
  }

  // Redirect to the positive reveal page
  return NextResponse.redirect(new URL("/drill-reveal", req.url));
}

// Optional: an endpoint to check logged reports during development.
export async function POST() {
  return NextResponse.json({ reports: reportLog });
}