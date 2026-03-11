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

interface InvoicePDFProps {
  org: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxRate?: number;
    taxLabel?: string;
  };
  project: {
    projectNumber: string;
    name: string;
    rentalStartDate: string | null;
    rentalEndDate: string | null;
    subtotal: number | null;
    discountPercent: number | null;
    discountAmount: number | null;
    taxAmount: number | null;
    total: number | null;
    depositPaid: number | null;
    client: {
      name: string;
      contactName?: string | null;
      contactEmail?: string | null;
      billingAddress?: string | null;
      taxId?: string | null;
      paymentTerms?: string | null;
    } | null;
    lineItems: LineItem[];
  };
}

const pricingLabels: Record<string, string> = {
  PER_DAY: "/day",
  PER_WEEK: "/week",
  PER_HOUR: "/hr",
  FLAT: "flat",
};

export function InvoicePDF({ org, project }: InvoicePDFProps) {
  const taxLabel = org.taxLabel || "GST";
  const totalNum = Number(project.total) || 0;
  const depositNum = Number(project.depositPaid) || 0;
  const balanceDue = totalNum - depositNum;

  // Only include non-optional confirmed items, exclude kit children
  const invoiceItems = project.lineItems.filter((i) => !i.isOptional && !i.isKitChild);

  const groups = new Map<string, LineItem[]>();
  for (const item of invoiceItems) {
    const key = item.groupName || "_ungrouped";
    const arr = groups.get(key) || [];
    arr.push(item);
    groups.set(key, arr);
  }

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
            <Text style={styles.docTitle}>INVOICE</Text>
            <Text style={styles.docMeta}>
              {project.projectNumber}
              {"\n"}Date: {formatDate(new Date().toISOString())}
              {"\n"}
              {project.client?.paymentTerms
                ? `Terms: ${project.client.paymentTerms}`
                : "Terms: Due on receipt"}
            </Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            {project.client ? (
              <View>
                <Text style={styles.value}>{project.client.name}</Text>
                {project.client.contactName && (
                  <Text style={styles.value}>Attn: {project.client.contactName}</Text>
                )}
                {project.client.billingAddress && (
                  <Text style={styles.value}>{project.client.billingAddress}</Text>
                )}
                {project.client.taxId && (
                  <Text style={styles.value}>ABN: {project.client.taxId}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.value}>-</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Project</Text>
            <Text style={styles.value}>{project.name}</Text>
            {project.rentalStartDate && (
              <View>
                <Text style={styles.label}>Rental Period</Text>
                <Text style={styles.value}>
                  {formatDate(project.rentalStartDate)}
                  {project.rentalEndDate ? ` - ${formatDate(project.rentalEndDate)}` : ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Line Items */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 3 }]}>Description</Text>
              <Text style={[styles.th, { width: 30, textAlign: "center" }]}>Qty</Text>
              <Text style={[styles.th, { width: 60, textAlign: "right" }]}>Rate</Text>
              <Text style={[styles.th, { width: 30, textAlign: "center" }]}>Days</Text>
              <Text style={[styles.th, { width: 60, textAlign: "right" }]}>Amount</Text>
            </View>

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
                          <Text style={[styles.td, { flex: 3, paddingLeft: 12, fontSize: 8, color: "#555" }]}>
                            {child.model?.name || child.description || "-"}
                          </Text>
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
              <Text style={styles.totalsValue}>{formatCurrency(project.subtotal)}</Text>
            </View>
            {project.discountAmount != null && Number(project.discountAmount) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount{project.discountPercent ? ` (${project.discountPercent}%)` : ""}
                </Text>
                <Text style={styles.totalsValue}>-{formatCurrency(project.discountAmount)}</Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{taxLabel}</Text>
              <Text style={styles.totalsValue}>{formatCurrency(project.taxAmount)}</Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsDivider]}>
              <Text style={[styles.totalsLabel, { fontFamily: "Helvetica-Bold", fontSize: 11 }]}>
                Total
              </Text>
              <Text style={styles.totalsBold}>{formatCurrency(project.total)}</Text>
            </View>
            {depositNum > 0 && (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Deposit Paid</Text>
                  <Text style={styles.totalsValue}>-{formatCurrency(depositNum)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={[styles.totalsLabel, { fontFamily: "Helvetica-Bold" }]}>
                    Balance Due
                  </Text>
                  <Text style={[styles.totalsValue, { fontFamily: "Helvetica-Bold" }]}>
                    {formatCurrency(balanceDue)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {org.name} | {org.email || ""} | {org.phone || ""}
          {"\n"}Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
}
