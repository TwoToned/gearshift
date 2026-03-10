"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  CalendarClock,
  PackageX,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotifications, type AppNotification } from "@/server/notifications";
import { formatDistanceToNow } from "date-fns";

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  overdue_maintenance: Wrench,
  overdue_return: PackageX,
  upcoming_project: CalendarClock,
  low_stock: AlertTriangle,
};

const severityColors: Record<string, string> = {
  error: "text-destructive",
  warning: "text-amber-500",
  info: "text-blue-500",
};

export function Notifications() {
  const router = useRouter();
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 60_000, // refresh every minute
  });

  const count = notifications?.length || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {count === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              All clear — no notifications.
            </div>
          ) : (
            (notifications as AppNotification[]).slice(0, 10).map((n) => {
              const Icon = typeIcons[n.type] || Bell;
              return (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => router.push(n.href)}
                  className="flex items-start gap-3 py-2.5"
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${severityColors[n.severity] || ""}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
