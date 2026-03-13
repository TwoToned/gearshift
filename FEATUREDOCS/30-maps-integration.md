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
- Builds short addresses from Nominatim `addressdetails`: `{number} {road}, {suburb} {STATE} {postcode}`
- State abbreviations for AU, US, NZ (e.g. "New South Wales" → "NSW")
- Extracts leading house number from user query when Nominatim matches a road without one
- Example: typing "15 bulah cl" → "15 Bulah Close, Berowra Heights NSW 2082"

## Country Bias
- `OrgSettings.country` (ISO 3166-1 alpha-2, e.g. "AU") set in Settings → General
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

## Where Used

### Forms (AddressInput replaces plain text inputs)
- Location form: `address` field
- Client form: `billingAddress` and `shippingAddress` fields
- Supplier form: `address` field

### Detail Pages (AddressDisplay shows map or text)
- Location detail: full-width map (250px) below header
- Client detail: compact maps in addresses card (billing + shipping)
- Supplier detail: compact map in contact card

## Dependencies
- `leaflet` + `react-leaflet` (map rendering)
- `@types/leaflet` (dev)
- Nominatim API (free, rate-limited to 1 req/sec, User-Agent required)
