import { Document, Page, Text, View } from "@react-pdf/renderer";
import { createStyles, formatDate, type PdfBranding } from "./styles";
import { PdfHeader } from "./pdf-header";
import { ResultBadgePdf, SummaryBox, SignatureLine, equipmentClassLabels } from "./test-tag-pdf-shared";

interface TestRecordRow {
  testDate: string; testerName: string; result: string;
  testTagAsset: { testTagId: string; description: string; equipmentClass: string };
  testedBy?: { name: string } | null;
  visualInspectionResult: string; earthContinuityResult: string;
  earthContinuityReading: number | null;
  insulationResult: string; insulationReading: number | null;
  leakageCurrentResult: string; leakageCurrentReading: number | null;
  polarityResult: string; rcdTripTimeResult: string; rcdTripTimeReading: number | null;
  failureNotes: string | null;
}

interface Props {
  org: { name: string; email?: string; phone?: string; address?: string; branding?: PdfBranding; logoData?: string | null; iconData?: string | null };
  data: { records: TestRecordRow[]; passCount: number; failCount: number; total: number };
  filterSummary?: Record<string, string | undefined>;
}

export function TestTagSessionPDF({ org, data, filterSummary }: Props) {
  const s = createStyles(org.branding);
  const cw = [50, 85, 36, 30, 42, 42, 42, 30, 30, 32];
  const testerName = data.records[0]?.testerName || data.records[0]?.testedBy?.name || "-";
  const dateRange = data.records.length > 0
    ? `${formatDate(data.records[data.records.length - 1].testDate)} - ${formatDate(data.records[0].testDate)}`
    : "-";

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PdfHeader
          orgName={org.name}
          orgDetails={[org.email, org.phone, org.address].filter(Boolean).join(" | ")}
          docTitle="Test Session Report"
          docMeta={`Tester: ${testerName} | ${dateRange}`}
          branding={org.branding}
          logoData={org.logoData}
          iconData={org.iconData}
          styles={s}
        />

        {filterSummary && (
          <Text style={{ fontSize: 7, color: "#999", marginBottom: 8 }}>
            Filters: {Object.entries(filterSummary).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" | ")}
          </Text>
        )}

        <SummaryBox items={[
          { label: "Total Tested", value: data.total },
          { label: "Passed", value: data.passCount },
          { label: "Failed", value: data.failCount },
          { label: "Pass Rate", value: data.total > 0 ? `${Math.round((data.passCount / data.total) * 100)}%` : "-" },
        ]} />

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, { width: cw[0] }]}>Tag ID</Text>
            <Text style={[s.th, { width: cw[1] }]}>Description</Text>
            <Text style={[s.th, { width: cw[2] }]}>Class</Text>
            <Text style={[s.th, { width: cw[3] }]}>Visual</Text>
            <Text style={[s.th, { width: cw[4] }]}>Earth (ohm)</Text>
            <Text style={[s.th, { width: cw[5] }]}>Insul (MOhm)</Text>
            <Text style={[s.th, { width: cw[6] }]}>Leak (mA)</Text>
            <Text style={[s.th, { width: cw[7] }]}>Polar</Text>
            <Text style={[s.th, { width: cw[8] }]}>RCD</Text>
            <Text style={[s.th, { width: cw[9] }]}>Result</Text>
          </View>
          {data.records.map((r, i) => (
            <View key={i} wrap={false}>
              <View style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.td, { width: cw[0] }]}>{r.testTagAsset.testTagId}</Text>
                <Text style={[s.td, { width: cw[1] }]}>{r.testTagAsset.description}</Text>
                <Text style={[s.td, { width: cw[2] }]}>{equipmentClassLabels[r.testTagAsset.equipmentClass] || r.testTagAsset.equipmentClass}</Text>
                <View style={{ width: cw[3] }}><ResultBadgePdf result={r.visualInspectionResult} /></View>
                <Text style={[s.td, { width: cw[4] }]}>
                  {r.earthContinuityResult === "NOT_APPLICABLE" ? "N/A" : `${r.earthContinuityReading ?? "-"} ${r.earthContinuityResult === "PASS" ? "P" : "F"}`}
                </Text>
                <Text style={[s.td, { width: cw[5] }]}>
                  {r.insulationResult === "NOT_APPLICABLE" ? "N/A" : `${r.insulationReading ?? "-"} ${r.insulationResult === "PASS" ? "P" : "F"}`}
                </Text>
                <Text style={[s.td, { width: cw[6] }]}>
                  {r.leakageCurrentResult === "NOT_APPLICABLE" ? "N/A" : `${r.leakageCurrentReading ?? "-"} ${r.leakageCurrentResult === "PASS" ? "P" : "F"}`}
                </Text>
                <View style={{ width: cw[7] }}><ResultBadgePdf result={r.polarityResult} /></View>
                <Text style={[s.td, { width: cw[8] }]}>
                  {r.rcdTripTimeResult === "NOT_APPLICABLE" ? "N/A" : `${r.rcdTripTimeReading ?? "-"}ms ${r.rcdTripTimeResult === "PASS" ? "P" : "F"}`}
                </Text>
                <View style={{ width: cw[9] }}><ResultBadgePdf result={r.result} /></View>
              </View>
              {r.result === "FAIL" && r.failureNotes && (
                <View style={{ paddingLeft: 10, paddingVertical: 2, backgroundColor: "#fff5f5" }}>
                  <Text style={{ fontSize: 7, color: "#991b1b" }}>Notes: {r.failureNotes}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Totals: {data.passCount} passed, {data.failCount} failed of {data.total} tested</Text>
        </View>

        <SignatureLine label="Tester signature: ____________________  Date: ____________" />
        <Text style={s.footer}>Generated by GearFlow</Text>
      </Page>
    </Document>
  );
}
