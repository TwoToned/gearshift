import { Text, View, StyleSheet } from "@react-pdf/renderer";

export const ttStyles = StyleSheet.create({
  passBadge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  failBadge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  naBadge: {
    fontSize: 7,
    color: "#999",
  },
  statusCurrent: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusDueSoon: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#fef9c3",
    color: "#854d0e",
  },
  statusOverdue: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  statusFailed: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    borderWidth: 0.5,
    borderColor: "#fca5a5",
    borderStyle: "dashed",
  },
  statusNotTested: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },
  signatureLine: {
    marginTop: 30,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
    width: 200,
    fontSize: 8,
    color: "#666",
  },
  summaryBox: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#e5e7eb",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  summaryLabel: {
    fontSize: 7,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  filterSummary: {
    fontSize: 7,
    color: "#999",
    marginBottom: 8,
  },
});

const statusStyleMap: Record<string, typeof ttStyles.statusCurrent> = {
  CURRENT: ttStyles.statusCurrent,
  DUE_SOON: ttStyles.statusDueSoon,
  OVERDUE: ttStyles.statusOverdue,
  FAILED: ttStyles.statusFailed,
  NOT_YET_TESTED: ttStyles.statusNotTested,
};

const statusLabelMap: Record<string, string> = {
  CURRENT: "Current",
  DUE_SOON: "Due Soon",
  OVERDUE: "Overdue",
  FAILED: "Failed",
  NOT_YET_TESTED: "Not Tested",
  RETIRED: "Retired",
};

export function StatusBadgePdf({ status }: { status: string }) {
  const style = statusStyleMap[status] || ttStyles.statusNotTested;
  const label = statusLabelMap[status] || status;
  return <Text style={style}>{label}</Text>;
}

export function ResultBadgePdf({ result }: { result: string }) {
  if (result === "PASS") return <Text style={ttStyles.passBadge}>Pass</Text>;
  if (result === "FAIL") return <Text style={ttStyles.failBadge}>Fail</Text>;
  if (result === "NOT_APPLICABLE") return <Text style={ttStyles.naBadge}>N/A</Text>;
  return <Text style={ttStyles.naBadge}>{result}</Text>;
}

export function SummaryBox({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <View style={ttStyles.summaryBox}>
      {items.map((item, i) => (
        <View key={i} style={ttStyles.summaryItem}>
          <Text style={ttStyles.summaryValue}>{item.value}</Text>
          <Text style={ttStyles.summaryLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function SignatureLine({ label }: { label?: string }) {
  return (
    <View style={ttStyles.signatureLine}>
      <Text>{label || "Signature: ____________________"}</Text>
    </View>
  );
}

export function FilterSummaryText({ filters }: { filters: Record<string, string | undefined> }) {
  const parts = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  if (parts.length === 0) return null;
  return <Text style={ttStyles.filterSummary}>Filters: {parts.join(" | ")}</Text>;
}

export function formatDatePdf(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export const equipmentClassLabels: Record<string, string> = {
  CLASS_I: "Class I",
  CLASS_II: "Class II",
  CLASS_II_DOUBLE_INSULATED: "Class II (DI)",
  LEAD_CORD_ASSEMBLY: "Lead/Cord",
};

export const applianceTypeLabels: Record<string, string> = {
  APPLIANCE: "Appliance",
  CORD_SET: "Cord Set",
  EXTENSION_LEAD: "Ext Lead",
  POWER_BOARD: "Power Board",
  RCD_PORTABLE: "RCD (P)",
  RCD_FIXED: "RCD (F)",
  THREE_PHASE: "3-Phase",
  OTHER: "Other",
};
