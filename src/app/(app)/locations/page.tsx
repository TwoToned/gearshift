"use client";

import { LocationTable } from "@/components/locations/location-table";

export default function LocationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        <p className="text-muted-foreground">
          Manage warehouses, venues, and storage locations.
        </p>
      </div>
      <LocationTable />
    </div>
  );
}
