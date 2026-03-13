"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsViewer } from "@/lib/use-permissions";

interface NotesEditorProps {
  title?: string;
  initialNotes: string;
  queryKey: unknown[];
  onSave: (notes: string) => Promise<unknown>;
  placeholder?: string;
  rows?: number;
}

export function NotesEditor({
  title = "Notes",
  initialNotes,
  queryKey,
  onSave,
  placeholder = "Add notes...",
  rows = 6,
}: NotesEditorProps) {
  const isViewer = useIsViewer();
  const [notes, setNotes] = useState(initialNotes);
  const queryClient = useQueryClient();
  const hasChanges = notes !== initialNotes;

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const mutation = useMutation({
    mutationFn: () => onSave(notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${title} saved`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isViewer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {initialNotes || "No notes."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !hasChanges}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
      </CardContent>
    </Card>
  );
}
