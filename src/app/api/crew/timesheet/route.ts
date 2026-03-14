import { NextRequest, NextResponse } from "next/server";
import { exportTimesheetCSV } from "@/server/crew-time";

/**
 * GET /api/crew/timesheet?dateFrom=...&dateTo=...&crewMemberId=...&projectId=...&status=...
 *
 * Download timesheet data as CSV. Requires authentication (session-based).
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const filters = {
      dateFrom: params.get("dateFrom") || undefined,
      dateTo: params.get("dateTo") || undefined,
      crewMemberId: params.get("crewMemberId") || undefined,
      projectId: params.get("projectId") || undefined,
      status: params.get("status") || undefined,
    };

    const csv = await exportTimesheetCSV(filters);
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="timesheet-${date}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
