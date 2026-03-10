import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, formatDate } from "./styles";

interface LineItem {
  id: string;
  description: string | null;
  quantity: number;
  status: string;
  groupName: string | null;
  isKitChild?: boolean;
  kitId?: string | null;
  model: { name: string; modelNumber?: string | null } | null;
  asset: { assetTag: string } | null;
  bulkAsset: { assetTag: string } | null;
  kit?: { assetTag: string; name: string } | null;
  childLineItems?: LineItem[];
}

interface ReturnSheetPDFProps {
  org: { name: string };
  project: {
    projectNumber: string;
    name: string;
    loadOutDate: string | null;
    rentalEndDate: string | null;
    client: { name: string } | null;
    lineItems: LineItem[];
  };
}

function Checkbox({ size = 7 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 0.75,
        borderColor: "#333",
        borderRadius: 1,
      }}
    />
  );
}

function ConditionCheckboxes({ fontSize = 7 }: { fontSize?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Checkbox size={fontSize} />
      <Text style={{ fontSize, marginRight: 4 }}>Good</Text>
      <Checkbox size={fontSize} />
      <Text style={{ fontSize, marginRight: 4 }}>Dmg</Text>
      <Checkbox size={fontSize} />
      <Text style={{ fontSize }}>Missing</Text>
    </View>
  );
}

export function ReturnSheetPDF({ org, project }: ReturnSheetPDFProps) {
  // Only include items that were checked out, exclude kit children
  const items = project.lineItems.filter(
    (i) => (i.status === "CHECKED_OUT" || i.status === "RETURNED") && !i.isKitChild
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{org.name}</Text>
            <Text style={styles.companyDetails}>Return Sheet</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>RETURN SHEET</Text>
            <Text style={styles.docMeta}>
              {project.projectNumber}
              {"\n"}{project.name}
              {project.client ? `\n${project.client.name}` : ""}
              {project.loadOutDate ? `\nLoad Out: ${formatDate(project.loadOutDate)}` : ""}
            </Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: 20, textAlign: "center" }]}>Ret</Text>
            <Text style={[styles.th, { flex: 2 }]}>Item</Text>
            <Text style={[styles.th, { width: 30, textAlign: "center" }]}>Qty</Text>
            <Text style={[styles.th, { width: 80 }]}>Asset Tag</Text>
            <Text style={[styles.th, { width: 80, textAlign: "center" }]}>Condition</Text>
            <Text style={[styles.th, { flex: 1 }]}>Notes</Text>
          </View>

          {items.map((item, idx) => {
            const isKit = !!item.kitId && !item.isKitChild;
            const children = isKit ? (item.childLineItems || []) : [];
            return (
              <View key={item.id}>
                <View style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <View style={[styles.td, { width: 20, alignItems: "center", justifyContent: "center" }]}>
                    <Checkbox />
                  </View>
                  <Text style={[styles.td, { flex: 2 }]}>
                    {isKit
                      ? (item.description || item.kit?.name || "Kit")
                      : item.model
                        ? `${item.model.name}${item.model.modelNumber ? ` (${item.model.modelNumber})` : ""}`
                        : item.description || "—"}
                  </Text>
                  <Text style={[styles.td, { width: 30, textAlign: "center" }]}>
                    {isKit ? children.length : item.quantity}
                  </Text>
                  <Text style={[styles.td, { width: 80, fontSize: 8, fontFamily: "Courier" }]}>
                    {isKit ? (item.kit?.assetTag || "—") : (item.asset?.assetTag || item.bulkAsset?.assetTag || "—")}
                  </Text>
                  <View style={[styles.td, { width: 80, justifyContent: "center" }]}>
                    <ConditionCheckboxes />
                  </View>
                  <Text style={[styles.td, { flex: 1 }]}> </Text>
                </View>
                {children.map((child) => (
                  <View key={child.id} style={styles.tableRow}>
                    <View style={[styles.td, { width: 20, alignItems: "center", justifyContent: "center" }]}>
                      <Checkbox size={6} />
                    </View>
                    <Text style={[styles.td, { flex: 2, paddingLeft: 12, fontSize: 8, color: "#555" }]}>
                      {child.model?.name || child.description || "—"}
                    </Text>
                    <Text style={[styles.td, { width: 30, textAlign: "center", fontSize: 8 }]}>
                      {child.quantity}
                    </Text>
                    <Text style={[styles.td, { width: 80, fontSize: 7, fontFamily: "Courier", color: "#555" }]}>
                      {child.asset?.assetTag || child.bulkAsset?.assetTag || "—"}
                    </Text>
                    <View style={[styles.td, { width: 80, justifyContent: "center" }]}>
                      <ConditionCheckboxes fontSize={6} />
                    </View>
                    <Text style={[styles.td, { flex: 1 }]}> </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        {/* Sign-off */}
        <View style={{ marginTop: 40 }}>
          <View style={[styles.row, { gap: 40 }]}>
            <View style={styles.col}>
              <Text style={styles.label}>Returned By</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 30 }} />
              <Text style={[styles.value, { marginTop: 4 }]}>Name / Signature</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Received By</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 30 }} />
              <Text style={[styles.value, { marginTop: 4 }]}>Name / Signature</Text>
            </View>
            <View style={{ width: 80 }}>
              <Text style={styles.label}>Date</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 30 }} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {org.name} • {project.projectNumber} • Printed {formatDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}
