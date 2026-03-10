import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  companyName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#0d4f4f",
  },
  companyDetails: {
    fontSize: 8,
    color: "#666",
    lineHeight: 1.5,
  },
  docTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0d4f4f",
    textAlign: "right",
  },
  docMeta: {
    fontSize: 9,
    color: "#666",
    textAlign: "right",
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#0d4f4f",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    gap: 24,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 7,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    fontSize: 9,
    marginBottom: 6,
  },
  // Table
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#fafafa",
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: "#666",
  },
  td: {
    fontSize: 9,
  },
  tdRight: {
    fontSize: 9,
    textAlign: "right",
  },
  groupHeader: {
    flexDirection: "row",
    backgroundColor: "#eef7f7",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  groupName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#0d4f4f",
  },
  // Totals
  totalsContainer: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 200,
    paddingVertical: 2,
  },
  totalsLabel: {
    fontSize: 9,
    color: "#666",
    flex: 1,
  },
  totalsValue: {
    fontSize: 9,
    textAlign: "right",
    width: 80,
  },
  totalsBold: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    width: 80,
  },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: "#0d4f4f",
    marginTop: 4,
    paddingTop: 4,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#999",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#eee",
    paddingTop: 8,
  },
  // Notes
  notes: {
    fontSize: 8,
    color: "#666",
    lineHeight: 1.5,
    marginTop: 4,
  },
  badge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#e5e5e5",
    color: "#666",
  },
  optionalBadge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
});

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
