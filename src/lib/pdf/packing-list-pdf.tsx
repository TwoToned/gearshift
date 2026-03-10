import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, formatDate } from "./styles";

interface LineItem {
  id: string;
  description: string | null;
  quantity: number;
  groupName: string | null;
  status: string;
  isKitChild?: boolean;
  kitId?: string | null;
  model: {
    name: string;
    modelNumber?: string | null;
    weight?: number | null;
    category?: { name: string } | null;
  } | null;
  asset: { assetTag: string } | null;
  bulkAsset: { assetTag: string } | null;
  kit?: { assetTag: string; name: string } | null;
  childLineItems?: LineItem[];
}

interface PackingListPDFProps {
  org: { name: string };
  project: {
    projectNumber: string;
    name: string;
    loadInDate: string | null;
    rentalStartDate: string | null;
    client: { name: string } | null;
    location: { name: string } | null;
    lineItems: LineItem[];
  };
}

export function PackingListPDF({ org, project }: PackingListPDFProps) {
  // Filter out kit children (they'll be rendered under their parent)
  const equipmentItems = project.lineItems.filter(
    (i) => i.status !== "CANCELLED" && !i.isKitChild
  );

  // Group by groupName
  const groups = new Map<string, LineItem[]>();
  for (const item of equipmentItems) {
    const key = item.groupName || "Ungrouped";
    const arr = groups.get(key) || [];
    arr.push(item);
    groups.set(key, arr);
  }

  const totalItems = equipmentItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalWeight = equipmentItems.reduce((sum, i) => {
    const w = i.model?.weight ? Number(i.model.weight) : 0;
    return sum + w * i.quantity;
  }, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{org.name}</Text>
            <Text style={styles.companyDetails}>Packing List</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>PACKING LIST</Text>
            <Text style={styles.docMeta}>
              {project.projectNumber}
              {"\n"}{project.name}
              {project.client ? `\n${project.client.name}` : ""}
            </Text>
          </View>
        </View>

        {/* Info row */}
        <View style={[styles.row, { marginBottom: 12 }]}>
          {project.location && (
            <View style={styles.col}>
              <Text style={styles.label}>Venue</Text>
              <Text style={styles.value}>{project.location.name}</Text>
            </View>
          )}
          {project.loadInDate && (
            <View style={styles.col}>
              <Text style={styles.label}>Load In</Text>
              <Text style={styles.value}>{formatDate(project.loadInDate)}</Text>
            </View>
          )}
          <View style={styles.col}>
            <Text style={styles.label}>Total Items</Text>
            <Text style={styles.value}>{totalItems}</Text>
          </View>
          {totalWeight > 0 && (
            <View style={styles.col}>
              <Text style={styles.label}>Est. Weight</Text>
              <Text style={styles.value}>{totalWeight.toFixed(1)} kg</Text>
            </View>
          )}
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: 20, textAlign: "center" }]}>✓</Text>
            <Text style={[styles.th, { flex: 3 }]}>Item</Text>
            <Text style={[styles.th, { width: 30, textAlign: "center" }]}>Qty</Text>
            <Text style={[styles.th, { width: 80 }]}>Asset Tag</Text>
            <Text style={[styles.th, { width: 70 }]}>Category</Text>
          </View>

          {Array.from(groups.entries()).map(([groupName, items]) => (
            <View key={groupName}>
              {groupName !== "Ungrouped" && (
                <View style={styles.groupHeader}>
                  <Text style={styles.groupName}>{groupName}</Text>
                </View>
              )}
              {items.map((item, idx) => {
                const isKit = !!item.kitId && !item.isKitChild;
                const children = isKit ? (item.childLineItems || []) : [];
                return (
                  <View key={item.id}>
                    <View style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                      <View style={[styles.td, { width: 20, alignItems: "center", justifyContent: "center" }]}>
                        <View style={{ width: 7, height: 7, borderWidth: 0.75, borderColor: "#333", borderRadius: 1 }} />
                      </View>
                      <Text style={[styles.td, { flex: 3 }]}>
                        {isKit
                          ? `🧳 ${item.description || item.kit?.name || "Kit"}`
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
                      <Text style={[styles.td, { width: 70, fontSize: 8, color: "#888" }]}>
                        {item.model?.category?.name || "—"}
                      </Text>
                    </View>
                    {children.map((child) => (
                      <View key={child.id} style={styles.tableRow}>
                        <View style={[styles.td, { width: 20, alignItems: "center", justifyContent: "center" }]}>
                        <View style={{ width: 7, height: 7, borderWidth: 0.75, borderColor: "#333", borderRadius: 1 }} />
                      </View>
                        <Text style={[styles.td, { flex: 3, paddingLeft: 12, fontSize: 8, color: "#555" }]}>
                          {child.model?.name || child.description || "—"}
                        </Text>
                        <Text style={[styles.td, { width: 30, textAlign: "center", fontSize: 8 }]}>
                          {child.quantity}
                        </Text>
                        <Text style={[styles.td, { width: 80, fontSize: 7, fontFamily: "Courier", color: "#555" }]}>
                          {child.asset?.assetTag || child.bulkAsset?.assetTag || "—"}
                        </Text>
                        <Text style={[styles.td, { width: 70, fontSize: 7, color: "#aaa" }]}>
                          {child.model?.category?.name || ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {org.name} • {project.projectNumber} • Printed {formatDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}
