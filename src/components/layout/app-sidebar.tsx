"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Boxes,
  FolderOpen,
  Users,
  MapPin,
  Wrench,
  BarChart3,
  Settings,
  CalendarRange,
  Warehouse,
  Container,
  ShieldCheck,
  BookTemplate,
  type LucideIcon,
} from "lucide-react";
import { usePlatformBranding } from "@/lib/use-platform-name";
import { useCurrentRole } from "@/lib/use-permissions";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import type { Resource } from "@/lib/permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { UserNav } from "./user-nav";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Resource key — if set, item is hidden when user has no access to this resource */
  resource?: Resource;
  items?: { title: string; url: string; icon: LucideIcon; resource?: Resource }[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Assets",
    url: "/assets/registry",
    icon: Package,
    resource: "asset",
    items: [
      { title: "Models", url: "/assets/models", icon: Boxes, resource: "model" },
      { title: "Kits", url: "/kits", icon: Container, resource: "kit" },
      { title: "Availability", url: "/assets/availability", icon: CalendarRange, resource: "asset" },
    ],
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderOpen,
    resource: "project",
    items: [
      { title: "Templates", url: "/projects/templates", icon: BookTemplate, resource: "project" },
    ],
  },
  {
    title: "Warehouse",
    url: "/warehouse",
    icon: Warehouse,
    resource: "warehouse",
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    resource: "client",
  },
  {
    title: "Locations",
    url: "/locations",
    icon: MapPin,
    resource: "location",
  },
  {
    title: "Maintenance",
    url: "/maintenance",
    icon: Wrench,
    resource: "maintenance",
  },
  {
    title: "Test & Tag",
    url: "/test-and-tag",
    icon: ShieldCheck,
    resource: "testTag",
    items: [
      { title: "Registry", url: "/test-and-tag/registry", icon: Package, resource: "testTag" },
      { title: "Quick Test", url: "/test-and-tag/quick-test", icon: ShieldCheck, resource: "testTag" },
      { title: "Reports", url: "/test-and-tag/reports", icon: BarChart3, resource: "reports" },
    ],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    resource: "reports",
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { name: platformName, icon: platformIcon } = usePlatformBranding();
  const { permissions, isLoading } = useCurrentRole();
  const initials = platformName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  /** Check if user has ANY permission (including "read") for a resource */
  const hasAccess = (resource?: Resource): boolean => {
    if (!resource) return true; // no resource restriction (e.g. dashboard)
    if (isLoading || !permissions) return true; // show while loading (avoid flash)
    const actions = permissions[resource];
    return !!actions && actions.length > 0;
  };

  const visibleItems = navItems.filter((item) => {
    if (!hasAccess(item.resource)) return false;
    return true;
  });

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            {platformIcon ? (
              <DynamicIcon name={platformIcon} className="h-4 w-4" />
            ) : (
              initials
            )}
          </div>
          <span className="font-semibold text-lg tracking-tight">{platformName}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const visibleSubs = item.items?.filter((sub) => hasAccess(sub.resource));

                return visibleSubs && visibleSubs.length > 0 ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url!} />}
                      isActive={pathname === item.url || pathname.startsWith(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      {visibleSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton
                            render={<Link href={sub.url} />}
                            isActive={pathname === sub.url || pathname.startsWith(sub.url + "/")}
                          >
                            <sub.icon className="h-4 w-4" />
                            <span>{sub.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={pathname === item.url}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {(hasAccess("orgSettings") || hasAccess("orgMembers")) && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  isActive={pathname.startsWith("/settings")}
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <UserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
