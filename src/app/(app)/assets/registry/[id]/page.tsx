"use client";

import { use, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Pencil, Trash2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getAsset, archiveAsset, deleteAsset, updateAssetNotes } from "@/server/assets";
import { getBulkAsset, archiveBulkAsset, deleteBulkAsset, updateBulkAssetNotes } from "@/server/bulk-assets";
import {
  addAssetMedia,
  removeAssetMedia,
  setAssetPrimaryPhoto,
} from "@/server/asset-media";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssetQRCode } from "@/components/assets/asset-qr-code";
import { MediaUploader, type MediaItem } from "@/components/media/media-uploader";
import { MediaThumbnail } from "@/components/media/media-thumbnail";
import { NotesEditor } from "@/components/ui/notes-editor";
import { resolveAssetPhotoUrl, isAssetPhotoCustom } from "@/lib/media-utils";
import { NotViewer } from "@/components/auth/permission-gate";

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-500/10 text-green-500 border-green-500/20",
  CHECKED_OUT: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  IN_MAINTENANCE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  RESERVED: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  RETIRED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  LOST: "bg-red-500/10 text-red-500 border-red-500/20",
  ACTIVE: "bg-green-500/10 text-green-500 border-green-500/20",
  LOW_STOCK: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  OUT_OF_STOCK: "bg-red-500/10 text-red-500 border-red-500/20",
};

const conditionColors: Record<string, string> = {
  NEW: "bg-green-500/10 text-green-500 border-green-500/20",
  GOOD: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  FAIR: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  POOR: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  DAMAGED: "bg-red-500/10 text-red-500 border-red-500/20",
};

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
      <AssetDetailContent params={params} />
    </Suspense>
  );
}

function AssetDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const isBulk = searchParams.get("type") === "bulk";
  const router = useRouter();
  const queryClient = useQueryClient();

  const assetQuery = useQuery({
    queryKey: ["asset", id],
    queryFn: () => getAsset(id),
    enabled: !isBulk,
  });

  const bulkQuery = useQuery({
    queryKey: ["bulk-asset", id],
    queryFn: () => getBulkAsset(id),
    enabled: isBulk,
  });

  const archiveMutation = useMutation({
    mutationFn: async () => { isBulk ? await archiveBulkAsset(id) : await archiveAsset(id); },
    onSuccess: () => {
      toast.success("Asset archived");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["bulk-assets"] });
      router.push("/assets/registry");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { isBulk ? await deleteBulkAsset(id) : await deleteAsset(id); },
    onSuccess: () => {
      toast.success("Asset deleted");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["bulk-assets"] });
      router.push("/assets/registry");
    },
    onError: (e) => toast.error(e.message),
  });

  const isLoading = isBulk ? bulkQuery.isLoading : assetQuery.isLoading;
  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  // ─── Bulk Asset Detail ───────────────────────────────────────────────
  if (isBulk) {
    const ba = bulkQuery.data;
    if (!ba) return <div className="text-muted-foreground">Bulk asset not found.</div>;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight font-mono">{ba.assetTag}</h1>
              <Badge variant="outline">Bulk</Badge>
              <Badge variant="outline" className={statusColors[ba.status] || ""}>
                {ba.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <Link href={`/assets/models/${ba.modelId}`} className="hover:underline">
                {ba.model.name}
              </Link>
              {ba.model.category && <> &middot; {ba.model.category.name}</>}
            </p>
          </div>
          <NotViewer>
            <div className="flex gap-2">
              <Button variant="outline" render={<Link href={`/assets/registry/${id}/edit?type=bulk`} />}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              {ba.isActive && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => { if (confirm("Archive this bulk asset?")) archiveMutation.mutate(); }}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              )}
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => { if (confirm("Permanently delete this bulk asset? This cannot be undone.")) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </NotViewer>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold">{ba.availableQuantity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Owned</p>
              <p className="text-2xl font-bold">{ba.totalQuantity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Price / Unit</p>
              <p className="text-2xl font-bold">
                {ba.purchasePricePerUnit ? `$${Number(ba.purchasePricePerUnit).toFixed(2)}` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="text-2xl font-bold">{ba.location?.name || "—"}</p>
            </CardContent>
          </Card>
        </div>

        <NotesEditor
          initialNotes={ba.notes || ""}
          queryKey={["bulkAsset", id]}
          onSave={(notes) => updateBulkAssetNotes(id, notes)}
          placeholder="Add notes about this bulk asset..."
        />
      </div>
    );
  }

  // ─── Serialized Asset Detail ─────────────────────────────────────────
  const asset = assetQuery.data;
  if (!asset) return <div className="text-muted-foreground">Asset not found.</div>;

  const assetPhotos = ((asset.media || []) as MediaItem[]).filter((m) => m.type === "PHOTO");
  const photoUrl = resolveAssetPhotoUrl(asset, false);
  const hasCustomPhoto = isAssetPhotoCustom(asset);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <MediaThumbnail
            url={photoUrl}
            alt={asset.assetTag}
            size={64}
            className="flex-shrink-0"
          />
          <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight font-mono">{asset.assetTag}</h1>
            <Badge variant="outline" className={statusColors[asset.status] || ""}>
              {asset.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className={conditionColors[asset.condition] || ""}>
              {asset.condition}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {asset.customName && <>{asset.customName} &middot; </>}
            <Link href={`/assets/models/${asset.modelId}`} className="hover:underline">
              {asset.model.name}
            </Link>
            {asset.model.category && <> &middot; {asset.model.category.name}</>}
          </p>
          </div>
        </div>
        <NotViewer>
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href={`/assets/registry/${id}/edit`} />}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            {asset.isActive && (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => { if (confirm("Archive this asset?")) archiveMutation.mutate(); }}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => { if (confirm("Permanently delete this asset? This cannot be undone.")) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </NotViewer>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History ({asset.lineItems.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({asset.maintenanceRecords.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="documents">Model Documents</TabsTrigger>
          <TabsTrigger value="qr">QR Code</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Asset Tag</span>
                  <span className="font-mono font-medium">{asset.assetTag}</span>
                </div>
                <div className="flex justify-between">
                  <span>Serial Number</span>
                  <span className="font-mono font-medium">{asset.serialNumber || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Custom Name</span>
                  <span className="font-medium">{asset.customName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Barcode</span>
                  <span className="font-mono font-medium">{asset.barcode || "—"}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Purchase</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Date</span>
                  <span className="font-medium">{formatDate(asset.purchaseDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price</span>
                  <span className="font-medium">
                    {asset.purchasePrice ? `$${Number(asset.purchasePrice).toFixed(2)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Supplier</span>
                  <span className="font-medium">{asset.supplier?.name || asset.purchaseSupplier || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Warranty</span>
                  <span className="font-medium">{formatDate(asset.warrantyExpiry)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Test & Tag</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {asset.testTagAsset ? (
                  <>
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="font-medium">{asset.testTagAsset.status?.replace(/_/g, " ") || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last tested</span>
                      <span className="font-medium">{formatDate(asset.testTagAsset.lastTestDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Next due</span>
                      <span className="font-medium">{formatDate(asset.testTagAsset.nextDueDate)}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      render={<Link href={`/test-and-tag/${asset.testTagAsset.id}`} />}
                    >
                      View T&T Details
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">Not registered</p>
                    {asset.model?.requiresTestAndTag && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        render={<Link href={`/test-and-tag/new?assetId=${asset.id}`} />}
                      >
                        Register for T&T
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {asset.lineItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                This asset hasn&apos;t been assigned to any projects yet.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Checked Out</TableHead>
                    <TableHead>Returned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asset.lineItems.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell>
                        <Link href={`/projects/${li.projectId}`} className="hover:underline">
                          {li.project.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{li.project.projectNumber}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{li.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(li.checkedOutAt)}</TableCell>
                      <TableCell className="text-sm">{formatDate(li.returnedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          {asset.maintenanceRecords.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No maintenance records for this asset.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asset.maintenanceRecords.map((mr) => (
                    <TableRow key={mr.id}>
                      <TableCell className="font-medium">{mr.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{mr.type.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{mr.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(mr.completedDate || mr.scheduledDate)}
                      </TableCell>
                      <TableCell>
                        {mr.result ? (
                          <Badge variant={mr.result === "PASS" ? "default" : "destructive"}>
                            {mr.result}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <NotesEditor
            initialNotes={asset.notes || ""}
            queryKey={["asset", id]}
            onSave={(notes) => updateAssetNotes(id, notes)}
            placeholder="Add notes about this asset..."
          />
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Asset Photos
                {!hasCustomPhoto && photoUrl && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Showing model photo — upload a custom photo to override
                  </span>
                )}
                {hasCustomPhoto && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Custom photo — remove to revert to model photo
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MediaUploader
                entityType="asset"
                entityId={id}
                accept="image/*"
                existingMedia={assetPhotos}
                queryKey={["asset", id]}
                onUploadComplete={async (fileUpload) => {
                  await addAssetMedia({
                    assetId: id,
                    fileId: fileUpload.id,
                    type: "PHOTO",
                  });
                }}
                onRemove={async (mediaId) => {
                  await removeAssetMedia(mediaId);
                }}
                onSetPrimary={async (mediaId) => {
                  await setAssetPrimaryPhoto(id, mediaId);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Model Documents
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  From {asset.model.name} — manage on the model page
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const modelDocs = (asset.model?.media || []).filter((m: MediaItem) => m.type !== "PHOTO");
                if (modelDocs.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No documents attached to this model.
                    </p>
                  );
                }
                return (
                  <div className="space-y-2">
                    {modelDocs.map((doc: MediaItem) => (
                      <a
                        key={doc.id}
                        href={doc.file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {doc.displayName || doc.file.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.type.replace("_", " ")} — {(doc.file.fileSize / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr" className="mt-4">
          <div className="max-w-xs">
            <AssetQRCode
              assetTag={asset.assetTag}
              label={`${asset.assetTag}${asset.customName ? ` — ${asset.customName}` : ""}`}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
