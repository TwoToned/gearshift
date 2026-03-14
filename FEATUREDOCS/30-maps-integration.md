# Maps Integration — Address Autocomplete & Interactive Maps

## Overview
Universal address autocomplete (Nominatim) and interactive maps (Leaflet + OpenStreetMap) across Location, Client, and Supplier entities. Selecting a suggestion captures coordinates and displays a map on detail pages. Freeform text works without coordinates — no map, just text.

## Components

### AddressInput (`src/components/ui/address-input.tsx`)
- Text input with inline autocomplete via Nominatim (free, no API key)
- Debounced (300ms), minimum 3 characters before querying
- Shows teal `MapPin` icon when geocoded; clears on manual edit
- `countryCode` prop biases results to org's country (via `countrycodes` param)
- Keyboard navigation: arrow keys, enter to select, escape to close
- Graceful degradation: works as plain text input if Nominatim is unavailable
- Use with `Controller` from React Hook Form

### AddressMap (`src/components/ui/address-map.tsx`)
- Leaflet + OpenStreetMap tiles, dynamically imported (no SSR)
- Dark mode: CartoDB DarkMatter; Light mode: CartoDB Positron
- Single marker with popup showing label + address
- "Get Directions" link (Apple Maps on iOS, Google Maps elsewhere)
- Inner component at `src/components/ui/address-map-inner.tsx`

### AddressDisplay (`src/components/ui/address-display.tsx`)
- Conditional wrapper: map if coordinates exist, plain text if only address, nothing if empty
- `compact` mode (150px, non-interactive) for cards/sidebars

## Address Formatting (`src/lib/address-autocomplete.ts`)
- Builds short addresses from Nominatim `addressdetails`: `{place name}, {number} {road}, {suburb} {STATE} {postcode}`
- Place name (e.g. "Qtopia Sydney") is prepended when it differs from the street and locality
- State abbreviations for AU, US, NZ (e.g. "New South Wales" -> "NSW")
- Extracts leading house number from user query when Nominatim matches a road without one
- Example: typing "15 bulah cl" -> "15 Bulah Close, Berowra Heights NSW 2082"
- Example: searching "Qtopia Sydney" -> "Qtopia Sydney, 13 Southgate Ave, Cannon Hill QLD 4170"

## Country Bias
- `OrgSettings.country` (ISO 3166-1 alpha-2, e.g. "AU") set in Settings -> General
- `useOrgCountry()` hook (`src/lib/use-org-country.ts`) reads from cached org query
- Passed as `countryCode` to `AddressInput` in all forms
- Nominatim `countrycodes` parameter restricts results to that country

## Database Fields
All coordinate fields are `Float?` (nullable). No coordinates = freeform text, no map.

| Model | Fields |
|-------|--------|
| **Location** | `latitude`, `longitude` |
| **Client** | `billingLatitude`, `billingLongitude`, `shippingLatitude`, `shippingLongitude` |
| **Supplier** | `latitude`, `longitude` |

Migration: `20260314100000_add_address_coordinates` (additive, safe for production)

## Coordinate Validation (Zod)
Coordinate fields use `z.union([z.null(), z.coerce.number()]).optional()` — the `z.null()` branch **must** come first in the union to prevent `z.coerce.number()` from coercing `null` to `0` (since `Number(null) === 0`). This ensures clearing an address properly nullifies coordinates so the map is hidden.

## Child Location Inheritance
- Child locations without their own address/coordinates inherit from their parent
- **Server-side** (`getProject`): location inheritance is resolved before returning, so project pages always show the resolved address and map
- **Client-side** (location detail page): falls back to `location.parent.address` / `location.parent.latitude` / `location.parent.longitude` when the child's own values are null
- **Edit form**: parent's address is shown as placeholder text (`"Inherited: {parent address}"`) with a hint below. Clearing the address field restores inheritance. The form always saves the child's own raw values (empty = inherit)
- `getLocation` returns raw (non-inherited) data so the edit form can distinguish between own and inherited values

## Get Directions
- Project detail page: "Get Directions" link shown on the Location card when coordinates exist
- Location detail page: shown via `AddressDisplay` -> `AddressMap` which includes directions link
- Links to Google Maps (`maps/dir/?api=1&destination={lat},{lng}`); iOS variant uses Apple Maps

## SelectValue Gotcha
All `Select` dropdowns must pass explicit label children to `<SelectValue>` because Base UI renders items in a portal and `SelectValue` cannot resolve portal-rendered items. Without this, raw enum values (e.g. "WAREHOUSE") or IDs are displayed instead of human-readable labels.

## Where Used

### Forms (AddressInput replaces plain text inputs)
- Location form: `address` field (with parent address as placeholder for child locations)
- Client form: `billingAddress` and `shippingAddress` fields
- Supplier form: `address` field

### Detail Pages (AddressDisplay shows map or text)
- Location detail: full-width map (250px) below header (inherits from parent if no own address)
- Client detail: compact maps in addresses card (billing + shipping)
- Supplier detail: compact map in contact card
- Project detail: location card shows address, map coordinates inherited from location (including parent inheritance), "Get Directions" link

## Dependencies
- `leaflet` + `react-leaflet` (map rendering)
- `@types/leaflet` (dev)
- Nominatim API (free, rate-limited to 1 req/sec, User-Agent required)
