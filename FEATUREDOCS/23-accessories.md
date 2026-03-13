# Accessories & Auto-Pulls

## Data Model
- **`ModelAccessory`**: Join table linking parent model → accessory model. Fields: `parentModelId`, `accessoryModelId`, `quantity` (per parent unit), `level` (`AccessoryLevel` enum), `notes`, `sortOrder`. Unique: `(parentModelId, accessoryModelId)`.
- **`AccessoryLevel` enum**: `MANDATORY` (always auto-added), `OPTIONAL` (auto-added but removable), `RECOMMENDED` (not auto-added, shown as suggestion).
- **`ProjectLineItem` fields**: `isAccessory` (Boolean), `accessoryLevel` (AccessoryLevel?), `manualOverride` (Boolean — prevents auto-scaling).

## Server Actions (`src/server/model-accessories.ts`)
- `getModelAccessories(modelId)`, `addModelAccessory(parentModelId, data)`, `updateModelAccessory(id, data)`, `removeModelAccessory(id)`, `reorderModelAccessories(parentModelId, orderedIds)`
- Circular reference detection: BFS walk up to 3 levels deep
- **Live propagation**: Changes to definitions auto-propagate to all active (non-finished, non-template) projects

## Auto-Pull Logic (`src/server/line-items.ts`)
- **`addLineItem`**: Creates child line items for MANDATORY and OPTIONAL accessories. Cascades up to 3 levels. Returns `recommendedAccessories` for RECOMMENDED items.
- **`addKitLineItem`**: Queries each kit child's model for accessories. Kit child accessories become grandchildren of the kit parent.
- **`updateLineItem`**: Scales non-`manualOverride` accessory children proportionally.
- **`removeLineItem`**: Cascade deletes all accessory children.
- **Duplicate merging**: If accessory model already exists on the project, increments quantity instead of creating a new row.

## Rendering
- All 5 PDFs, warehouse page, pull sheet, and line items panel use unified `allChildren` array
- Three levels: Parent → children (kit items or accessories) → grandchildren (accessories of kit children)
- Accessories get teal background tint and "Required"/"Acc." badge in the line items panel
- Mandatory accessories cannot be individually deleted

## UI
- **Model detail page**: "Accessories" tab with inline editing for quantity and level
- **Validation**: `src/lib/validations/model-accessory.ts`
