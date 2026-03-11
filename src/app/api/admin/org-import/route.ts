import { NextRequest, NextResponse } from "next/server";
import { requireSiteAdminApi } from "@/lib/admin-auth";
import { importOrganization } from "@/lib/org-import";

export async function POST(req: NextRequest) {
  try {
    await requireSiteAdminApi();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const newOrgName = formData.get("name") as string | null;
    const newOrgSlug = formData.get("slug") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await importOrganization(buffer, {
      newOrgName: newOrgName || undefined,
      newOrgSlug: newOrgSlug || undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
