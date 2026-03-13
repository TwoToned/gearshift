"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useActiveOrganization } from "@/lib/auth-client";
import { createCategory, getCategories } from "@/server/categories";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxPicker } from "@/components/ui/combobox-picker";
import { Loader2 } from "lucide-react";

interface QuickCreateCategoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function QuickCreateCategory({ open, onOpenChange, onCreated }: QuickCreateCategoryProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", orgId],
    queryFn: () => getCategories(),
    staleTime: 0,
  });

  // Only top-level categories can be parents (keep it to one level of nesting)
  const parentOptions = categories
    .filter((cat) => !cat.parentId)
    .map((cat) => ({
      value: cat.id,
      label: cat.name,
    }));

  const mutation = useMutation({
    mutationFn: () => createCategory({ name, parentId: parentId || undefined }),
    onSuccess: async (result) => {
      toast.success("Category created");
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      onCreated?.(result.id);
      onOpenChange(false);
      setName("");
      setParentId("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="quick-cat-name">Name</Label>
            <Input
              id="quick-cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Microphones"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  e.preventDefault();
                  mutation.mutate();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Parent Category</Label>
            <ComboboxPicker
              value={parentId}
              onChange={setParentId}
              options={parentOptions}
              placeholder="None (top-level)"
              searchPlaceholder="Search categories..."
              allowClear
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
