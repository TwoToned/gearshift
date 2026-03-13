"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  searchAddresses,
  DEBOUNCE_MS,
  MIN_QUERY_LENGTH,
  type PlaceResult,
} from "@/lib/address-autocomplete";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: PlaceResult | null) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  initialCoordinates?: { latitude: number; longitude: number } | null;
  /** ISO 3166-1 alpha-2 country code to bias results (e.g. "AU", "US") */
  countryCode?: string;
}

export function AddressInput({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address...",
  disabled,
  className,
  initialCoordinates,
  countryCode,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isGeocoded, setIsGeocoded] = useState(!!initialCoordinates);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync geocoded state when initialCoordinates changes
  useEffect(() => {
    setIsGeocoded(!!initialCoordinates);
  }, [initialCoordinates]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    const results = await searchAddresses(query, { countryCode });
    setSuggestions(results);
    setIsOpen(results.length > 0);
    setActiveIndex(-1);
  }, [countryCode]);

  function handleInputChange(text: string) {
    onChange(text);

    // If user modifies text after a selection, clear coordinates
    if (isGeocoded) {
      setIsGeocoded(false);
      onPlaceSelect?.(null);
    }

    // Debounced autocomplete
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS);
  }

  function handleSelect(place: PlaceResult) {
    onChange(place.address);
    setIsGeocoded(true);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    onPlaceSelect?.(place);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            isGeocoded && "pr-8",
            className
          )}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {isGeocoded && (
          <MapPin className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-500" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <ul role="listbox" className="max-h-60 overflow-auto py-1">
            {suggestions.map((place, i) => {
              // Split display_name into primary name and rest
              const parts = place.address.split(", ");
              const primary = parts[0];
              const secondary = parts.slice(1).join(", ");

              return (
                <li
                  key={place.placeId ?? `${place.latitude}-${place.longitude}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm",
                    i === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(place);
                  }}
                >
                  <div className="font-medium">{primary}</div>
                  {secondary && (
                    <div className="text-xs text-muted-foreground truncate">
                      {secondary}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            Type any address or select a suggestion
          </div>
        </div>
      )}
    </div>
  );
}
