"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { clientSchema, type ClientFormValues } from "@/lib/validations/client";
import { createClient, updateClient } from "@/server/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClientFormProps {
  initialData?: ClientFormValues & { id: string };
}

export function ClientForm({ initialData }: ClientFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData || {
      name: "",
      type: "COMPANY",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      billingAddress: "",
      shippingAddress: "",
      taxId: "",
      paymentTerms: "",
      defaultDiscount: undefined,
      notes: "",
      tags: [],
      isActive: true,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ClientFormValues) =>
      isEditing ? updateClient(initialData.id, data) : createClient(data),
    onSuccess: (result) => {
      toast.success(isEditing ? "Client updated" : "Client created");
      router.push(`/clients/${result.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...form.register("name")} placeholder="e.g. Acme Productions" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              {...form.register("type")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="COMPANY">Company</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="VENUE">Venue</option>
              <option value="PRODUCTION_COMPANY">Production Company</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact Name</Label>
            <Input id="contactName" {...form.register("contactName")} placeholder="Primary contact person" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input id="contactEmail" type="email" {...form.register("contactEmail")} placeholder="email@example.com" />
            {form.formState.errors.contactEmail && (
              <p className="text-xs text-destructive">{form.formState.errors.contactEmail.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input id="contactPhone" {...form.register("contactPhone")} placeholder="+61 400 000 000" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="billingAddress">Billing Address</Label>
            <Textarea id="billingAddress" {...form.register("billingAddress")} placeholder="Billing address" rows={2} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shippingAddress">Shipping Address</Label>
            <Textarea id="shippingAddress" {...form.register("shippingAddress")} placeholder="Shipping address (if different)" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">ABN</Label>
            <Input id="taxId" {...form.register("taxId")} placeholder="e.g. 12 345 678 901" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentTerms">Payment Terms</Label>
            <Input id="paymentTerms" {...form.register("paymentTerms")} placeholder="e.g. Net 30" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultDiscount">Default Discount (%)</Label>
            <Input
              id="defaultDiscount"
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...form.register("defaultDiscount")}
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Additional</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...form.register("notes")} placeholder="Any additional notes" rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Update Client" : "Create Client"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
