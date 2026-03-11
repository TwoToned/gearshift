import { Text, View, Image } from "@react-pdf/renderer";
import type { PdfBranding } from "./styles";

interface PdfHeaderProps {
  orgName: string;
  orgDetails?: string;
  docTitle: string;
  docMeta: string;
  branding?: PdfBranding;
  logoData?: string | null;
  iconData?: string | null;
  styles: ReturnType<typeof import("./styles").createStyles>;
}

export function PdfHeader({
  orgName,
  orgDetails,
  docTitle,
  docMeta,
  branding,
  logoData,
  iconData,
  styles: s,
}: PdfHeaderProps) {
  const mode = branding?.documentLogoMode || "icon";
  const showLogo = mode === "logo" && logoData;
  const showIcon = mode === "icon" && (iconData || logoData);
  const iconSrc = iconData || logoData;
  const showOrgName = branding?.showOrgNameOnDocuments !== false;

  return (
    <View>
      {/* Logo mode: logo + doc title on the same row, above company info */}
      {showLogo ? (
        <View style={s.logoRow}>
          <Image src={logoData!} style={s.logoImage} />
          <View>
            <Text style={s.docTitle}>{docTitle}</Text>
            <Text style={s.docMeta}>{docMeta}</Text>
          </View>
        </View>
      ) : null}

      {/* Main header row */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          {showIcon ? (
            <Image src={iconSrc!} style={s.iconImage} />
          ) : null}
          <View>
            {showOrgName ? (
              <Text style={s.companyName}>{orgName}</Text>
            ) : null}
            {orgDetails ? (
              <Text style={s.companyDetails}>{orgDetails}</Text>
            ) : null}
          </View>
        </View>
        {/* Doc title on the right — only when NOT in logo mode (logo mode puts it in the row above) */}
        {!showLogo ? (
          <View>
            <Text style={s.docTitle}>{docTitle}</Text>
            <Text style={s.docMeta}>{docMeta}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
