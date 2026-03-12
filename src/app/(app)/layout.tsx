import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { DynamicFavicon } from "@/components/layout/dynamic-favicon";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ViewportHeight } from "@/components/layout/viewport-height";
import { BrandingProvider } from "@/components/providers/branding-provider";
import { getSession } from "@/lib/auth-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // If user has no active org, check if they belong to any
  if (!session.session.activeOrganizationId) {
    const { prisma } = await import("@/lib/prisma");
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      redirect("/no-organization");
    }

    // They have a membership but no active org set — this shouldn't normally happen
    // but let them through so the org switcher can resolve it
  }

  return (
    <div className="app-shell flex flex-col overflow-hidden md:block md:h-auto md:min-h-svh md:overflow-visible">
      <ViewportHeight />
      <SidebarProvider className="min-h-0 flex-1 md:min-h-svh">
        <BrandingProvider>
          <DynamicFavicon />
          <AppSidebar />
          <SidebarInset className="min-h-0">
            <TopBar />
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </SidebarInset>
        </BrandingProvider>
      </SidebarProvider>
      <MobileNav />
    </div>
  );
}
