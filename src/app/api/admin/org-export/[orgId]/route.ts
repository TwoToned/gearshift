import { NextRequest, NextResponse } from "next/server";
import { requireSiteAdminApi } from "@/lib/admin-auth";
import { exportOrganization } from "@/lib/org-export";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireSiteAdminApi();
    const { orgId } = await params;
    const stream = await exportOrganization(orgId);

    const readable = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err: Error) => controller.error(err));
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="org-export-${orgId}.zip"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
