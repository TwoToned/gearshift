"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  FolderOpen,
  Users,
  Boxes,
  Tag,
  Search,
  Loader2,
  Box,
  MapPin,
  Wrench,
  CornerDownRight,
  ChevronsUpDown,
  Layers,
  ChevronRight,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { globalSearch, type SearchResult, type SearchResultType } from "@/server/search";

const typeIcons: Record<SearchResultType, React.ComponentType<{ className?: string }>> = {
  model: Package,
  kit: Box,
  asset: Tag,
  "bulk-asset": Boxes,
  project: FolderOpen,
  client: Users,
  location: MapPin,
  category: Layers,
  maintenance: Wrench,
};

const typeLabels: Record<SearchResultType, string> = {
  model: "Model",
  kit: "Kit",
  asset: "Asset",
  "bulk-asset": "Bulk Asset",
  project: "Project",
  client: "Client",
  location: "Location",
  category: "Category",
  maintenance: "Maintenance",
};

/** Normalize for local fuzzy filtering */
function normalize(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(true);

  // Drill-down state: when Tab is pressed on a parent, we scope to its children
  const [drillParent, setDrillParent] = useState<SearchResult | null>(null);
  const [drillChildren, setDrillChildren] = useState<SearchResult[]>([]);
  const [drillQuery, setDrillQuery] = useState("");

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const isDrilling = drillParent !== null;

  // Filter drill-down children by the drill query
  const filteredDrillChildren = useMemo(() => {
    if (!isDrilling) return [];
    if (!drillQuery) return drillChildren;
    const nq = normalize(drillQuery);
    if (!nq) return drillChildren;

    // Score each child by how well it matches
    const scored = drillChildren.map((child) => {
      const nTitle = normalize(child.title);
      const nSub = normalize(child.subtitle || "");
      let score = 0;
      if (nTitle === nq) score = 100;
      else if (nTitle.startsWith(nq)) score = 80;
      else if (nTitle.includes(nq)) score = 60;
      else if (nSub.includes(nq)) score = 40;
      // Also check if all characters appear in order (subsequence match)
      else {
        let ti = 0;
        for (let qi = 0; qi < nq.length && ti < nTitle.length; ti++) {
          if (nTitle[ti] === nq[qi]) qi++;
          if (qi === nq.length) { score = 20; break; }
        }
      }
      return { child, score };
    });

    // Return only matches, sorted by score desc
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.child);
  }, [isDrilling, drillChildren, drillQuery]);

  // The visible results based on mode
  const visibleResults = isDrilling
    ? filteredDrillChildren
    : expanded
      ? results
      : results.filter((r) => !r.isChild);

  // Cmd+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      exitDrill();
    }
  }, [open]);

  // Auto-scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(q);
      setResults(data.results as SearchResult[]);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    if (isDrilling) {
      setDrillQuery(value);
      setSelectedIndex(0);
    } else {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value), 250);
    }
  };

  const navigate = (result: SearchResult) => {
    setOpen(false);
    router.push(result.href);
  };

  /** Enter drill-down mode for a parent result */
  const enterDrill = (parentIdx: number) => {
    const parent = visibleResults[parentIdx];
    if (!parent || parent.isChild) return;

    // Find this parent's children in the full results
    const fullIdx = results.indexOf(parent);
    if (fullIdx === -1) return;

    const children: SearchResult[] = [];
    for (let i = fullIdx + 1; i < results.length; i++) {
      if (results[i].isChild) {
        children.push(results[i]);
      } else {
        break;
      }
    }

    if (children.length === 0) return; // No children to drill into

    setDrillParent(parent);
    setDrillChildren(children);
    setDrillQuery("");
    setSelectedIndex(0);
  };

  const exitDrill = () => {
    setDrillParent(null);
    setDrillChildren([]);
    setDrillQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape in drill mode: exit drill
    if (e.key === "Escape" && isDrilling) {
      e.preventDefault();
      e.stopPropagation();
      exitDrill();
      return;
    }

    // Backspace on empty drill query: exit drill
    if (e.key === "Backspace" && isDrilling && drillQuery === "") {
      e.preventDefault();
      exitDrill();
      return;
    }

    // Tab: drill into selected parent's children
    if (e.key === "Tab" && !isDrilling) {
      e.preventDefault();
      enterDrill(selectedIndex);
      return;
    }

    // Tab in drill mode: navigate to selected child
    if (e.key === "Tab" && isDrilling && visibleResults[selectedIndex]) {
      e.preventDefault();
      navigate(visibleResults[selectedIndex]);
      return;
    }

    // Cmd+L / Ctrl+L: toggle expand/collapse (only in main mode)
    if (e.key === "l" && (e.metaKey || e.ctrlKey) && !isDrilling) {
      e.preventDefault();
      setExpanded((prev) => !prev);
      setSelectedIndex(0);
      return;
    }

    // Shift+Right: expand children (main mode)
    if (e.key === "ArrowRight" && e.shiftKey && !isDrilling) {
      e.preventDefault();
      if (!expanded) { setExpanded(true); setSelectedIndex(0); }
      return;
    }

    // Shift+Left: collapse children (main mode)
    if (e.key === "ArrowLeft" && e.shiftKey && !isDrilling) {
      e.preventDefault();
      if (expanded) { setExpanded(false); setSelectedIndex(0); }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (e.shiftKey && !isDrilling) {
        // Shift+Down: skip to next parent
        let next = selectedIndex + 1;
        while (next < visibleResults.length && visibleResults[next].isChild) {
          next++;
        }
        setSelectedIndex(Math.min(next, visibleResults.length - 1));
      } else {
        setSelectedIndex((i) => Math.min(i + 1, visibleResults.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (e.shiftKey && !isDrilling) {
        // Shift+Up: skip to previous parent
        let prev = selectedIndex - 1;
        while (prev > 0 && visibleResults[prev].isChild) {
          prev--;
        }
        setSelectedIndex(Math.max(prev, 0));
      } else {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
    } else if (e.key === "Enter" && visibleResults[selectedIndex]) {
      e.preventDefault();
      navigate(visibleResults[selectedIndex]);
    }
  };

  // Section headers: show when type changes between non-child items (main mode only)
  const getSectionLabel = (idx: number): string | null => {
    if (isDrilling) return null;
    const result = visibleResults[idx];
    if (result.isChild) return null;
    for (let i = idx - 1; i >= 0; i--) {
      if (!visibleResults[i].isChild) {
        return visibleResults[i].type === result.type ? null : (typeLabels[result.type] + "s");
      }
    }
    return typeLabels[result.type] + "s";
  };

  const hasChildren = results.some((r) => r.isChild);

  // Check if selected result has children (for Tab hint)
  const selectedHasChildren = !isDrilling && visibleResults[selectedIndex] && !visibleResults[selectedIndex]?.isChild && (() => {
    const fullIdx = results.indexOf(visibleResults[selectedIndex]);
    return fullIdx >= 0 && fullIdx + 1 < results.length && results[fullIdx + 1]?.isChild;
  })();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 text-muted-foreground rounded-md border border-input bg-transparent px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="p-0 gap-0 sm:max-w-lg overflow-hidden">
          <div className="flex items-center border-b px-3 gap-1">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            {/* Drill-down breadcrumb */}
            {isDrilling && drillParent && (
              <button
                onClick={exitDrill}
                className="shrink-0 flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors"
              >
                {(() => { const Icon = typeIcons[drillParent.type] || Package; return <Icon className="h-3 w-3" />; })()}
                <span className="max-w-[150px] truncate">{drillParent.title}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <X className="h-3 w-3 text-muted-foreground/60 hover:text-foreground" />
              </button>
            )}
            <Input
              ref={inputRef}
              value={isDrilling ? drillQuery : query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isDrilling ? `Filter ${drillParent?.title}...` : "Search models, assets, projects, kits..."}
              className="h-11 border-0 shadow-none focus-visible:ring-0 px-2"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {hasChildren && !isDrilling && (
              <button
                onClick={() => { setExpanded((prev) => !prev); setSelectedIndex(0); }}
                className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={expanded ? "Collapse children (⌘L)" : "Expand children (⌘L)"}
              >
                <ChevronsUpDown className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {/* No results states */}
            {!isDrilling && query.length >= 2 && visibleResults.length === 0 && !loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            )}
            {isDrilling && drillQuery && filteredDrillChildren.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No matching children.
              </div>
            )}
            {/* Results list */}
            {visibleResults.length > 0 && (
              <div className="p-1">
                {visibleResults.map((result, idx) => {
                  const sectionLabel = getSectionLabel(idx);
                  const Icon = (result.isChild && !isDrilling) ? CornerDownRight : (typeIcons[result.type] || Package);
                  const isChild = result.isChild && !isDrilling;

                  return (
                    <div key={`${result.type}-${result.id}-${idx}`}>
                      {sectionLabel && (
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {sectionLabel}
                        </div>
                      )}
                      <button
                        ref={(el) => {
                          if (el) itemRefs.current.set(idx, el);
                          else itemRefs.current.delete(idx);
                        }}
                        onClick={() => navigate(result)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex w-full items-center gap-3 rounded-md py-1.5 text-left text-sm transition-colors ${
                          isChild ? "pl-9 pr-3" : "px-3"
                        } ${
                          idx === selectedIndex
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-accent/50"
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${
                          isChild ? "text-muted-foreground/50" : "text-muted-foreground"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className={`truncate ${isChild ? "text-xs" : "text-sm font-medium"}`}>
                            {result.title}
                          </div>
                          {result.subtitle && (
                            <div className="truncate text-xs text-muted-foreground">
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                        {!isChild && !isDrilling && (
                          <span className="shrink-0 text-xs text-muted-foreground/60">
                            {typeLabels[result.type]}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {!isDrilling && query.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type to search...
              </div>
            )}
          </div>
          {/* Footer hints */}
          {(results.length > 0 || isDrilling) && (
            <div className="border-t px-3 py-1.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">↑↓</kbd>
                navigate
              </span>
              {!isDrilling && (
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⇧↑↓</kbd>
                  skip children
                </span>
              )}
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⏎</kbd>
                open
              </span>
              {selectedHasChildren && (
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Tab</kbd>
                  drill in
                </span>
              )}
              {isDrilling && (
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Esc</kbd>
                  back
                </span>
              )}
              {hasChildren && !isDrilling && (
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⇧←→</kbd>
                  {expanded ? "collapse" : "expand"}
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
