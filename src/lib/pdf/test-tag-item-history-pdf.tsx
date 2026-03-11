import { Document, Page, Text, View } from "@react-pdf/renderer";
import { createStyles, formatDate, type PdfBranding } from "./styles";
import { PdfHeader } from "./pdf-header";
import { StatusBadgePdf, ResultBadgePdf, equipmentClassLabels, applianceTypeLabels, formatDatePdf } from "./test-tag-pdf-shared";

interface TestRecord {
  testDate: string; testerName: string; result: string;
  testedBy?: { name: string } | null;
  visualInspectionResult: string; earthContinuityResult: string;
  earthContinuityReading: number | null; insulationResult: string;
  insulationReading: number | null; leakageCurrentResult: string;
  leakageCurrentReading: number | null; polarityResult: string;
  rcdTripTimeResult: string; rcdTripTimeReading: number | null;
  failureNotes: string | null; functionalTestNotes: string | null;
  visualNotes: string | null; failureAction: string;
}

interface Props {
  org: { name: string; email?: string; phone?: string; address?: string; branding?: PdfBranding; logoData?: string | null; iconData?: string | null };
  data: {
    testTagId: string; description: string; equipmentClass: string; applianceType: string;
    make: string | null; modelName: string | null; serialNumber: string | null;
    location: string | null; testIntervalMonths: number; status: string;
    lastTestDate: string | null; nextDueDate: string | null;
    asset?: { assetTag: string; customName: string | null } | null;
    bulkAsset?: { assetTag: string } | null;
    testRecords: TestRecord[];
  };
}

const failureActionLabels: Record<string, string> = {
  NONE: "None", REPAIRED: "Repaired", REMOVED_FROM_SERVICE: "Removed",
  DISPOSED: "Disposed", REFERRED_TO_ELECTRICIAN: "Referred to Electrician",
};

export function TestTagItemHistoryPDF({ org, data }: Props) {
  const s = createStyles(org.branding);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          orgName={org.name}
          orgDetails={[org.email, org.phone, org.address].filter(Boolean).join(" | ")}
          docTitle="Item Test History"
          docMeta={`${data.testTagId} | ${formatDate(new Date())}`}
          branding={org.branding}
          logoData={org.logoData}
          iconData={org.iconData}
          styles={s}
        />

        {/* Item Details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Item Details</Text>
          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.label}>Test Tag ID</Text>
              <Text style={s.value}>{data.testTagId}</Text>
              <Text style={s.label}>Description</Text>
              <Text style={s.value}>{data.description}</Text>
              <Text style={s.label}>Equipment Class</Text>
              <Text style={s.value}>{equipmentClassLabels[data.equipmentClass] || data.equipmentClass}</Text>
              <Text style={s.label}>Appliance Type</Text>
              <Text style={s.value}>{applianceTypeLabels[data.applianceType] || data.applianceType}</Text>
            </View>
            <View style={s.col}>
              <Text style={s.label}>Make</Text>
              <Text style={s.value}>{data.make || "-"}</Text>
              <Text style={s.label}>Model</Text>
              <Text style={s.value}>{data.modelName || "-"}</Text>
              <Text style={s.label}>Serial Number</Text>
              <Text style={s.value}>{data.serialNumber || "-"}</Text>
              <Text style={s.label}>Location</Text>
              <Text style={s.value}>{data.location || "-"}</Text>
            </View>
            <View style={s.col}>
              <Text style={s.label}>Test Interval</Text>
              <Text style={s.value}>{data.testIntervalMonths} months</Text>
              <Text style={s.label}>Last Test</Text>
              <Text style={s.value}>{formatDatePdf(data.lastTestDate)}</Text>
              <Text style={s.label}>Next Due</Text>
              <Text style={s.value}>{formatDatePdf(data.nextDueDate)}</Text>
              <Text style={s.label}>Status</Text>
              <StatusBadgePdf status={data.status} />
              {data.asset && (
                <>
                  <Text style={[s.label, { marginTop: 4 }]}>Linked Asset</Text>
                  <Text style={s.value}>{data.asset.assetTag}{data.asset.customName ? ` - ${data.asset.customName}` : ""}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Test Records */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Test History ({data.testRecords.length} records)</Text>
          {data.testRecords.map((r, i) => (
            <View key={i} wrap={false} style={{ marginBottom: 8, borderWidth: 0.5, borderColor: "#e5e7eb", borderRadius: 3, padding: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{formatDatePdf(r.testDate)}</Text>
                  <Text style={{ fontSize: 9 }}>Tester: {r.testedBy?.name || r.testerName}</Text>
                </View>
                <ResultBadgePdf result={r.result} />
              </View>

              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Text style={{ fontSize: 7, color: "#666" }}>Visual:</Text>
                  <ResultBadgePdf result={r.visualInspectionResult} />
                </View>
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Text style={{ fontSize: 7, color: "#666" }}>Earth:</Text>
                  {r.earthContinuityResult === "NOT_APPLICABLE"
                    ? <Text style={{ fontSize: 7, color: "#999" }}>N/A</Text>
                    : <Text style={{ fontSize: 7 }}>{r.earthContinuityReading ?? "-"} ohm ({r.earthContinuityResult})</Text>
                  }
                </View>
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Text style={{ fontSize: 7, color: "#666" }}>Insulation:</Text>
                  {r.insulationResult === "NOT_APPLICABLE"
                    ? <Text style={{ fontSize: 7, color: "#999" }}>N/A</Text>
                    : <Text style={{ fontSize: 7 }}>{r.insulationReading ?? "-"} MOhm ({r.insulationResult})</Text>
                  }
                </View>
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Text style={{ fontSize: 7, color: "#666" }}>Leakage:</Text>
                  {r.leakageCurrentResult === "NOT_APPLICABLE"
                    ? <Text style={{ fontSize: 7, color: "#999" }}>N/A</Text>
                    : <Text style={{ fontSize: 7 }}>{r.leakageCurrentReading ?? "-"} mA ({r.leakageCurrentResult})</Text>
                  }
                </View>
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Text style={{ fontSize: 7, color: "#666" }}>Polarity:</Text>
                  <ResultBadgePdf result={r.polarityResult} />
                </View>
                {r.rcdTripTimeResult !== "NOT_APPLICABLE" && (
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <Text style={{ fontSize: 7, color: "#666" }}>RCD:</Text>
                    <Text style={{ fontSize: 7 }}>{r.rcdTripTimeReading ?? "-"}ms ({r.rcdTripTimeResult})</Text>
                  </View>
                )}
              </View>

              {(r.failureNotes || r.visualNotes || r.functionalTestNotes) && (
                <Text style={{ fontSize: 7, color: "#666", marginTop: 3 }}>
                  Notes: {r.failureNotes || r.visualNotes || r.functionalTestNotes}
                </Text>
              )}
              {r.result === "FAIL" && r.failureAction !== "NONE" && (
                <Text style={{ fontSize: 7, color: "#991b1b", marginTop: 2 }}>
                  Action: {failureActionLabels[r.failureAction] || r.failureAction}
                </Text>
              )}
            </View>
          ))}
        </View>

        <Text style={s.footer}>Generated by GearFlow</Text>
      </Page>
    </Document>
  );
}
