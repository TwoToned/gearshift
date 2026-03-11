import { Document, Page, Text, View } from "@react-pdf/renderer";
import { createStyles, formatDate, type PdfBranding } from "./styles";
import { PdfHeader } from "./pdf-header";
import { SummaryBox, SignatureLine, equipmentClassLabels, applianceTypeLabels, formatDatePdf } from "./test-tag-pdf-shared";

interface Item {
  testTagId: string; description: string; equipmentClass: string; applianceType: string;
  location: string | null; lastTestDate: string | null; nextDueDate: string | null; status: string;
  asset?: { assetTag: string } | null; bulkAsset?: { assetTag: string } | null;
  testRecords?: { failureNotes: string | null; testDate: string | null }[];
}

interface Props {
  org: { name: string; email?: string; phone?: string; address?: string; branding?: PdfBranding; logoData?: string | null; iconData?: string | null };
  data: { overdueItems: Item[]; failedItems: Item[]; notTestedItems: Item[] };
}

function daysOverdue(nextDue: string | null): number {
  if (!nextDue) return 0;
  const diff = Date.now() - new Date(nextDue).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function TestTagOverduePDF({ org, data }: Props) {
  const s = createStyles(org.branding);
  const colWidths = [55, 110, 50, 55, 55, 50, 50];
  const total = data.overdueItems.length + data.failedItems.length + data.notTestedItems.length;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PdfHeader
          orgName={org.name}
          orgDetails={[org.email, org.phone, org.address].filter(Boolean).join(" | ")}
          docTitle="Non-Compliant Equipment Report"
          docMeta={`Requires Immediate Action | ${formatDate(new Date())}`}
          branding={org.branding}
          logoData={org.logoData}
          iconData={org.iconData}
          styles={s}
        />

        <SummaryBox items={[
          { label: "Total Non-Compliant", value: total },
          { label: "Overdue", value: data.overdueItems.length },
          { label: "Failed", value: data.failedItems.length },
          { label: "Not Yet Tested", value: data.notTestedItems.length },
        ]} />

        {/* Overdue Section */}
        {data.overdueItems.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Overdue Items ({data.overdueItems.length})</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: colWidths[0] }]}>Tag ID</Text>
                <Text style={[s.th, { width: colWidths[1] }]}>Description</Text>
                <Text style={[s.th, { width: colWidths[2] }]}>Class</Text>
                <Text style={[s.th, { width: colWidths[3] }]}>Type</Text>
                <Text style={[s.th, { width: colWidths[4] }]}>Due Date</Text>
                <Text style={[s.th, { width: colWidths[5] }]}>Days Over</Text>
                <Text style={[s.th, { width: colWidths[6] }]}>Location</Text>
              </View>
              {data.overdueItems.map((item, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.td, { width: colWidths[0] }]}>{item.testTagId}</Text>
                  <Text style={[s.td, { width: colWidths[1] }]}>{item.description}</Text>
                  <Text style={[s.td, { width: colWidths[2] }]}>{equipmentClassLabels[item.equipmentClass] || item.equipmentClass}</Text>
                  <Text style={[s.td, { width: colWidths[3] }]}>{applianceTypeLabels[item.applianceType] || item.applianceType}</Text>
                  <Text style={[s.td, { width: colWidths[4] }]}>{formatDatePdf(item.nextDueDate)}</Text>
                  <Text style={[s.td, { width: colWidths[5], color: "#dc2626", fontFamily: "Helvetica-Bold" }]}>{daysOverdue(item.nextDueDate)}</Text>
                  <Text style={[s.td, { width: colWidths[6] }]}>{item.location || "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Failed Section */}
        {data.failedItems.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Failed Items ({data.failedItems.length})</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: colWidths[0] }]}>Tag ID</Text>
                <Text style={[s.th, { width: colWidths[1] }]}>Description</Text>
                <Text style={[s.th, { width: colWidths[2] }]}>Class</Text>
                <Text style={[s.th, { width: colWidths[3] }]}>Type</Text>
                <Text style={[s.th, { width: colWidths[4] }]}>Fail Date</Text>
                <Text style={[s.th, { width: 120 }]}>Failure Notes</Text>
              </View>
              {data.failedItems.map((item, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.td, { width: colWidths[0] }]}>{item.testTagId}</Text>
                  <Text style={[s.td, { width: colWidths[1] }]}>{item.description}</Text>
                  <Text style={[s.td, { width: colWidths[2] }]}>{equipmentClassLabels[item.equipmentClass] || item.equipmentClass}</Text>
                  <Text style={[s.td, { width: colWidths[3] }]}>{applianceTypeLabels[item.applianceType] || item.applianceType}</Text>
                  <Text style={[s.td, { width: colWidths[4] }]}>{formatDatePdf(item.lastTestDate)}</Text>
                  <Text style={[s.td, { width: 120 }]}>{item.testRecords?.[0]?.failureNotes || "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Not Yet Tested Section */}
        {data.notTestedItems.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Not Yet Tested ({data.notTestedItems.length})</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: colWidths[0] }]}>Tag ID</Text>
                <Text style={[s.th, { width: colWidths[1] }]}>Description</Text>
                <Text style={[s.th, { width: colWidths[2] }]}>Class</Text>
                <Text style={[s.th, { width: colWidths[3] }]}>Type</Text>
                <Text style={[s.th, { width: colWidths[6] }]}>Location</Text>
              </View>
              {data.notTestedItems.map((item, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.td, { width: colWidths[0] }]}>{item.testTagId}</Text>
                  <Text style={[s.td, { width: colWidths[1] }]}>{item.description}</Text>
                  <Text style={[s.td, { width: colWidths[2] }]}>{equipmentClassLabels[item.equipmentClass] || item.equipmentClass}</Text>
                  <Text style={[s.td, { width: colWidths[3] }]}>{applianceTypeLabels[item.applianceType] || item.applianceType}</Text>
                  <Text style={[s.td, { width: colWidths[6] }]}>{item.location || "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <SignatureLine label="Acknowledged by: ____________________  Date: ____________" />
        <Text style={s.footer}>Generated by GearFlow</Text>
      </Page>
    </Document>
  );
}
