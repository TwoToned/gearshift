import { Document, Page, Text, View } from "@react-pdf/renderer";
import { createStyles, formatDate, type PdfBranding } from "./styles";
import { PdfHeader } from "./pdf-header";
import { equipmentClassLabels, applianceTypeLabels } from "./test-tag-pdf-shared";

interface Props {
  org: { name: string; email?: string; phone?: string; address?: string; branding?: PdfBranding; logoData?: string | null; iconData?: string | null };
  data: {
    groups: Record<string, Record<string, Record<string, number>>>;
    total: number;
  };
}

export function TestTagClassSummaryPDF({ org, data }: Props) {
  const s = createStyles(org.branding);
  const cw = [100, 40, 40, 45, 45, 40, 55, 50];
  const classOrder = ["CLASS_I", "CLASS_II", "CLASS_II_DOUBLE_INSULATED", "LEAD_CORD_ASSEMBLY"];

  // Grand totals
  let grandTotal = 0, grandCurrent = 0, grandDueSoon = 0, grandOverdue = 0, grandFailed = 0, grandNotTested = 0;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PdfHeader
          orgName={org.name}
          orgDetails={[org.email, org.phone, org.address].filter(Boolean).join(" | ")}
          docTitle="Equipment Class Summary"
          docMeta={`Total items: ${data.total} | ${formatDate(new Date())}`}
          branding={org.branding}
          logoData={org.logoData}
          iconData={org.iconData}
          styles={s}
        />

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, { width: cw[0] }]}>Appliance Type</Text>
            <Text style={[s.th, { width: cw[1] }]}>Total</Text>
            <Text style={[s.th, { width: cw[2] }]}>Current</Text>
            <Text style={[s.th, { width: cw[3] }]}>Due Soon</Text>
            <Text style={[s.th, { width: cw[4] }]}>Overdue</Text>
            <Text style={[s.th, { width: cw[5] }]}>Failed</Text>
            <Text style={[s.th, { width: cw[6] }]}>Not Tested</Text>
            <Text style={[s.th, { width: cw[7] }]}>Compliance</Text>
          </View>

          {classOrder.map((cls) => {
            const types = data.groups[cls];
            if (!types) return null;

            let classCurrent = 0, classDueSoon = 0, classOverdue = 0, classFailed = 0, classNotTested = 0, classTotal = 0;

            return (
              <View key={cls}>
                <View style={s.groupHeader}>
                  <Text style={s.groupName}>{equipmentClassLabels[cls] || cls}</Text>
                </View>
                {Object.entries(types).map(([type, counts], i) => {
                  const compliant = (counts.CURRENT || 0) + (counts.DUE_SOON || 0);
                  const rate = counts.total > 0 ? Math.round((compliant / counts.total) * 100) : 0;
                  classTotal += counts.total;
                  classCurrent += counts.CURRENT || 0;
                  classDueSoon += counts.DUE_SOON || 0;
                  classOverdue += counts.OVERDUE || 0;
                  classFailed += counts.FAILED || 0;
                  classNotTested += counts.NOT_YET_TESTED || 0;
                  grandTotal += counts.total;
                  grandCurrent += counts.CURRENT || 0;
                  grandDueSoon += counts.DUE_SOON || 0;
                  grandOverdue += counts.OVERDUE || 0;
                  grandFailed += counts.FAILED || 0;
                  grandNotTested += counts.NOT_YET_TESTED || 0;

                  return (
                    <View key={type} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                      <Text style={[s.td, { width: cw[0], paddingLeft: 8 }]}>{applianceTypeLabels[type] || type}</Text>
                      <Text style={[s.td, { width: cw[1], fontFamily: "Helvetica-Bold" }]}>{counts.total}</Text>
                      <Text style={[s.td, { width: cw[2], color: "#166534" }]}>{counts.CURRENT || 0}</Text>
                      <Text style={[s.td, { width: cw[3], color: "#854d0e" }]}>{counts.DUE_SOON || 0}</Text>
                      <Text style={[s.td, { width: cw[4], color: "#dc2626" }]}>{counts.OVERDUE || 0}</Text>
                      <Text style={[s.td, { width: cw[5], color: "#dc2626" }]}>{counts.FAILED || 0}</Text>
                      <Text style={[s.td, { width: cw[6] }]}>{counts.NOT_YET_TESTED || 0}</Text>
                      <Text style={[s.td, { width: cw[7], fontFamily: "Helvetica-Bold" }]}>{rate}%</Text>
                    </View>
                  );
                })}
                {/* Class subtotal */}
                <View style={{ flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#ddd" }}>
                  <Text style={[s.td, { width: cw[0], fontFamily: "Helvetica-Bold", fontSize: 8 }]}>Subtotal</Text>
                  <Text style={[s.td, { width: cw[1], fontFamily: "Helvetica-Bold", fontSize: 8 }]}>{classTotal}</Text>
                  <Text style={[s.td, { width: cw[2], fontSize: 8 }]}>{classCurrent}</Text>
                  <Text style={[s.td, { width: cw[3], fontSize: 8 }]}>{classDueSoon}</Text>
                  <Text style={[s.td, { width: cw[4], fontSize: 8 }]}>{classOverdue}</Text>
                  <Text style={[s.td, { width: cw[5], fontSize: 8 }]}>{classFailed}</Text>
                  <Text style={[s.td, { width: cw[6], fontSize: 8 }]}>{classNotTested}</Text>
                  <Text style={[s.td, { width: cw[7], fontFamily: "Helvetica-Bold", fontSize: 8 }]}>
                    {classTotal > 0 ? `${Math.round(((classCurrent + classDueSoon) / classTotal) * 100)}%` : "-"}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Grand totals */}
          <View style={{ flexDirection: "row", backgroundColor: "#e5e7eb", paddingVertical: 4, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: "#999" }}>
            <Text style={[s.td, { width: cw[0], fontFamily: "Helvetica-Bold" }]}>Grand Total</Text>
            <Text style={[s.td, { width: cw[1], fontFamily: "Helvetica-Bold" }]}>{grandTotal}</Text>
            <Text style={[s.td, { width: cw[2], fontFamily: "Helvetica-Bold" }]}>{grandCurrent}</Text>
            <Text style={[s.td, { width: cw[3], fontFamily: "Helvetica-Bold" }]}>{grandDueSoon}</Text>
            <Text style={[s.td, { width: cw[4], fontFamily: "Helvetica-Bold" }]}>{grandOverdue}</Text>
            <Text style={[s.td, { width: cw[5], fontFamily: "Helvetica-Bold" }]}>{grandFailed}</Text>
            <Text style={[s.td, { width: cw[6], fontFamily: "Helvetica-Bold" }]}>{grandNotTested}</Text>
            <Text style={[s.td, { width: cw[7], fontFamily: "Helvetica-Bold" }]}>
              {grandTotal > 0 ? `${Math.round(((grandCurrent + grandDueSoon) / grandTotal) * 100)}%` : "-"}
            </Text>
          </View>
        </View>

        <Text style={s.footer}>Generated by GearFlow</Text>
      </Page>
    </Document>
  );
}
