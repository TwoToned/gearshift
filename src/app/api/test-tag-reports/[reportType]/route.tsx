import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/auth-server";
import { getFileAsDataUri } from "@/lib/storage";
import type { ReportFilters } from "@/server/test-tag-reports";
import {
  getRegisterReportData, exportRegisterCSV,
  getOverdueReportData, exportOverdueCSV,
  getSessionReportData, exportSessionCSV,
  getItemHistoryReportData,
  getDueScheduleReportData, exportDueScheduleCSV,
  getClassSummaryReportData, exportClassSummaryCSV,
  getTesterActivityReportData, exportTesterActivityCSV,
  getFailedItemsReportData, exportFailedItemsCSV,
  getBulkSummaryReportData, exportBulkSummaryCSV,
  getComplianceCertificateData,
} from "@/server/test-tag-reports";

import { TestTagRegisterPDF } from "@/lib/pdf/test-tag-register-pdf";
import { TestTagOverduePDF } from "@/lib/pdf/test-tag-overdue-pdf";
import { TestTagSessionPDF } from "@/lib/pdf/test-tag-session-pdf";
import { TestTagItemHistoryPDF } from "@/lib/pdf/test-tag-item-history-pdf";
import { TestTagDueSchedulePDF } from "@/lib/pdf/test-tag-due-schedule-pdf";
import { TestTagClassSummaryPDF } from "@/lib/pdf/test-tag-class-summary-pdf";
import { TestTagTesterActivityPDF } from "@/lib/pdf/test-tag-tester-activity-pdf";
import { TestTagFailedItemsPDF } from "@/lib/pdf/test-tag-failed-items-pdf";
import { TestTagBulkSummaryPDF } from "@/lib/pdf/test-tag-bulk-summary-pdf";
import { TestTagComplianceCertPDF } from "@/lib/pdf/test-tag-compliance-cert-pdf";

function parseFilters(url: URL): ReportFilters {
  const filters: ReportFilters = {};
  const get = (key: string) => url.searchParams.get(key) || undefined;
  const getArr = (key: string) => url.searchParams.getAll(key).filter(Boolean);

  filters.dateFrom = get("dateFrom");
  filters.dateTo = get("dateTo");
  filters.searchQuery = get("search");
  filters.bulkAssetId = get("bulkAssetId");
  filters.assetLinkType = get("assetLinkType") as ReportFilters["assetLinkType"];

  const statuses = getArr("status");
  if (statuses.length) filters.statuses = statuses;
  const classes = getArr("equipmentClass");
  if (classes.length) filters.equipmentClasses = classes;
  const types = getArr("applianceType");
  if (types.length) filters.applianceTypes = types;
  const results = getArr("result");
  if (results.length) filters.results = results;
  const testers = getArr("testedBy");
  if (testers.length) filters.testedBy = testers;
  const locations = getArr("location");
  if (locations.length) filters.locations = locations;

  return filters;
}

async function getOrgData(organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  let orgSettings: Record<string, unknown> = {};
  if (org?.metadata) {
    try { orgSettings = JSON.parse(org.metadata); } catch { /* ignore */ }
  }
  const branding = orgSettings.branding as {
    primaryColor?: string; accentColor?: string; documentColor?: string;
    logoUrl?: string; iconUrl?: string; documentLogoMode?: "logo" | "icon" | "none";
    showOrgNameOnDocuments?: boolean;
  } | undefined;

  const [logoData, iconData] = await Promise.all([
    branding?.logoUrl ? getFileAsDataUri(branding.logoUrl) : null,
    branding?.iconUrl ? getFileAsDataUri(branding.iconUrl) : null,
  ]);

  return {
    name: org?.name || "",
    email: (orgSettings.email as string) || undefined,
    phone: (orgSettings.phone as string) || undefined,
    address: (orgSettings.address as string) || undefined,
    branding,
    logoData,
    iconData,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportType: string }> }
) {
  const { reportType } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "pdf";

  let session;
  try {
    session = await requireOrganization();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = session;
  const filters = parseFilters(url);

  // Helper to serialize dates to strings (same pattern as existing document route)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ser = (data: any) => JSON.parse(JSON.stringify(data, (_key, value) =>
    value instanceof Date ? value.toISOString() : value
  ));

  try {
    // CSV exports
    if (format === "csv") {
      let csv: string;
      let filename: string;

      switch (reportType) {
        case "register":
          csv = await exportRegisterCSV(filters);
          filename = "tt-register.csv";
          break;
        case "overdue":
          csv = await exportOverdueCSV(filters);
          filename = "tt-overdue.csv";
          break;
        case "session":
          csv = await exportSessionCSV(filters);
          filename = "tt-session.csv";
          break;
        case "due-schedule":
          csv = await exportDueScheduleCSV(filters);
          filename = "tt-due-schedule.csv";
          break;
        case "class-summary":
          csv = await exportClassSummaryCSV(filters);
          filename = "tt-class-summary.csv";
          break;
        case "tester-activity":
          csv = await exportTesterActivityCSV(filters);
          filename = "tt-tester-activity.csv";
          break;
        case "failed-items":
          csv = await exportFailedItemsCSV(filters);
          filename = "tt-failed-items.csv";
          break;
        case "bulk-summary":
          if (!filters.bulkAssetId) return NextResponse.json({ error: "bulkAssetId required" }, { status: 400 });
          csv = await exportBulkSummaryCSV(filters.bulkAssetId, filters);
          filename = "tt-bulk-summary.csv";
          break;
        default:
          return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
      }

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // PDF exports
    const orgData = await getOrgData(organizationId);
    let doc;
    let filename: string;

    switch (reportType) {
      case "register": {
        const data = ser(await getRegisterReportData(filters));
        doc = <TestTagRegisterPDF org={orgData} data={data} />;
        filename = "TT-Register.pdf";
        break;
      }
      case "overdue": {
        const data = ser(await getOverdueReportData(filters));
        doc = <TestTagOverduePDF org={orgData} data={data} />;
        filename = "TT-NonCompliant.pdf";
        break;
      }
      case "session": {
        const data = ser(await getSessionReportData(filters));
        doc = <TestTagSessionPDF org={orgData} data={data} />;
        filename = "TT-Session.pdf";
        break;
      }
      case "item-history": {
        const id = url.searchParams.get("testTagAssetId");
        if (!id) return NextResponse.json({ error: "testTagAssetId required" }, { status: 400 });
        const data = ser(await getItemHistoryReportData(id));
        doc = <TestTagItemHistoryPDF org={orgData} data={data} />;
        filename = `TT-History-${data.testTagId}.pdf`;
        break;
      }
      case "due-schedule": {
        const data = ser(await getDueScheduleReportData(filters));
        doc = <TestTagDueSchedulePDF org={orgData} data={data} />;
        filename = "TT-DueSchedule.pdf";
        break;
      }
      case "class-summary": {
        const data = ser(await getClassSummaryReportData(filters));
        doc = <TestTagClassSummaryPDF org={orgData} data={data} />;
        filename = "TT-ClassSummary.pdf";
        break;
      }
      case "tester-activity": {
        const data = ser(await getTesterActivityReportData(filters));
        doc = <TestTagTesterActivityPDF org={orgData} data={data} />;
        filename = "TT-TesterActivity.pdf";
        break;
      }
      case "failed-items": {
        const data = ser(await getFailedItemsReportData(filters));
        doc = <TestTagFailedItemsPDF org={orgData} data={data} />;
        filename = "TT-FailedItems.pdf";
        break;
      }
      case "bulk-summary": {
        if (!filters.bulkAssetId) return NextResponse.json({ error: "bulkAssetId required" }, { status: 400 });
        const data = ser(await getBulkSummaryReportData(filters.bulkAssetId, filters));
        doc = <TestTagBulkSummaryPDF org={orgData} data={data} />;
        filename = `TT-BulkSummary-${data.bulkAsset.assetTag}.pdf`;
        break;
      }
      case "compliance-certificate": {
        const data = ser(await getComplianceCertificateData(filters));
        doc = <TestTagComplianceCertPDF org={orgData} data={data} />;
        filename = "TT-ComplianceCertificate.pdf";
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }

    const buffer = await renderToBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("Report generation error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Report generation failed" }, { status: 500 });
  }
}
