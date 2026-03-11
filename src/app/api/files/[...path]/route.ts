import { NextRequest, NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth-server";
import { getFromS3 } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  let session;
  try {
    session = await requireOrganization();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = session;
  const { path } = await params;
  const storageKey = path.join("/");

  // Verify the file belongs to the requesting user's organization
  if (!storageKey.startsWith(organizationId + "/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const response = await getFromS3(storageKey);

    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const contentType = response.ContentType || "application/octet-stream";
    const isImage = contentType.startsWith("image/");

    // Convert the S3 readable stream to a web ReadableStream
    const stream = response.Body.transformToWebStream();

    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    if (isImage) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    } else {
      // Extract filename from key for Content-Disposition
      const fileName = storageKey.split("/").pop() || "download";
      // Remove UUID prefix (first 8 chars + dash)
      const cleanName = fileName.replace(/^[a-f0-9]+-/, "");
      headers["Content-Disposition"] = `inline; filename="${cleanName}"`;
      headers["Cache-Control"] = "private, max-age=3600";
    }

    if (response.ContentLength) {
      headers["Content-Length"] = String(response.ContentLength);
    }

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
