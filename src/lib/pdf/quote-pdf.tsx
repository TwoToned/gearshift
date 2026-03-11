import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, formatCurrency, formatDate } from "./styles";

interface LineItem {
  id: string;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  pricingType: string;
  duration: number;
  discount: number | null;
  lineTotal: number | null;
  groupName: string | null;
  isOptional: boolean;
  isKitChild?: boolean;
  kitId?: string | null;
  pricingMode?: string | null;
  notes: string | null;
  isOverbooked?: boolean;
  model: { name: string; modelNumber?: string | null } | null;
  kit?: { assetTag: string; name: string } | null;
  childLineItems?: LineItem[];
}

interface QuotePDFProps {
  org: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    taxRate?: number;
    taxLabel?: string;
  };
  project: {
    projectNumber: string;
    name: string;
    status: string;
    rentalStartDate: string | null;
    rentalEndDate: string | null;
    loadInDate: string | null;
    eventStartDate: string | null;
    eventEndDate: string | null;
    loadOutDate: string | null;
    clientNotes: string | null;
    subtotal: number | null;
    discountPercent: number | null;
    discountAmount: number | null;
    taxAmount: number | null;
    total: number | null;
    client: {
      name: string;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      billingAddress?: string | null;
    } | null;
    location: { name: string } | null;
    lineItems: LineItem[];
  };
}

const pricingLabels: Record<string, string> = {
  PER_DAY: "/day",
  PER_WEEK: "/week",
  PER_HOUR: "/hr",
  FLAT: "flat",
};

export function QuotePDF({ org, project }: QuotePDFProps) {
  // Filter out kit children and group line items
  const topLevelItems = project.lineItems.filter((i) => !i.isKitChild);
  const groups = new Map<string, LineItem[]>();
  for (const item of topLevelItems) {
    const key = item.groupName || "_ungrouped";
    const arr = groups.get(key) || [];
    arr.push(item);
    groups.set(key, arr);
  }

  const taxLabel = org.taxLabel || "GST";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{org.name}</Text>
            <Text style={styles.companyDetails}>
              {[org.address, org.phone, org.email, org.website]
                .filter(Boolean)
                .join("\n")}
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>QUOTE</Text>
            <Text style={styles.docMeta}>
              {project.projectNumber}
              {"\n"}
              {formatDate(new Date().toISOString())}
            </Text>
          </View>
        </View>

        {/* Client + Project Info */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Client</Text>
            {project.client ? (
              <View>
                <Text style={styles.value}>{project.client.name}</Text>
                {project.client.contactName && (
                  <Text style={styles.value}>Attn: {project.client.contactName}</Text>
                )}
                {project.client.contactEmail && (
                  <Text style={styles.value}>{project.client.contactEmail}</Text>
                )}
                {project.client.billingAddress && (
                  <Text style={styles.value}>{project.client.billingAddress}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.value}>-</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Project Details</Text>
            <Text style={styles.value}>{project.name}</Text>
            {project.location && (
              <View>
                <Text style={styles.label}>Venue</Text>
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
            {project.eventStartDate && (
              <View>
                <Text style={styles.label}>Event</Text>
                <Text style={styles.value}>
                  {formatDate(project.eventStartDate)}
                  {project.eventEndDate ? ` - ${formatDate(project.eventEndDate)}` : ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Equipment &amp; Services</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 3 }]}>Description</Text>
              <Text style={[styles.th, { width: 30, textAlign: "center" }]}>Qty</Text>
              <Text style={[styles.th, { width: 60, textAlign: "right" }]}>Unit Price</Text>
              <Text style={[styles.th, { width: 30, textAlign: "center" }]}>Days</Text>
              <Text style={[styles.th, { width: 60, textAlign: "right" }]}>Total</Text>
            </View>

            {/* Rows by group */}
            {Array.from(groups.entries()).map(([groupName, items]) => (
              <View key={groupName}>
                {groupName !== "_ungrouped" && (
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{groupName}</Text>
                  </View>
                )}
                {items.map((item, idx) => {
                  const isKit = !!item.kitId && !item.isKitChild;
                  const isItemized = isKit && item.pricingMode === "ITEMIZED";
                  const children = isItemized ? (item.childLineItems || []) : [];
                  return (
                    <View key={item.id}>
                      <View style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                        <View style={{ flex: 3 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Text style={styles.td}>
                              {isKit
                                ? (item.description || item.kit?.name || "Kit")
                                : item.model
                                  ? `${item.model.name}${item.model.modelNumber ? ` (${item.model.modelNumber})` : ""}`
                                  : item.description || "-"}
                            </Text>
                            {item.isOptional && (
                              <Text style={styles.optionalBadge}>Optional</Text>
                            )}
                            {item.isOverbooked && (
                              <Text style={{ fontSize: 6, color: "#dc2626", backgroundColor: "#fee2e2", paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2, fontFamily: "Helvetica-Bold" }}>OVERBOOKED</Text>
                            )}
                          </View>
                          {item.notes && (
                            <Text style={{ fontSize: 7, color: "#888", marginTop: 1 }}>{item.notes}</Text>
                          )}
                        </View>
                        <Text style={[styles.td, { width: 30, textAlign: "center" }]}>
                          {item.quantity}
                        </Text>
                        <Text style={[styles.tdRight, { width: 60 }]}>
                          {isItemized ? "-" : item.unitPrice != null
                            ? `${formatCurrency(item.unitPrice)}${pricingLabels[item.pricingType] || ""}`
                            : "-"}
                        </Text>
                        <Text style={[styles.td, { width: 30, textAlign: "center" }]}>
                          {item.duration}
                        </Text>
                        <Text style={[styles.tdRight, { width: 60 }]}>
                          {isItemized ? "-" : formatCurrency(item.lineTotal)}
                        </Text>
                      </View>
                      {children.map((child) => (
                        <View key={child.id} style={styles.tableRow}>
                          <View style={{ flex: 3, paddingLeft: 12 }}>
                            <Text style={[styles.td, { fontSize: 8, color: "#555" }]}>
                              {child.model?.name || child.description || "-"}
                            </Text>
                          </View>
                          <Text style={[styles.td, { width: 30, textAlign: "center", fontSize: 8 }]}>
                            {child.quantity}
                          </Text>
                          <Text style={[styles.tdRight, { width: 60, fontSize: 8 }]}>
                            {child.unitPrice != null ? formatCurrency(child.unitPrice) : "-"}
                          </Text>
                          <Text style={[styles.td, { width: 30, textAlign: "center", fontSize: 8 }]}>
                            {child.duration}
                          </Text>
                          <Text style={[styles.tdRight, { width: 60, fontSize: 8 }]}>
                            {formatCurrency(child.lineTotal)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(project.subtotal)}
              </Text>
            </View>
            {project.discountAmount != null && Number(project.discountAmount) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount{project.discountPercent ? ` (${project.discountPercent}%)` : ""}
                </Text>
                <Text style={styles.totalsValue}>
                  -{formatCurrency(project.discountAmount)}
                </Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{taxLabel}</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(project.taxAmount)}
              </Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsDivider]}>
              <Text style={[styles.totalsLabel, { fontFamily: "Helvetica-Bold", fontSize: 11 }]}>
                Total
              </Text>
              <Text style={styles.totalsBold}>
                {formatCurrency(project.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {project.clientNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{project.clientNotes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {org.name} | {org.email || ""} | {org.phone || ""}
          {"\n"}This quote is valid for 30 days from the date of issue.
        </Text>
      </Page>
    </Document>
  );
}
