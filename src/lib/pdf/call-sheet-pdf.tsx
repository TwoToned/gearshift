import { Document, Page, Text, View } from "@react-pdf/renderer";
import { createStyles, formatDate, type PdfBranding } from "./styles";
import { PdfHeader } from "./pdf-header";

interface CrewEntry {
  name: string;
  role: string | null;
  phase: string | null;
  callTime: string | null;
  endTime: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
}

interface CallSheetPDFProps {
  org: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    branding?: PdfBranding;
    logoData?: string | null;
    iconData?: string | null;
  };
  project: {
    projectNumber: string;
    name: string;
    date: string;
    location: string | null;
    locationAddress: string | null;
    siteContactName: string | null;
    siteContactPhone: string | null;
    siteContactEmail: string | null;
    crewNotes: string | null;
    crew: CrewEntry[];
  };
}

const phaseLabels: Record<string, string> = {
  BUMP_IN: "Bump In",
  EVENT: "Event",
  BUMP_OUT: "Bump Out",
  DELIVERY: "Delivery",
  PICKUP: "Pickup",
  SETUP: "Setup",
  REHEARSAL: "Rehearsal",
  FULL_DURATION: "Full Duration",
};

export function CallSheetPDF({ org, project }: CallSheetPDFProps) {
  const s = createStyles(org.branding);

  // Sort by call time, then role
  const sorted = [...project.crew].sort((a, b) => {
    const timeA = a.callTime || "99:99";
    const timeB = b.callTime || "99:99";
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return (a.role || "").localeCompare(b.role || "");
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <PdfHeader
          orgName={org.name}
          orgDetails={[org.address, org.phone, org.email].filter(Boolean).join("\n")}
          docTitle="CALL SHEET"
          docMeta={`${project.projectNumber}\n${formatDate(project.date)}`}
          branding={org.branding}
          logoData={org.logoData}
          iconData={org.iconData}
          styles={s}
        />

        {/* Project info row */}
        <View style={s.row}>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Project</Text>
            <Text style={[s.value, { fontFamily: "Helvetica-Bold" }]}>
              {project.name}
            </Text>
            <Text style={s.value}>Date: {formatDate(project.date)}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Location</Text>
            <Text style={s.value}>{project.location || "-"}</Text>
            {project.locationAddress && (
              <Text style={[s.value, { fontSize: 7 }]}>
                {project.locationAddress}
              </Text>
            )}
          </View>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Site Contact</Text>
            {project.siteContactName ? (
              <View>
                <Text style={s.value}>{project.siteContactName}</Text>
                {project.siteContactPhone && (
                  <Text style={s.value}>Ph: {project.siteContactPhone}</Text>
                )}
                {project.siteContactEmail && (
                  <Text style={s.value}>{project.siteContactEmail}</Text>
                )}
              </View>
            ) : (
              <Text style={s.value}>-</Text>
            )}
          </View>
        </View>

        {/* Crew table */}
        <View style={[s.section, { marginTop: 12 }]}>
          <Text style={s.sectionTitle}>
            Crew ({sorted.length} {sorted.length === 1 ? "person" : "people"})
          </Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: 24, textAlign: "center" }]}>#</Text>
              <Text style={[s.th, { flex: 2 }]}>Name</Text>
              <Text style={[s.th, { flex: 1.5 }]}>Role</Text>
              <Text style={[s.th, { width: 70 }]}>Phase</Text>
              <Text style={[s.th, { width: 50, textAlign: "center" }]}>
                Call
              </Text>
              <Text style={[s.th, { width: 50, textAlign: "center" }]}>
                Wrap
              </Text>
              <Text style={[s.th, { flex: 1.2 }]}>Phone</Text>
              <Text style={[s.th, { flex: 1.5 }]}>Notes</Text>
            </View>

            {sorted.map((crew, idx) => (
              <View
                key={idx}
                style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}
              >
                <Text
                  style={[
                    s.td,
                    { width: 24, textAlign: "center", color: "#999" },
                  ]}
                >
                  {idx + 1}
                </Text>
                <Text style={[s.td, { flex: 2, fontFamily: "Helvetica-Bold" }]}>
                  {crew.name}
                </Text>
                <Text style={[s.td, { flex: 1.5 }]}>{crew.role || "-"}</Text>
                <Text style={[s.td, { width: 70, fontSize: 7 }]}>
                  {crew.phase ? phaseLabels[crew.phase] || crew.phase : "-"}
                </Text>
                <Text
                  style={[
                    s.td,
                    {
                      width: 50,
                      textAlign: "center",
                      fontFamily: "Helvetica-Bold",
                    },
                  ]}
                >
                  {crew.callTime || "-"}
                </Text>
                <Text style={[s.td, { width: 50, textAlign: "center" }]}>
                  {crew.endTime || "-"}
                </Text>
                <Text style={[s.td, { flex: 1.2, fontSize: 8 }]}>
                  {crew.phone || "-"}
                </Text>
                <Text style={[s.td, { flex: 1.5, fontSize: 7 }]}>
                  {crew.notes || ""}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Crew notes */}
        {project.crewNotes && (
          <View style={[s.section, { marginTop: 8 }]}>
            <Text style={s.sectionTitle}>Notes</Text>
            <Text style={s.notes}>{project.crewNotes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={s.footer}>
          {org.name} | {org.email || ""} | {org.phone || ""}
          {"\n"}Ref: {project.projectNumber} | Generated{" "}
          {formatDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}
