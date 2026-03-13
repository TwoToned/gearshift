# Feature: Maps Integration — Address Autocomplete & Interactive Maps

## Summary

Add a universal `AddressInput` component used across every address field in GearFlow — Locations, Clients, Suppliers, Crew, and anywhere else an address is ever needed. The input offers place autocomplete suggestions as the user types (via Nominatim, Mapbox, or Google Places) but always allows freeform text too. When the user selects a suggestion, coordinates are captured and a map is displayed on detail pages. When they type freeform (a custom location name, backstage door reference, etc.), no map is shown — just the text. One component, one pattern, used everywhere.

---

## Table of Contents

1. [Core Design Principle](#1-core-design-principle)
2. [AddressInput Component](#2-addressinput-component)
3. [Address Data Structure](#3-address-data-structure)
4. [Autocomplete Provider](#4-autocomplete-provider)
5. [Map Display Component](#5-map-display-component)
6. [Where AddressInput Is Used](#6-where-addressinput-is-used)
7. [Where Maps Display](#7-where-maps-display)
8. [Data Model Changes](#8-data-model-changes)
9. [Server Actions](#9-server-actions)
10. [Migration of Existing Addresses](#10-migration-of-existing-addresses)
11. [Environment Variables](#11-environment-variables)
12. [Mobile Considerations](#12-mobile-considerations)
13. [PDF Documents](#13-pdf-documents)
14. [Security & Cost](#14-security--cost)
15. [Implementation Phases](#15-implementation-phases)

---

## 1. Core Design Principle

**One input field. Always.** The user sees a single text input for "Address". As they type, a dropdown suggests matching places. They can either:

1. **Select a suggestion** → the address text is filled in, coordinates are silently captured, and the detail page will later show a map with a pin and "Get Directions" link.
2. **Ignore suggestions and type whatever they want** → the text is saved as-is with no coordinates. No map is displayed on detail pages. The address is still shown as text everywhere it appears.

This means:
- There are never separate "address" and "coordinates" fields in the UI
- There's never a separate "Verify on map" step
- The map is a reward for selecting a geocoded suggestion, not a requirement
- Weird custom locations like "Loading dock B, behind the Hilton" or "Ask for Steve at the gate" work fine — they just don't get a map
- The component works identically everywhere it appears

---

## 2. AddressInput Component

### `src/components/ui/address-input.tsx`

A single reusable component that replaces every address text input in the app.

```typescript
interface AddressInputProps {
  value: string;                          // The address text
  onChange: (value: string) => void;       // Text change handler
  onPlaceSelect?: (place: PlaceResult | null) => void;  // Fired when user selects a suggestion (or clears selection)
  placeholder?: string;                   // Default: "Start typing an address..."
  label?: string;                         // Form label
  disabled?: boolean;
  className?: string;
  // Stored coordinates (for edit forms with previously geocoded addresses)
  initialCoordinates?: { latitude: number; longitude: number } | null;
}

interface PlaceResult {
  address: string;          // Formatted address from the provider
  latitude: number;
  longitude: number;
  placeId?: string;         // Provider's place ID (useful for deduplication)
  components?: {            // Structured address parts (optional, for future use)
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}
```

### Behaviour

**As the user types:**
1. After a debounce (300ms, minimum 3 characters), query the autocomplete provider for suggestions
2. Show a dropdown below the input with up to 5 suggestions, each showing the place name and formatted address
3. Typing continues to filter/refetch suggestions
4. If the autocomplete provider is unavailable (no API key, network error, rate limit), the input works as a normal text field with no dropdown — it degrades gracefully

**When the user selects a suggestion:**
1. The input text is replaced with the suggestion's formatted address
2. `onPlaceSelect` fires with the `PlaceResult` (including coordinates)
3. A subtle visual indicator appears (e.g. a small map pin icon or green check inside the input) to show that this address is geocoded
4. The parent form stores the coordinates alongside the address text

**When the user types freeform (no selection):**
1. The input text is saved as-is
2. `onPlaceSelect` fires with `null` (clearing any previously stored coordinates)
3. No map pin icon — the address is treated as ungeocoded text
4. If the user previously selected a suggestion and then manually edits the text, the coordinates are cleared (the selection is invalidated)

**When editing an existing geocoded address:**
1. The input pre-fills with the stored address text
2. If `initialCoordinates` are provided, show the map pin icon (this address was previously geocoded)
3. If the user modifies the text, the coordinates clear and they need to select a new suggestion to re-geocode

### Visual Design

- Standard text input matching GearFlow's existing input styling
- Dropdown uses the same Popover/floating pattern as `ComboboxPicker`
- Each suggestion row: bold place name on the first line, muted full address on the second line
- When geocoded: small `MapPin` icon (lucide) inside the input on the right side, muted teal colour
- When not geocoded: no icon (just a plain text input)
- The dropdown has a subtle "Type any address or select a suggestion" hint at the bottom

### Integration with React Hook Form

The component works with `Controller` from React Hook Form. The parent form manages two fields: the address text (string) and the coordinates (object or null):

```typescript
// In a form component:
<Controller
  name="address"
  control={control}
  render={({ field }) => (
    <AddressInput
      value={field.value}
      onChange={field.onChange}
      onPlaceSelect={(place) => {
        if (place) {
          setValue("latitude", place.latitude);
          setValue("longitude", place.longitude);
        } else {
          setValue("latitude", null);
          setValue("longitude", null);
        }
      }}
      initialCoordinates={
        watch("latitude") && watch("longitude")
          ? { latitude: watch("latitude"), longitude: watch("longitude") }
          : null
      }
    />
  )}
/>
```

---

## 3. Address Data Structure

Every entity that has an address stores three fields:

```typescript
{
  address: string;          // The text — always present if user typed anything
  latitude: number | null;  // Set only if user selected a geocoded suggestion
  longitude: number | null; // Set only if user selected a geocoded suggestion
}
```

The rule is simple:
- `latitude !== null && longitude !== null` → address is geocoded → show map
- `latitude === null || longitude === null` → address is freeform → no map, just text

---

## 4. Autocomplete Provider

### `src/lib/address-autocomplete.ts`

An abstraction layer that supports multiple providers:

```typescript
interface AutocompleteProvider {
  search(query: string, options?: { limit?: number; countryBias?: string }): Promise<PlaceResult[]>;
}
```

### Provider Implementations

**Nominatim (free, default):**
```typescript
// GET https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=5&addressdetails=1
// Rate limit: 1 request per second, must include User-Agent
// No API key required
```

Nominatim works for geocoding and basic search. Its autocomplete is less polished than Google/Mapbox (it's a geocoder, not a places autocomplete), but it's free and works for most addresses. For better autocomplete UX, use Mapbox or Google.

**Mapbox (recommended if API key is available):**
```typescript
// GET https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={TOKEN}&limit=5&types=address,poi
// Free tier: 100k requests/month
// Much better autocomplete UX than Nominatim
```

**Google Places (if API key is available):**
```typescript
// Use the Places Autocomplete API (new) or the older Autocomplete widget
// Free tier: $200/month credit
// Best autocomplete UX but most expensive at scale
```

### Provider Selection

The provider is determined by environment variables. The system falls back gracefully:

```typescript
function getAutocompleteProvider(): AutocompleteProvider | null {
  if (process.env.GOOGLE_MAPS_API_KEY) return new GooglePlacesProvider();
  if (process.env.MAPBOX_ACCESS_TOKEN) return new MapboxProvider();
  if (process.env.NOMINATIM_ENABLED !== "false") return new NominatimProvider();
  return null; // No provider — AddressInput works as plain text input
}
```

### Client-Side vs Server-Side

Autocomplete queries should happen **client-side** for responsiveness (debounced, as-you-type). This means:
- For Mapbox/Google: the API key is exposed client-side (restrict by referrer domain)
- For Nominatim: requests go directly from the browser (no API key needed, but respect rate limits)

Create an API proxy route if you need to hide the API key:
```
GET /api/address-autocomplete?q={query}
```
This proxies to the configured provider server-side. Rate-limit per user/session.

Alternatively, for Nominatim and Mapbox, making requests directly from the client is fine and standard practice. Only use the proxy if hiding the key is critical.

---

## 5. Map Display Component

### `src/components/ui/address-map.tsx`

Same as the previous spec, but now the map ONLY renders when coordinates are present:

```typescript
interface AddressMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  label?: string;
  height?: number;           // Default: 250
  zoom?: number;             // Default: 15
  interactive?: boolean;     // Default: true
  showDirectionsLink?: boolean;  // Default: true
  className?: string;
}
```

### Map Provider: Leaflet + OpenStreetMap

```bash
npm install leaflet react-leaflet
npm install --save-dev @types/leaflet
```

**Features:**
- Single pin at coordinates
- Popup on click showing address and label
- "Get Directions" link (Google Maps on desktop/Android, Apple Maps on iOS)
- Dark mode tiles (`CartoDB.DarkMatter` for dark, `CartoDB.Positron` or standard OSM for light)
- Responsive, touch-friendly
- Dynamic import with `next/dynamic` to avoid SSR issues

### Conditional Rendering Pattern

On every detail page, the map section uses this pattern:

```typescript
// On any detail page with an address:
{entity.latitude != null && entity.longitude != null ? (
  <AddressMap
    latitude={entity.latitude}
    longitude={entity.longitude}
    address={entity.address}
    label={entity.name}
  />
) : entity.address ? (
  // Address exists but no coordinates — show address text only, no map
  <div className="text-sm text-muted-foreground">{entity.address}</div>
) : null}
// No address at all — show nothing
```

### Compact Map Variant

For cards and sidebars:
- Height: 150px
- Non-interactive (click opens Google Maps in new tab)
- Rounded corners

### Address Display Component

Create a reusable `AddressDisplay` component that handles the conditional map/text logic:

```typescript
interface AddressDisplayProps {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  label?: string;
  compact?: boolean;         // Use compact map variant
  showDirections?: boolean;  // Show "Get Directions" link even without map (just opens maps search)
}
```

This component encapsulates the "show map if geocoded, show text if not, show nothing if empty" logic so it's consistent everywhere.

---

## 6. Where AddressInput Is Used

Replace every existing address text input in the app with `AddressInput`:

| Form | Field(s) | Notes |
|------|----------|-------|
| **Location form** | `address` | Primary use case — venues, warehouses |
| **Client form** | `billingAddress`, `shippingAddress` | Two separate `AddressInput` instances on the same form |
| **Supplier form** | `address` | If expanded suppliers feature is implemented |
| **Crew member form** | `address` | Crew member's personal address |
| **Project form** | No direct address field — address comes from the linked Location | But if a "site address override" field is ever added, use `AddressInput` |
| **Crew shift** | `location` field (currently a text string) | For shift-specific locations different from the project venue |
| **Any future entity with an address** | Use `AddressInput` | This is the universal pattern |

### Important: No Structural Change to Address Fields

The address remains a single text field in the database — not split into street/city/state/postcode. The `PlaceResult.components` are available if needed in the future but are NOT stored separately for now. This keeps the data model simple and doesn't break any existing address displays, exports, or PDFs.

---

## 7. Where Maps Display

Maps render on detail pages using the `AddressDisplay` component, but ONLY when the entity has coordinates (i.e. the address was geocoded via a suggestion selection):

| Page | Displays Map? | Notes |
|------|---------------|-------|
| **Location detail** (`/locations/[id]`) | Yes, if geocoded | Prominent map, full-width, 300px |
| **Project detail** (`/projects/[id]`) | Yes, if project's Location is geocoded | Compact map card in project info section |
| **Client detail** (`/clients/[id]`) | Yes, if billing/shipping geocoded | Map in address section, two pins if both geocoded |
| **Supplier detail** (`/suppliers/[id]`) | Yes, if geocoded | Map in contact section |
| **Crew member detail** (`/crew/[id]`) | Normally no — personal addresses don't need a map | Could show if useful, but low priority |
| **Crew portal: assignment detail** | Yes, if project location geocoded | Prominent map + "Get Directions" button |
| **Shared project page** (`/shared/project/[id]`) | Yes, if location geocoded AND scope.showLocation is true | Map respects sharing scope |
| **Call sheet (web view)** | Yes, if project location geocoded | Small map at top of call sheet |
| **List pages** | No maps | Maps are detail-page only |

---

## 8. Data Model Changes

### Location

```prisma
model Location {
  // ... existing fields ...
  latitude    Float?
  longitude   Float?
}
```

### Client

```prisma
model Client {
  // ... existing fields ...
  billingLatitude    Float?
  billingLongitude   Float?
  shippingLatitude   Float?
  shippingLongitude  Float?
}
```

### Supplier (if expanded suppliers feature)

```prisma
model Supplier {
  // ... existing fields ...
  latitude    Float?
  longitude   Float?
}
```

### CrewMember (if crew feature)

```prisma
model CrewMember {
  // ... existing fields ...
  addressLatitude    Float?
  addressLongitude   Float?
}
```

### CrewShift (if crew feature)

The `location` field on `CrewShift` is currently a plain string. Add:

```prisma
model CrewShift {
  // ... existing fields ...
  locationLatitude   Float?
  locationLongitude  Float?
}
```

### Pattern

The pattern is always the same: for every `address` (or address-like) text field, add a corresponding `latitude Float?` and `longitude Float?` pair. No other geocoding metadata is stored on the entity — the coordinates either exist (geocoded) or are null (freeform).

---

## 9. Server Actions

### No Special Geocoding Server Actions

Because geocoding happens client-side in the `AddressInput` component (user selects a suggestion → coordinates come from the autocomplete provider), there are no server-side geocoding calls needed during normal operation.

The server actions for create/update simply accept the coordinates as part of the input:

```typescript
// Example: createLocation now accepts optional coordinates
export async function createLocation(data: {
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  // ... other fields
}) {
  // Store as-is. Coordinates are null if user typed freeform.
}
```

### Validation

In Zod schemas, coordinates are optional and paired:

```typescript
// src/lib/validations/location.ts
const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  // ...
}).refine(
  (data) => {
    // If one coordinate is set, both must be set
    const hasLat = data.latitude != null;
    const hasLng = data.longitude != null;
    return hasLat === hasLng;
  },
  { message: "Both latitude and longitude must be provided together" }
);
```

### Optional: Server-Side Autocomplete Proxy

If the API key needs to be hidden from the client:

```typescript
// src/server/address-autocomplete.ts
"use server";
export async function searchAddresses(query: string): Promise<PlaceResult[]> {
  // Proxy to the configured provider
  // Rate-limit per user
}
```

This is optional — direct client-side calls to Nominatim/Mapbox work fine.

---

## 10. Migration of Existing Addresses

Existing records have address text but no coordinates. After adding the `latitude`/`longitude` fields:

**Do NOT bulk-geocode existing addresses on migration.** Leave coordinates as null. Existing addresses continue to display as text (no map), which is the current behaviour. Coordinates will populate naturally when:
- A user edits an existing entity and selects a suggestion for the address
- Or an admin decides to manually re-enter addresses to geocode them

This avoids:
- Hitting rate limits on Nominatim
- Incorrectly geocoding ambiguous addresses
- Spending API credits on Mapbox/Google for a one-time migration

If the org wants to bulk-geocode, this could be a future admin tool (background job that geocodes addresses one at a time, respecting rate limits, with manual review of low-confidence matches).

---

## 11. Environment Variables

```
# Autocomplete provider (determines which service AddressInput queries)
# If none are set, AddressInput works as a plain text field with no suggestions
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN    # Mapbox (recommended — good autocomplete UX, generous free tier)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY    # Google Places (best UX, most expensive)
NOMINATIM_ENABLED                  # "true" (default) — free, no key needed, basic autocomplete

# Note: NEXT_PUBLIC_ prefix makes the key available client-side (needed for browser autocomplete calls)
# Restrict these keys by domain in the provider's console
```

---

## 12. Mobile Considerations

### AddressInput on Mobile

- The autocomplete dropdown must work well on mobile keyboards — suggestions appear above the keyboard, not hidden behind it
- Consider using a full-screen dropdown/sheet on mobile (same pattern as `ComboboxPicker` mobile variant)
- Touch targets for suggestion rows: minimum 44px height

### Maps on Mobile

- Leaflet supports touch gestures natively (pinch zoom, drag)
- The compact map variant should have a prominent "Get Directions" button (this is the primary action on mobile)
- "Get Directions" deep links to Apple Maps (iOS) or Google Maps (Android)

```typescript
function getDirectionsUrl(lat: number, lng: number, label: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    return `maps:?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
```

### PWA Offline

Maps require network for tiles. When offline, show the address text with a "Map unavailable offline" note. The "Get Directions" button can still work — it opens the native maps app which may have cached tiles.

---

## 13. PDF Documents

### Text + Link (v1)

PDFs show the address text. If the address is geocoded, include a Google Maps link below it:

```
Venue: Sydney Olympic Park, Homebush NSW 2127
Maps: https://www.google.com/maps?q=-33.847,151.069
```

The link is clickable in digital PDFs. For printed PDFs, users can see the address text and look it up manually.

### Static Map Image (stretch goal)

Use a static maps API to embed a map image in the PDF:
- Mapbox Static Images: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+e74c3c({lng},{lat})/{lng},{lat},15/400x200?access_token={TOKEN}`
- Google Static Maps: `https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom=15&size=400x200&markers={lat},{lng}&key={API_KEY}`

Fetch server-side, convert to base64, embed via `@react-pdf/renderer`'s `Image` component. Only do this if coordinates exist.

---

## 14. Security & Cost

### API Key Exposure

Autocomplete API keys (`NEXT_PUBLIC_*`) are visible to the client. Mitigate:
- Restrict by HTTP referrer domain in the provider's console
- Set monthly usage caps/alerts
- Mapbox: restrict to `mapbox.places` scope only
- Google: restrict to Places API only

### Rate Limiting

| Provider | Limit | Mitigation |
|----------|-------|------------|
| Nominatim | 1 req/sec | Client-side debounce (300ms), minimum 3 chars before querying |
| Mapbox | 100k req/month free | Usually fine; add alerts at 80% |
| Google | $200/month free credit | Usually fine; add alerts at 80% |

### No Sensitive Data in Autocomplete

The autocomplete sends the user's partial address text to an external service. This is standard practice (same as typing into Google Maps). But note that the autocomplete provider sees what addresses your users are entering. If this is a concern for privacy-sensitive deployments, use the server-side proxy route so the requests come from the server's IP rather than the user's browser, or disable autocomplete entirely (the input still works as plain text).

### Cost Estimates for Typical Usage

A GearFlow deployment with 50 users creating ~100 addresses per month:
- Nominatim: Free (well within rate limits)
- Mapbox: ~500 autocomplete queries/month (50 users × 10 address entries × ~10 keystrokes that trigger queries, but debounce reduces this significantly) → well within 100k free tier
- Google: ~500 queries → well within $200 credit

---

## 15. Implementation Phases

### Phase 1: AddressInput Component + Location Integration
1. Install Leaflet + react-leaflet
2. Build `AddressInput` component with autocomplete (Nominatim as default provider)
3. Build `AddressMap` display component with dark mode tiles
4. Build `AddressDisplay` wrapper component (conditional map/text rendering)
5. Add `latitude`, `longitude` fields to `Location` model, run migration
6. Update Location form to use `AddressInput` instead of plain text input
7. Update Location detail page to show `AddressDisplay` (map if geocoded, text if not)
8. Update Location server actions to accept and store coordinates

### Phase 2: Roll Out to All Entities
1. Update Client form — replace billing/shipping address inputs with `AddressInput`
2. Add coordinate fields to Client model, run migration
3. Update Client detail page with `AddressDisplay`
4. Update Supplier form and detail page (if expanded suppliers feature exists)
5. Update Crew member form and detail page (if crew feature exists)
6. Update Crew shift location field (if crew feature exists)
7. Verify shared project page respects `showLocation` scope with map

### Phase 3: Enhanced Providers + Polish
1. Add Mapbox provider implementation (better autocomplete UX than Nominatim)
2. Add Google Places provider implementation (optional)
3. Server-side proxy route for API key hiding (optional)
4. "Get Directions" deep links (iOS/Android detection)
5. Compact map variant for cards and sidebars
6. Mobile UX polish (full-screen suggestion dropdown)

### Phase 4: Stretch Features
1. Static map images in PDF documents
2. Map view toggle on location list page (all pins on one map)
3. Multi-pin maps (project venue + warehouse)
4. Bulk geocoding admin tool for existing addresses

---

## Notes

- **The `AddressInput` is the foundational component.** Every address field in the entire app should use it. If a new entity with an address is ever added, use `AddressInput` — this is a universal pattern, not a per-entity decision.
- **No map without coordinates, no coordinates without a suggestion selection.** This is the core rule. Freeform text is always valid. Maps are a bonus for geocoded addresses.
- **The address field in the database is always a single text string.** Don't split into structured parts (street, city, state, postcode). The autocomplete provider returns components that could be stored separately in the future, but for now a single string keeps things simple and compatible with existing data, exports, and PDFs.
- **Graceful degradation is non-negotiable.** If the autocomplete provider is unavailable (no API key, network error, rate limit), the component must work as a plain text input. No errors, no broken forms. The only difference is no suggestion dropdown.
- **The map is never a gatekeeper.** No workflow should require a map or require coordinates. Every feature that references an address must work fine with just the text string. The map is purely additive.

