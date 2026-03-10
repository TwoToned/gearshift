"use client";

import { CategoryManager } from "@/components/assets/category-manager";

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          Organize your equipment into categories and subcategories.
        </p>
      </div>
      <CategoryManager />
    </div>
  );
}
