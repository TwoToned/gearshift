"use client";

import { icons, type LucideProps } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name: string;
}

/**
 * Render a Lucide icon by name (PascalCase, e.g. "Clapperboard", "Zap").
 * Falls back to showing the initials text if icon not found.
 */
export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComponent = icons[name as keyof typeof icons];
  if (!IconComponent) return null;
  return <IconComponent {...props} />;
}

/** Check if a string is a valid Lucide icon name */
export function isValidIcon(name: string): boolean {
  return name in icons;
}
