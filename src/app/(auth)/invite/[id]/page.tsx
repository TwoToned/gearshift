"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { authClient, organization } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await organization.acceptInvitation({
        invitationId: id,
      });
      if (res.error) {
        setError(res.error.message || "Failed to accept invitation");
        return;
      }
      setAccepted(true);
      toast.success("Invitation accepted!");
      // Redirect after a moment
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (accepted) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <div>
            <h2 className="text-lg font-semibold">Invitation Accepted</h2>
            <p className="text-sm text-muted-foreground">
              Redirecting to the dashboard...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Cannot Accept Invitation</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/login")}>
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          GF
        </div>
        <CardTitle className="text-xl">Organization Invitation</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join an organization on GearFlow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          className="w-full"
          onClick={handleAccept}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accept Invitation
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Go to Login
        </Button>
      </CardContent>
    </Card>
  );
}
