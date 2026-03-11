# Extension Prompt — Media & File Attachments

## Context

This is an extension to the existing GearFlow asset/rental management platform. The core system (models, assets, kits, projects, warehouse scanning, availability engine) is already implemented. This prompt adds **media uploads and file attachments** across the platform — model photos, asset photos, kit photos, model manuals/documents, and project file attachments.

---

## Overview

The platform needs a unified file/media system that supports:

1. **Model photos** — a primary image and optional additional images for equipment models
2. **Model file attachments** — manuals, spec sheets, data sheets, wiring diagrams (PDFs, etc.)
3. **Asset photos** — serialized assets inherit the parent model's photo by default, but can have a custom override photo (e.g. showing damage, custom labelling, or identifying features)
4. **Kit photos** — primary photo and additional images (open case, closed case, label, contents layout)
5. **Project file attachments** — floor plans, Xero quotes/invoices, site maps, risk assessments, client briefs, CAD files, any miscellaneous documents

---

## Data Model

### New Model: `FileUpload`

A single unified table for all uploaded files across the platform. Every uploaded file gets a record here.

```
FileUpload
- id                    String (cuid)
- organizationId        String → Organization
- fileName              String (original file name, e.g., "SM58-manual.pdf")
- fileSize              Int (bytes)
- mimeType              String (e.g., "image/jpeg", "application/pdf")
- storageKey             String (path/key in storage, e.g., "org_abc123/models/clxyz/photo-1.jpg")
- url                   String (public or signed URL to access the file)
- thumbnailUrl          String? (auto-generated thumbnail for images — null for non-image files)
- width                 Int? (image width in px — null for non-image files)
- height                Int? (image height in px — null for non-image files)
- uploadedBy            String → User
- createdAt             DateTime
- updatedAt             DateTime
```

### New Model: `ModelMedia`

Join table linking files to models with a defined purpose.

```
ModelMedia
- id                    String (cuid)
- organizationId        String → Organization
- modelId               String → Model
- fileId                String → FileUpload
- type                  Enum: PHOTO, MANUAL, SPEC_SHEET, WIRING_DIAGRAM, OTHER
- isPrimary             Boolean (default false — only one photo should be primary per model)
- displayName           String? (optional override label, e.g., "Front View", "User Manual Rev 3")
- sortOrder             Int (display ordering)
- createdAt             DateTime

// Constraints
// @@unique([modelId, fileId]) — prevent duplicate attachments
// Only one isPrimary=true photo per model (enforce in application logic)
```

### New Model: `AssetMedia`

Join table linking files to serialized assets.

```
AssetMedia
- id                    String (cuid)
- organizationId        String → Organization
- assetId               String → Asset
- fileId                String → FileUpload
- type                  Enum: PHOTO, DOCUMENT, OTHER
- isPrimary             Boolean (default false)
- displayName           String?
- sortOrder             Int
- createdAt             DateTime

// @@unique([assetId, fileId])
```

### New Model: `KitMedia`

Join table linking files to kits.

```
KitMedia
- id                    String (cuid)
- organizationId        String → Organization
- kitId                 String → Kit
- fileId                String → FileUpload
- type                  Enum: PHOTO, DOCUMENT, OTHER
- isPrimary             Boolean (default false)
- displayName           String?
- sortOrder             Int
- createdAt             DateTime

// @@unique([kitId, fileId])
```

### New Model: `ProjectMedia`

Join table linking files to projects.

```
ProjectMedia
- id                    String (cuid)
- organizationId        String → Organization
- projectId             String → Project
- fileId                String → FileUpload
- type                  Enum: FLOOR_PLAN, QUOTE, INVOICE, SITE_MAP, RISK_ASSESSMENT, CLIENT_BRIEF, CAD, CONTRACT, PHOTO, OTHER
- displayName           String? (user-friendly label, e.g., "Venue Floor Plan", "Xero Quote #1042")
- sortOrder             Int
- createdAt             DateTime

// @@unique([projectId, fileId])
```

### Modifications to Existing Models

#### Model (Equipment Template)

The existing `image`, `images`, and `manuals` fields on the Model should be **deprecated and migrated** to the new `ModelMedia` system. After migration:

- Remove `image` (String?) — replaced by the `ModelMedia` record where `type=PHOTO` and `isPrimary=true`
- Remove `images` (String[]) — replaced by all `ModelMedia` records where `type=PHOTO`
- Remove `manuals` (String[]) — replaced by `ModelMedia` records where `type=MANUAL`

Add a convenience relation:
```
- media                 ModelMedia[]
```

#### Asset (Serialized)

The existing `images` field should be deprecated and migrated to `AssetMedia`. Add:

```
- media                 AssetMedia[]
```

**Photo inheritance logic:** When displaying an asset's photo, resolve in this order:
1. The asset's own primary photo (`AssetMedia` where `isPrimary=true`) — if it exists, use it
2. Fall back to the parent model's primary photo (`ModelMedia` where `type=PHOTO` and `isPrimary=true`)
3. Fall back to a placeholder/no-image state

This inheritance is a **display-time resolution**, not stored. The asset does not copy the model's photo — it simply falls back to it when it has no override.

#### Kit

The existing `image` and `images` fields should be deprecated and migrated to `KitMedia`. Add:

```
- media                 KitMedia[]
```

#### BulkAsset

Bulk assets do not get their own photos — they inherit the parent model's primary photo. No changes needed. If a custom photo is needed later, a `BulkAssetMedia` table can be added, but skip this for v1.

---

## File Storage Architecture

### Storage Strategy

Use **AWS S3** (or an S3-compatible service like Cloudflare R2 or MinIO for local dev) as the file storage backend. No local filesystem storage.

### Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp
```

### Environment Variables

```env
S3_BUCKET=gearflow-uploads
S3_REGION=ap-southeast-2          # Sydney — closest to the primary user base
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=                       # Optional — set for R2, MinIO, or other S3-compatible providers
S3_PUBLIC_URL=                     # Optional — custom CDN/domain for public URLs (e.g., CloudFront distribution)
UPLOAD_MAX_SIZE_MB=50              # Max upload size in MB
```

### S3 Bucket Configuration

- **Private bucket** — do not enable public access. All access goes through signed URLs or the Next.js proxy route.
- Set a lifecycle rule to auto-delete objects tagged `status=orphaned` after 30 days (for cleanup of unreferenced uploads).
- Enable versioning if you want rollback protection (optional for v1).
- CORS configuration: allow your app domain for direct browser uploads if implementing presigned upload URLs later.

### Storage Service (`src/lib/storage.ts`)

Create a storage service using the AWS SDK v3:

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface UploadResult {
  storageKey: string;
  url: string;           // proxy URL for serving via the app
}

// Functions to implement:

upload(file: Buffer, options: {
  organizationId: string;
  folder: string;       // e.g., "models", "assets", "kits", "projects"
  entityId: string;     // the model/asset/kit/project ID
  fileName: string;
  mimeType: string;
}): Promise<UploadResult>;

delete(storageKey: string): Promise<void>;

getSignedUrl(storageKey: string, expiresIn?: number): Promise<string>;

getPublicUrl(storageKey: string): string;  // returns proxy route URL
```

### S3 Key Structure

Organise objects with a clear prefix hierarchy scoped by organization:

```
{organizationId}/{folder}/{entityId}/{uuid}-{filename}
```

Examples:
- `org_abc123/models/clxyz123/a1b2c3d4-front-view.jpg`
- `org_abc123/models/clxyz123/a1b2c3d4-front-view_thumb.jpg`
- `org_abc123/models/clxyz123/e5f6g7h8-user-manual.pdf`
- `org_abc123/projects/clproj456/f9g0h1i2-floor-plan.pdf`
- `org_abc123/assets/classet789/j3k4l5m6-damage-photo.jpg`

Prepend a UUID to the filename to avoid collisions when users upload files with the same name.

### Thumbnail Generation

For image uploads (JPEG, PNG, WebP):
- Generate a thumbnail on upload using `sharp` (300x300 max, preserving aspect ratio)
- Auto-rotate based on EXIF data so images always display correctly
- Upload the thumbnail to S3 alongside the original with a `_thumb` suffix in the key
- Store the thumbnail's proxy URL in `FileUpload.thumbnailUrl`

For non-image files:
- No thumbnail generated
- `thumbnailUrl` remains null

### File Serving: Proxy Route

Create `GET /api/files/[...path]` as the primary file access method:

- Accepts requests like `/api/files/org_abc123/models/clxyz123/a1b2c3d4-front-view.jpg`
- Validates that the requesting user's active organization matches the org prefix in the key
- Streams the object from S3 using `GetObjectCommand` (pipe the readable stream to the response — do not buffer the full file in memory)
- Sets appropriate headers:
  - `Content-Type` from the S3 object metadata or `FileUpload` record
  - `Cache-Control: public, max-age=31536000, immutable` for images/thumbnails (the key contains a UUID, so URLs change when files change)
  - `Content-Disposition: attachment; filename="original-name.pdf"` for document downloads
- This keeps all auth in one place and avoids exposing signed URLs in the HTML

The `url` and `thumbnailUrl` fields in `FileUpload` should store the proxy route path (e.g., `/api/files/org_abc123/models/clxyz123/a1b2c3d4-front-view.jpg`), not raw S3 URLs.

### Upload API Route

Create `POST /api/uploads` (or a server action):

- Accept multipart form data
- Validate file size against `UPLOAD_MAX_SIZE_MB` env var (default 50MB)
- Validate MIME type against an allowlist:
  - Images: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
  - Documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - Spreadsheets: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - CAD/Other: `application/dxf`, `application/dwg`, `text/plain`
  - Allow orgs to extend this list via settings if needed later
- Authenticate and scope to active organization
- Generate UUID prefix for the filename
- Upload file to S3 via `PutObjectCommand`
- Generate and upload thumbnail if image (via `sharp`)
- Create `FileUpload` record with the proxy route URL
- Return the `FileUpload` record (serialized)

### Direct Browser Upload (Optional Enhancement)

For large files, consider presigned upload URLs so files go directly from the browser to S3 without passing through the server:

1. Client requests a presigned PUT URL from the server
2. Server generates it via `@aws-sdk/s3-request-presigner`
3. Client uploads directly to S3
4. Client notifies the server on completion → server creates the `FileUpload` record and generates the thumbnail

This is optional for v1. The simpler approach (upload to server → server puts to S3) works fine for files under 50MB.

---

## Behaviour & Business Logic

### Model Photos

- Models can have multiple photos. One is marked as the **primary** photo.
- The first photo uploaded automatically becomes the primary.
- Users can change which photo is primary via a "Set as Primary" action.
- The primary photo is used as the model's thumbnail/avatar throughout the platform (model list, search results, line items, etc.).
- Deleting the primary photo promotes the next photo (by sort order) to primary. If no photos remain, the model shows a placeholder.

### Model Manuals & Documents

- Models can have multiple attached files categorised as MANUAL, SPEC_SHEET, WIRING_DIAGRAM, or OTHER.
- Display these in a dedicated section/tab on the model detail page.
- Files should be downloadable and (for PDFs) previewable inline.
- When viewing an asset, users should be able to access the parent model's manuals from the asset detail page (read-only reference, not duplicated).

### Asset Photo Inheritance

- When an asset has no custom photo (`AssetMedia` is empty or has no primary), display the parent model's primary photo everywhere.
- When an asset has its own primary photo, use that instead of the model photo.
- The UI should make it clear whether the photo shown is inherited ("Model Photo") or custom ("Asset Photo"), e.g., with a small badge or label on the asset detail page.
- Use case: a tech drops a console and dents the corner — they take a photo and upload it to that specific asset to document the damage. That asset now shows its own damage photo rather than the generic model product shot.
- To "reset" back to the model photo, the user simply deletes the asset's custom photo.

### Kit Photos

- Kits can have multiple photos (closed case, open case showing contents, label close-up, etc.).
- One photo is primary — used as the kit thumbnail across the platform.
- Kit photos are independent of the photos on the model/assets inside the kit.

### Project File Attachments

- Projects can have multiple attached files with categorised types (FLOOR_PLAN, QUOTE, INVOICE, SITE_MAP, RISK_ASSESSMENT, CLIENT_BRIEF, CAD, CONTRACT, PHOTO, OTHER).
- Display on the project detail page in a dedicated "Files" or "Documents" tab.
- Files are downloadable and (for PDFs/images) previewable inline.
- Any team member with access to the project can upload files.
- Consider showing a file count badge on the tab header (e.g., "Files (3)").

### Deletion

- Deleting a media join record (e.g., `ModelMedia`) removes the association but keeps the `FileUpload` and physical file. This allows potential re-use or recovery.
- Provide a background cleanup job or manual admin action to purge orphaned `FileUpload` records and their physical files.
- Deleting a model/asset/kit/project should NOT cascade-delete the physical files. Soft-delete the entity; the media associations remain for audit/recovery purposes.

---

## UI Components

### Reusable `MediaUploader` Component

Build a single reusable component for all media upload contexts:

```
<MediaUploader
  entityType="model" | "asset" | "kit" | "project"
  entityId={string}
  accept="image/*" | "image/*,.pdf" | "*"  // configure per context
  maxFiles={number}
  existingMedia={MediaItem[]}
  onUpload={(file: FileUpload) => void}
  onRemove={(mediaId: string) => void}
  onSetPrimary={(mediaId: string) => void}  // only for image contexts
/>
```

Features:
- Drag-and-drop upload zone
- Click to browse
- Upload progress indicator
- Thumbnail preview for images, icon + filename for documents
- Reorder via drag-and-drop (updates `sortOrder`)
- "Set as Primary" button/star icon on image thumbnails
- Delete button with confirmation
- File size and type validation on the client before uploading

### Model Detail Page Updates

Add to the model detail page:

- **Photos section** (in the header area or as a tab):
  - Primary photo displayed prominently
  - Thumbnail strip of additional photos
  - Click to enlarge/lightbox
  - Upload, reorder, set primary, delete actions
- **Documents section** (tab or collapsible section):
  - List of attached manuals/spec sheets with: file name, type badge, file size, upload date
  - Download and preview actions
  - Upload new document with type selector (MANUAL, SPEC_SHEET, WIRING_DIAGRAM, OTHER)

### Asset Detail Page Updates

- **Photo section**:
  - Show the resolved photo (custom if exists, model fallback otherwise)
  - If showing model photo, display a label like "Using model photo" with an "Upload Custom Photo" button
  - If showing custom photo, show "Custom Photo" label with options to upload more, set primary, or remove (revert to model photo)
- **Documents section** (read-only reference):
  - Show parent model's attached documents for quick access
  - Labelled as "Model Documents" to make clear they belong to the model, not the asset

### Kit Detail Page Updates

- **Photos tab** (already exists in the kit spec — implement it now):
  - Same pattern as model photos: primary photo, thumbnail strip, upload/reorder/delete
  - Suggested photos: open case, closed case, label, foam layout

### Project Detail Page Updates

- **Files/Documents tab**:
  - Grid or list view of attached files
  - Upload area with type selector (FLOOR_PLAN, QUOTE, INVOICE, etc.)
  - Thumbnail preview for images, icon + filename for documents
  - Download, preview (inline for PDFs/images), delete actions
  - File type filter/group options

### Inline Photo Display Across the Platform

Update existing list views and UI elements to show photos:

- **Model list page**: Show model primary photo as a small thumbnail (e.g., 40x40) in the table row
- **Asset list/registry page**: Show resolved asset photo (custom or model fallback) as thumbnail
- **Kit list page**: Show kit primary photo as thumbnail
- **Project line items**: Show the model/asset/kit photo as a small thumbnail next to the item name
- **Search results (Cmd+K)**: Include thumbnail in search result rows
- **Availability/calendar views**: Optionally show photo thumbnail alongside model name

Use `thumbnailUrl` from `FileUpload` for performance in list views. Use full `url` for detail views and lightboxes.

---

## Server Actions

### File Upload Actions (`src/server/uploads.ts`)

```
uploadFile(formData: FormData): Promise<FileUpload>
deleteFile(fileId: string): Promise<void>
```

### Model Media Actions (`src/server/model-media.ts`)

```
addModelMedia(data: { modelId, fileId, type, displayName? }): Promise<ModelMedia>
removeModelMedia(mediaId: string): Promise<void>
setModelPrimaryPhoto(modelId: string, mediaId: string): Promise<void>
reorderModelMedia(modelId: string, orderedIds: string[]): Promise<void>
getModelMedia(modelId: string): Promise<ModelMedia[]>
```

### Asset Media Actions (`src/server/asset-media.ts`)

```
addAssetMedia(data: { assetId, fileId, type, displayName? }): Promise<AssetMedia>
removeAssetMedia(mediaId: string): Promise<void>
setAssetPrimaryPhoto(assetId: string, mediaId: string): Promise<void>
getAssetMedia(assetId: string): Promise<AssetMedia[]>
```

### Kit Media Actions (`src/server/kit-media.ts`)

```
addKitMedia(data: { kitId, fileId, type, displayName? }): Promise<KitMedia>
removeKitMedia(mediaId: string): Promise<void>
setKitPrimaryPhoto(kitId: string, mediaId: string): Promise<void>
getKitMedia(kitId: string): Promise<KitMedia[]>
```

### Project Media Actions (`src/server/project-media.ts`)

```
addProjectMedia(data: { projectId, fileId, type, displayName? }): Promise<ProjectMedia>
removeProjectMedia(mediaId: string): Promise<void>
getProjectMedia(projectId: string): Promise<ProjectMedia[]>
```

All server actions must:
- Call `getOrgContext()` for organization scoping
- Call `serialize()` on return values
- Validate that the referenced entity (model/asset/kit/project) belongs to the active organization
- Validate that the referenced `FileUpload` belongs to the active organization

---

## Image Display Utility

Create a helper function for resolving which photo to display for any entity:

### `src/lib/media-utils.ts`

```typescript
/**
 * Resolve the display photo URL for an asset.
 * Priority: asset's own primary photo → model's primary photo → null
 */
function resolveAssetPhotoUrl(asset: {
  media?: { isPrimary: boolean; file: { thumbnailUrl?: string; url: string } }[];
  model?: {
    media?: { type: string; isPrimary: boolean; file: { thumbnailUrl?: string; url: string } }[];
  };
}, preferThumbnail?: boolean): string | null;

/**
 * Resolve the display photo URL for a model.
 */
function resolveModelPhotoUrl(model: {
  media?: { type: string; isPrimary: boolean; file: { thumbnailUrl?: string; url: string } }[];
}, preferThumbnail?: boolean): string | null;

/**
 * Resolve the display photo URL for a kit.
 */
function resolveKitPhotoUrl(kit: {
  media?: { isPrimary: boolean; file: { thumbnailUrl?: string; url: string } }[];
}, preferThumbnail?: boolean): string | null;
```

Use `preferThumbnail: true` in list views for performance, `false` in detail views.

---

## PDF Document Updates

### Quote/Invoice PDFs

- Include the model's primary photo next to line items (small thumbnail, optional — add a toggle in document generation settings)
- Kit line items can show the kit photo

### Packing List / Pull Slip

- Optionally include small equipment photos next to item names to help warehouse staff identify gear visually

This is a nice-to-have and should be a configurable option, not on by default (it increases PDF size significantly).

---

## Migration Plan

### Phase 1: Foundation

1. Create the `FileUpload`, `ModelMedia`, `AssetMedia`, `KitMedia`, `ProjectMedia` Prisma models
2. Run migration
3. Install `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, and `sharp`
4. Implement the S3 storage service (`src/lib/storage.ts`)
5. Implement the upload API route and file serving proxy route

### Phase 2: Model Media

1. Implement `ModelMedia` server actions
2. Build the `MediaUploader` component
3. Add photo and document sections to the model detail page
4. Add model photo thumbnails to the model list page
5. Migrate any existing `image`/`images`/`manuals` data from the Model table to `ModelMedia` + `FileUpload` records
6. Deprecate the old fields (keep in schema temporarily for rollback safety)

### Phase 3: Asset Media

1. Implement `AssetMedia` server actions
2. Add photo section to the asset detail page with inheritance logic
3. Implement `resolveAssetPhotoUrl` utility
4. Add asset photo thumbnails to the asset registry list
5. Show model documents on the asset detail page
6. Migrate any existing `images` data from the Asset table

### Phase 4: Kit Media

1. Implement `KitMedia` server actions
2. Add photos tab to the kit detail page
3. Add kit photo thumbnails to the kit list page

### Phase 5: Project Media

1. Implement `ProjectMedia` server actions
2. Add files/documents tab to the project detail page
3. Build upload with type categorisation

### Phase 6: Polish

1. Add thumbnails to line items, search results, and other list views across the platform
2. Implement image lightbox component for full-size viewing
3. Add PDF document photo options (optional thumbnails in quotes/packing lists)
4. Remove deprecated `image`/`images`/`manuals` fields from Model/Asset/Kit schemas
5. Build orphaned file cleanup utility

---

## Edge Cases

1. **Large file uploads**: Enforce a max file size (50MB default). Show clear error if exceeded. Consider chunked uploads later for very large files.

2. **Unsupported file types**: Validate MIME type on both client and server. Reject with a clear error listing accepted types.

3. **Deleting a model that has media**: Soft-delete the model. Media associations remain. Files are not deleted (they may be referenced in historical project data or audit trails).

4. **Organization data isolation**: All file serving must verify the requesting user's organization matches the file's `organizationId`. Never serve files across organization boundaries.

5. **Concurrent uploads**: Multiple users uploading to the same entity simultaneously should work — each upload creates its own `FileUpload` and media join record. Sort order may need reconciliation.

6. **Replacing a photo**: Upload the new one, set it as primary, then optionally delete the old one. There is no "replace" action — it's add + set primary + remove old.

7. **S3 connectivity failures**: Wrap all S3 operations in try/catch. Show a clear error to the user if the upload fails. Consider a retry mechanism for transient network errors.

8. **Image orientation**: Use `sharp` to auto-rotate images based on EXIF data during upload so thumbnails and display images are always correctly oriented.

---

## Technical Notes

- **AWS SDK v3**: Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. Use `S3Client` with the configured region, credentials, and optional custom endpoint (for R2/MinIO).
- **`sharp` dependency**: Install via `npm install sharp`. Use for thumbnail generation, EXIF rotation, and optionally WebP conversion for performance.
- **Next.js file serving**: The `/api/files/[...path]` proxy route should pipe the S3 `GetObjectCommand` response body (a readable stream) directly to the Next.js response — do not buffer the full file in memory.
- **File upload in server actions**: Server actions support `FormData` natively. The upload action should accept `FormData` and extract the file from it.
- **`next.config.js`**: Since files are served via the `/api/files/` proxy route (same origin), `<Image>` should work without additional `remotePatterns` config. If using signed S3 URLs directly in future, configure `images.remotePatterns` for your S3 bucket domain.
- **Local development**: Use MinIO (`docker run -p 9000:9000 minio/minio server /data`) as a local S3-compatible backend. Set `S3_ENDPOINT=http://localhost:9000` in `.env.local`.
- **Existing patterns**: Follow the project's existing patterns — `getOrgContext()` for scoping, `serialize()` on return values, React Query for client state, `useMutation` for uploads, `toast.success`/`toast.error` for feedback.

---

## Summary

This extension adds a unified media and file attachment system to GearFlow. The key architectural decisions are:

- **Single `FileUpload` table** for all uploaded files, with separate join tables per entity type for flexible categorisation
- **Photo inheritance** for assets: custom photo overrides model photo, with display-time fallback (not data duplication)
- **Reusable `MediaUploader` component** used consistently across models, assets, kits, and projects
- **S3 storage** with a proxy route for org-scoped file access and aggressive caching
- **Automatic thumbnail generation** for fast list view performance
- **Organisation-scoped file access** enforced at the API level for data isolation
