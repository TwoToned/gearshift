/**
 * Human-readable labels for all enum values displayed in the UI.
 * Use `formatLabel(enumValue)` as a fallback for any enum not listed here.
 */

// --- Asset Status ---
export const assetStatusLabels: Record<string, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Deployed",
  IN_MAINTENANCE: "In Maintenance",
  RETIRED: "Retired",
  LOST: "Lost",
  RESERVED: "Reserved",
};

// --- Bulk Asset Status ---
export const bulkAssetStatusLabels: Record<string, string> = {
  ACTIVE: "Active",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  RETIRED: "Retired",
};

// --- Kit Status ---
export const kitStatusLabels: Record<string, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Deployed",
  IN_MAINTENANCE: "In Maintenance",
  RETIRED: "Retired",
  INCOMPLETE: "Incomplete",
};

// --- Project Status ---
export const projectStatusLabels: Record<string, string> = {
  ENQUIRY: "Enquiry",
  QUOTING: "Quoting",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  PREPPING: "Prepping",
  CHECKED_OUT: "Deployed",
  ON_SITE: "On Site",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  INVOICED: "Invoiced",
  CANCELLED: "Cancelled",
};

// --- Line Item Status ---
export const lineItemStatusLabels: Record<string, string> = {
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  PREPPED: "Prepped",
  CHECKED_OUT: "Deployed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

// --- Maintenance Status ---
export const maintenanceStatusLabels: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// --- Maintenance Type ---
export const maintenanceTypeLabels: Record<string, string> = {
  REPAIR: "Repair",
  PREVENTATIVE: "Preventative",
  TEST_AND_TAG: "Test & Tag",
  INSPECTION: "Inspection",
  CLEANING: "Cleaning",
  FIRMWARE_UPDATE: "Firmware Update",
};

// --- Supplier Order Status ---
export const supplierOrderStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  ORDERED: "Ordered",
  PARTIAL: "Partial",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

// --- Media Type ---
export const mediaTypeLabels: Record<string, string> = {
  PHOTO: "Photo",
  MANUAL: "Manual",
  SPEC_SHEET: "Spec Sheet",
  WIRING_DIAGRAM: "Wiring Diagram",
  DOCUMENT: "Document",
  OTHER: "Other",
};

// --- Project Media Type ---
export const projectMediaTypeLabels: Record<string, string> = {
  FLOOR_PLAN: "Floor Plan",
  QUOTE: "Quote",
  INVOICE: "Invoice",
  SITE_MAP: "Site Map",
  RISK_ASSESSMENT: "Risk Assessment",
  CLIENT_BRIEF: "Client Brief",
  CAD: "CAD",
  CONTRACT: "Contract",
  PHOTO: "Photo",
  OTHER: "Other",
};

// --- Asset Condition ---
export const conditionLabels: Record<string, string> = {
  NEW: "New",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
  DAMAGED: "Damaged",
};

// --- Client Type ---
export const clientTypeLabels: Record<string, string> = {
  COMPANY: "Company",
  INDIVIDUAL: "Individual",
  VENUE: "Venue",
  PRODUCTION_COMPANY: "Production Company",
};

// --- Location Type ---
export const locationTypeLabels: Record<string, string> = {
  WAREHOUSE: "Warehouse",
  VENUE: "Venue",
  VEHICLE: "Vehicle",
  OFFSITE: "Offsite",
};

/**
 * Generic fallback: converts ANY_ENUM_VALUE to "Any Enum Value".
 * Use the specific label maps above when possible.
 */
export function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
