"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { ExternalLink } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon paths
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

function getDirectionsUrl(lat: number, lng: number, label: string) {
  const isIOS =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    return `maps:?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// Keeps map centred when coordinates change
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [map, lat, lng]);
  return null;
}

interface Props {
  latitude: number;
  longitude: number;
  address?: string;
  label?: string;
  height?: number;
  zoom?: number;
  interactive?: boolean;
  showDirectionsLink?: boolean;
  className?: string;
}

export default function AddressMapInner({
  latitude,
  longitude,
  address,
  label,
  height = 250,
  zoom = 15,
  interactive = true,
  showDirectionsLink = true,
  className,
}: Props) {
  const { resolvedTheme } = useTheme();

  const tileUrl = useMemo(() => {
    return resolvedTheme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  }, [resolvedTheme]);

  const directionsUrl = getDirectionsUrl(latitude, longitude, label || address || "");

  return (
    <div className={cn("space-y-2", className)}>
      <div className="overflow-hidden rounded-md border" style={{ height }}>
        <MapContainer
          center={[latitude, longitude]}
          zoom={zoom}
          scrollWheelZoom={interactive}
          dragging={interactive}
          touchZoom={interactive}
          doubleClickZoom={interactive}
          zoomControl={interactive}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={tileUrl}
          />
          <Marker position={[latitude, longitude]}>
            <Popup>
              <div className="text-sm">
                {label && <div className="font-medium">{label}</div>}
                {address && <div className="text-muted-foreground">{address}</div>}
              </div>
            </Popup>
          </Marker>
          <RecenterMap lat={latitude} lng={longitude} />
        </MapContainer>
      </div>

      {showDirectionsLink && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Get Directions
        </a>
      )}
    </div>
  );
}
