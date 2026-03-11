"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { usePlatformBranding } from "@/lib/use-platform-name";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function NoOrganizationPage() {
  const router = useRouter();
  const { name: platformName, icon: platformIcon } = usePlatformBranding();

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {platformIcon ? (
            <DynamicIcon name={platformIcon} className="h-5 w-5" />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
        </div>
        <CardTitle className="text-xl">No Organization</CardTitle>
        <CardDescription>
          You don&apos;t belong to any organizations on {platformName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">
          Contact an administrator to be invited to an organization.
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
        >
          Sign out
        </Button>
      </CardFooter>
    </Card>
  );
}
