export interface PlaceResult {
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

let lastRequestTime = 0;

// Map of full state names → abbreviations for common countries
const STATE_ABBREVIATIONS: Record<string, Record<string, string>> = {
  au: {
    "New South Wales": "NSW",
    "Victoria": "VIC",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Western Australia": "WA",
    "Tasmania": "TAS",
    "Northern Territory": "NT",
    "Australian Capital Territory": "ACT",
  },
  us: {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
  },
  nz: {
    "Auckland": "AKL", "Canterbury": "CAN", "Wellington": "WGN",
    "Waikato": "WKO", "Bay of Plenty": "BOP", "Otago": "OTA",
  },
};

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  [key: string]: string | undefined;
}

/**
 * Build a short, human-friendly address from Nominatim address components.
 * e.g. "15 Bulah Cl, Berowra Heights NSW 2082"
 */
function formatShortAddress(addr: NominatimAddress, name?: string, query?: string): string {
  const parts: string[] = [];

  // Street line: "15 Bulah Close" or just the place name
  // If Nominatim matched a road but the user typed a house number, prepend it
  let houseNumber = addr.house_number;
  if (!houseNumber && addr.road && query) {
    const match = query.match(/^(\d+[\w-]*)\s/);
    if (match) houseNumber = match[1];
  }

  const street = houseNumber && addr.road
    ? `${houseNumber} ${addr.road}`
    : addr.road || name || "";
  if (street) parts.push(street);

  // Locality: suburb > city > town > village
  const locality = addr.suburb || addr.city || addr.town || addr.village || "";

  // State abbreviation
  const cc = addr.country_code?.toLowerCase() || "";
  const stateAbbr = addr.state
    ? STATE_ABBREVIATIONS[cc]?.[addr.state] || addr.state
    : "";

  // Build "Berowra Heights NSW 2082" or "Berowra Heights, NY 12189"
  const locationParts = [locality, stateAbbr, addr.postcode].filter(Boolean);
  if (locationParts.length > 0) {
    // Format: "Locality STATE Postcode"
    parts.push(locationParts.join(" "));
  }

  return parts.join(", ");
}

export async function searchAddresses(
  query: string,
  options?: { limit?: number; countryCode?: string }
): Promise<PlaceResult[]> {
  if (query.length < MIN_QUERY_LENGTH) return [];

  // Nominatim rate limit: 1 req/sec
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - timeSinceLast));
  }
  lastRequestTime = Date.now();

  const limit = options?.limit ?? 5;
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: String(limit),
    addressdetails: "1",
  });

  // Bias results to the org's country
  if (options?.countryCode) {
    params.set("countrycodes", options.countryCode.toLowerCase());
  }

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "GearFlow/1.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data.map(
      (item: {
        display_name: string;
        name?: string;
        lat: string;
        lon: string;
        osm_id?: number;
        address?: NominatimAddress;
      }) => ({
        address: item.address
          ? formatShortAddress(item.address, item.name, query)
          : item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        placeId: item.osm_id ? String(item.osm_id) : undefined,
      })
    );
  } catch {
    // Graceful degradation — no suggestions on error
    return [];
  }
}

export { DEBOUNCE_MS, MIN_QUERY_LENGTH };
