"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, organization, authClient } from "@/lib/auth-client";
import { usePlatformBranding } from "@/lib/use-platform-name";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

async function fetchUserOrgs(): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch("/api/auth/organization/list", {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data ?? [];
}

export default function LoginPage() {
  const router = useRouter();
  const { name: platformName, icon: platformIcon } = usePlatformBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        toast.error(result.error.message || "Invalid credentials");
        return;
      }

      // Check if session already has an active org
      const session = await authClient.getSession();
      const activeOrgId = session.data?.session?.activeOrganizationId;

      // Fetch user's organizations
      const orgs = await fetchUserOrgs();

      if (orgs.length === 0) {
        router.push("/onboarding");
        return;
      }

      // If already has a valid active org, just go to dashboard
      if (activeOrgId && orgs.some((o) => o.id === activeOrgId)) {
        router.push("/dashboard");
        return;
      }

      // Auto-select the first (or only) org
      await organization.setActive({ organizationId: orgs[0].id });
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          {platformIcon ? (
            <DynamicIcon name={platformIcon} className="h-5 w-5" />
          ) : (
            platformName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
          )}
        </div>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your {platformName} account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
