import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, formatDate } from "./styles";

interface LineItem {
  id: string;
  description: string | null;
  quantity: number;
  checkedOutQuantity: number;
  groupName: string | null;
  status: string;
  assetId: string | null;
  bulkAssetId: string | null;
  isKitChild?: boolean;
  kitId?: string | null;
  model: {
    name: string;
    modelNumber?: string | null;
  } | null;
  asset: { assetTag: string } | null;
  bulkAsset: { assetTag: string } | null;
  kit?: { assetTag: string; name: string } | null;
  notes: string | null;
  isOverbooked?: boolean;
  childLineItems?: LineItem[];
}

function isBulk(item: LineItem) {
  return !!item.bulkAssetId || (!item.assetId && item.quantity > 1);
}

interface DeliveryDocketPDFProps {
  org: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  project: {
    projectNumber: string;
    name: string;
    loadInDate: string | null;
    rentalStartDate: string | null;
    rentalEndDate: string | null;
    siteContactName: string | null;
    siteContactPhone: string | null;
    client: {
      name: string;
      contactName?: string | null;
      contactPhone?: string | null;
    } | null;
    location: { name: string } | null;
    lineItems: LineItem[];
  };
}

export function DeliveryDocketPDF({ org, project }: DeliveryDocketPDFProps) {
  // Only items that are actually checked out right now, exclude kit children
  const deliveredItems = project.lineItems.filter((i) => {
    if (i.isKitChild) return false;
    if (isBulk(i)) return i.checkedOutQuantity > 0;
    return i.status === "CHECKED_OUT";
  });

  // Group by groupName
  const groups = new Map<string, LineItem[]>();
  for (const item of deliveredItems) {
    const key = item.groupName || "General";
    const arr = groups.get(key) || [];
    arr.push(item);
    groups.set(key, arr);
  }

  const totalItems = deliveredItems.reduce((sum, i) => {
    if (isBulk(i)) return sum + i.checkedOutQuantity;
    return sum + 1;
  }, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{org.name}</Text>
            <Text style={styles.companyDetails}>
              {[org.address, org.phone, org.email].filter(Boolean).join("\n")}
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>DELIVERY DOCKET</Text>
            <Text style={styles.docMeta}>
              {project.projectNumber}
              {"\n"}Date: {formatDate(new Date().toISOString())}
            </Text>
          </View>
        </View>

        {/* Project & Client Info */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Delivered To</Text>
            {project.client ? (
              <View>
                <Text style={styles.value}>{project.client.name}</Text>
                {project.client.contactName && (
                  <Text style={styles.value}>Attn: {project.client.contactName}</Text>
                )}
                {project.client.contactPhone && (
                  <Text style={styles.value}>Ph: {project.client.contactPhone}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.value}>-</Text>
            )}
            {project.siteContactName && (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.label}>Site Contact</Text>
                <Text style={styles.value}>
                  {project.siteContactName}
                  {project.siteContactPhone ? ` - ${project.siteContactPhone}` : ""}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Project Details</Text>
            <Text style={styles.value}>{project.name}</Text>
            {project.location && (
              <View>
                <Text style={styles.label}>Venue / Location</Text>
                <Text style={styles.value}>{project.location.name}</Text>
              </View>
            )}
            {project.rentalStartDate && (
              <View>
                <Text style={styles.label}>Rental Period</Text>
                <Text style={styles.value}>
                  {formatDate(project.rentalStartDate)}
                  {project.rentalEndDate ? ` - ${formatDate(project.rentalEndDate)}` : ""}
                </Text>
              </View>
            )}
            <View style={{ marginTop: 4 }}>
              <Text style={styles.label}>Total Items Delivered</Text>
              <Text style={[styles.value, { fontFamily: "Helvetica-Bold" }]}>
                {totalItems}
              </Text>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={[styles.section, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>Items Delivered</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 24, textAlign: "center" }]}>#</Text>
              <Text style={[styles.th, { flex: 3 }]}>Description</Text>
              <Text style={[styles.th, { width: 40, textAlign: "center" }]}>Qty</Text>
              <Text style={[styles.th, { width: 80 }]}>Asset Tag</Text>
              <Text style={[styles.th, { width: 50, textAlign: "center" }]}>Received</Text>
            </View>

            {(() => {
              let rowNum = 0;
              return Array.from(groups.entries()).map(([groupName, items]) => (
                <View key={groupName}>
                  {groupName !== "General" && (
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupName}>{groupName}</Text>
                    </View>
                  )}
                  {items.map((item) => {
                    rowNum++;
                    const bulk = isBulk(item);
                    const isKit = !!item.kitId && !item.isKitChild;
                    const children = isKit ? (item.childLineItems || []) : [];
                    const itemName = isKit
                      ? (item.description || item.kit?.name || "Kit")
                      : item.model
                        ? `${item.model.name}${item.model.modelNumber ? ` (${item.model.modelNumber})` : ""}`
                        : item.description || "-";

                    return (
                      <View key={item.id}>
                        <View style={rowNum % 2 === 0 ? styles.tableRowAlt : styles.tableRow}>
                          <Text style={[styles.td, { width: 24, textAlign: "center", color: "#999" }]}>
                            {rowNum}
                          </Text>
                          <View style={{ flex: 3 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Text style={styles.td}>
                                {bulk ? `${item.checkedOutQuantity}x ${itemName}` : itemName}
                              </Text>
                              {item.isOverbooked && (
                                <Text style={{ fontSize: 6, color: "#dc2626", backgroundColor: "#fee2e2", paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2, fontFamily: "Helvetica-Bold" }}>OVERBOOKED</Text>
                              )}
                            </View>
                            {item.notes && (
                              <Text style={{ fontSize: 7, color: "#888", marginTop: 1 }}>{item.notes}</Text>
                            )}
                          </View>
                          <Text style={[styles.td, { width: 40, textAlign: "center" }]}>
                            {isKit ? children.length : bulk ? item.checkedOutQuantity : 1}
                          </Text>
                          <Text style={[styles.td, { width: 80, fontSize: 8, fontFamily: "Courier" }]}>
                            {isKit ? (item.kit?.assetTag || "-") : bulk ? "-" : (item.asset?.assetTag || "-")}
                          </Text>
                          <View style={[styles.td, { width: 50, alignItems: "center", justifyContent: "center" }]}>
                            <View style={{ width: 8, height: 8, borderWidth: 0.75, borderColor: "#333", borderRadius: 1 }} />
                          </View>
                        </View>
                        {children.map((child) => (
                          <View key={child.id} style={styles.tableRow}>
                            <Text style={[styles.td, { width: 24 }]}> </Text>
                            <Text style={[styles.td, { flex: 3, paddingLeft: 12, fontSize: 8, color: "#555" }]}>
                              {child.model?.name || child.description || "-"}
                            </Text>
                            <Text style={[styles.td, { width: 40, textAlign: "center", fontSize: 8 }]}>
                              {child.quantity}
                            </Text>
                            <Text style={[styles.td, { width: 80, fontSize: 7, fontFamily: "Courier", color: "#555" }]}>
                              {child.asset?.assetTag || child.bulkAsset?.assetTag || "-"}
                            </Text>
                            <View style={[styles.td, { width: 50, alignItems: "center", justifyContent: "center" }]}>
                            <View style={{ width: 8, height: 8, borderWidth: 0.75, borderColor: "#333", borderRadius: 1 }} />
                          </View>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              ));
            })()}
          </View>
        </View>

        {/* Condition Notes */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Notes / Discrepancies</Text>
          <View style={{ borderWidth: 0.5, borderColor: "#ddd", borderRadius: 3, minHeight: 50, padding: 6 }}>
            <Text style={{ fontSize: 8, color: "#ccc" }}> </Text>
          </View>
        </View>

        {/* Acknowledgement & Signatures */}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.notes, { marginBottom: 8 }]}>
            By signing below, the recipient acknowledges receipt of the above items in good working
            condition and accepts responsibility for the equipment until it is returned to {org.name}.
            Any damage, loss, or theft must be reported immediately.
          </Text>

          <View style={[styles.row, { gap: 30, marginTop: 16 }]}>
            <View style={styles.col}>
              <Text style={styles.label}>Delivered By ({org.name})</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 30 }} />
              <Text style={[styles.value, { marginTop: 4 }]}>Print Name</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 20 }} />
              <Text style={[styles.value, { marginTop: 4 }]}>Signature</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Received By (Client)</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 30 }} />
              <Text style={[styles.value, { marginTop: 4 }]}>Print Name</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 20 }} />
              <Text style={[styles.value, { marginTop: 4 }]}>Signature</Text>
            </View>
            <View style={{ width: 80 }}>
              <Text style={styles.label}>Date</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 30 }} />
              <Text style={styles.label}>{"\n"}Time</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 20 }} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {org.name} | {org.email || ""} | {org.phone || ""}
          {"\n"}Ref: {project.projectNumber}
        </Text>
      </Page>
    </Document>
  );
}
