# Crew Management

## Overview
Crew management tracks people (employees, freelancers, contractors, volunteers) for project staffing. Includes core entity CRUD (Phase 1) and project crew assignments with scheduling and call sheets (Phase 2).

## Data Models

### CrewMember
- `id, organizationId, firstName, lastName, email?, phone?, image?`
- `userId?` — optional link to platform User
- `type` — EMPLOYEE, FREELANCER, CONTRACTOR, VOLUNTEER
- `status` — ACTIVE, INACTIVE, ON_LEAVE, ARCHIVED
- `department?` — freeform (e.g. "Audio", "Lighting")
- `crewRoleId?` — FK to CrewRole
- `defaultDayRate?, defaultHourlyRate?, overtimeMultiplier?, currency?`
- `address?, addressLatitude?, addressLongitude?`
- `emergencyContactName?, emergencyContactPhone?`
- `dateOfBirth?, abnOrGst?`
- `notes?, tags[]`
- `skills[]` — many-to-many with CrewSkill
- `certifications[]` — one-to-many CrewCertification
- Unique: `[organizationId, email]`

### CrewRole
- `id, organizationId, name, description?, department?, color?`
- `defaultRate?, rateType?` (HOURLY | DAILY | FLAT)
- `sortOrder, isActive`
- Unique: `[organizationId, name]`

### CrewSkill
- `id, organizationId, name, category?`
- Many-to-many with CrewMember
- Unique: `[organizationId, name]`

### CrewCertification
- `id, crewMemberId, name, issuedBy?, certificateNumber?`
- `issuedDate?, expiryDate?`
- `status` — CURRENT, EXPIRING_SOON, EXPIRED, NOT_VERIFIED

### CrewAssignment
- `id, organizationId, projectId, crewMemberId`
- `crewRoleId?` — role for this assignment
- `status` — PENDING, OFFERED, ACCEPTED, DECLINED, CONFIRMED, CANCELLED, COMPLETED
- `phase?` — BUMP_IN, EVENT, BUMP_OUT, DELIVERY, PICKUP, SETUP, REHEARSAL, FULL_DURATION
- `isProjectManager` — boolean, PMs shown first
- `startDate?, startTime?, endDate?, endTime?`
- `rateOverride?, rateType?, estimatedHours?, estimatedCost?`
- `notes?, internalNotes?`
- `confirmedAt?, confirmedById?`
- Unique: `[projectId, crewMemberId, phase]`

### CrewShift
- `id, assignmentId, date, callTime?, endTime?`
- `breakMinutes?, location?, notes?`
- `status` — SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW

## Server Actions

### `src/server/crew.ts` (Phase 1)
| Function | Permission | Description |
|----------|-----------|-------------|
| `getCrewMembers(params)` | crew.read | Paginated list with search, filters, sorting |
| `getCrewMemberById(id)` | crew.read | Full detail with role, skills, certifications |
| `createCrewMember(data)` | crew.create | Create with skill connections |
| `updateCrewMember(id, data)` | crew.update | Update with skill set replacement |
| `deleteCrewMember(id)` | crew.delete | Delete crew member |
| `getCrewRoles()` | crew.read | All active roles |
| `createCrewRole(data)` | crew.create | Create role |
| `updateCrewRole(id, data)` | crew.update | Update role |
| `deleteCrewRole(id)` | crew.delete | Delete (fails if assigned) |
| `getCrewSkills()` | crew.read | All skills with member counts |
| `createCrewSkill(data)` | crew.create | Create skill |
| `deleteCrewSkill(id)` | crew.delete | Delete skill |
| `addCertification(crewMemberId, data)` | crew.update | Add cert to member |
| `removeCertification(certId)` | crew.update | Remove cert |
| `getCrewRoleOptions()` | crew.read | Dropdown options |
| `getCrewSkillOptions()` | crew.read | Multi-select options |
| `getCrewDepartments()` | crew.read | Distinct departments |

### `src/server/crew-assignments.ts` (Phase 2)
| Function | Permission | Description |
|----------|-----------|-------------|
| `getProjectCrew(projectId)` | crew.read | All assignments for a project |
| `createAssignment(projectId, data)` | crew.create | Assign crew to project |
| `updateAssignment(id, data)` | crew.update | Update assignment |
| `deleteAssignment(id)` | crew.delete | Remove assignment |
| `updateAssignmentStatus(id, status)` | crew.update | Change status |
| `generateShifts(assignmentId)` | crew.update | Auto-generate daily shifts |
| `updateShift(shiftId, data)` | crew.update | Edit individual shift |
| `deleteShift(shiftId)` | crew.update | Remove shift |
| `getProjectLabourCost(projectId)` | crew.read | Aggregate estimated cost |
| `getCrewMembersForAssignment(projectId)` | crew.read | Available crew for picker |

## Rate Cascade
Assignment rate is resolved in this order:
1. `rateOverride` on the assignment (if set and > 0)
2. `crewMember.defaultDayRate` (daily) or `crewMember.defaultHourlyRate` (hourly)
3. `crewRole.defaultRate` (with role's rate type)
4. Fallback: $0 daily

## Cost Calculation
- **DAILY**: rate × number of days (start to end inclusive)
- **HOURLY**: rate × estimatedHours
- **FLAT**: rate (fixed amount)

## Pages
| Path | Component | Description |
|------|-----------|-------------|
| `/crew` | CrewTable | Paginated list with search/filter |
| `/crew/new` | CrewMemberForm | Create crew member |
| `/crew/[id]` | Detail page | Contact, rates, skills, certifications |
| `/crew/[id]/edit` | CrewMemberForm | Edit crew member |

## Project Detail Integration
- **Crew tab** on project detail page (`/projects/[id]`) via `CrewPanel` component
- Assignment list with phase grouping, PM highlighting
- Add/edit assignment dialogs with crew picker, role, phase, dates, rate override
- Status dropdown (Pending → Offered → Accepted → Confirmed → Completed)
- **Labour cost** shown in project financial summary
- **Call Sheet** button in crew tab and Documents dropdown

## Call Sheet PDF
- `src/lib/pdf/call-sheet-pdf.tsx` — landscape A4 document
- API route: `GET /api/documents/call-sheet/[projectId]?date=YYYY-MM-DD`
- Lists all non-cancelled crew sorted by call time then role
- Includes: project info, location, site contact, crew table (name, role, phase, call/wrap times, phone, notes)
- Uses shift-specific times when available for the requested date

## Permissions
Resource `crew` with actions: `read, create, update, delete`
- owner/admin: all
- manager: create, read, update
- member/staff/warehouse/viewer: read

## Integration Points
- **Sidebar**: "Crew" with HardHat icon, gated by `crew` resource
- **Top bar**: `crew` segment label
- **Page commands**: searchable crew page with aliases
- **Global search**: searches first/last name, email, department
- **Activity log**: CREATE/UPDATE/DELETE logged for crew members, roles, and assignments

## Validation Schemas (`src/lib/validations/crew.ts`)
- `crewMemberSchema` — full member form
- `crewRoleSchema` — role form
- `crewSkillSchema` — skill creation
- `crewCertificationSchema` — certification form
- `crewAssignmentSchema` — project assignment form
- `crewShiftSchema` — individual shift form

## Status Labels (`src/lib/status-labels.ts`)
- `crewMemberStatusLabels`, `crewMemberTypeLabels`, `crewCertStatusLabels`
- `crewRateTypeLabels`, `assignmentStatusLabels`, `phaseLabels`, `shiftStatusLabels`

## Future Phases (not yet implemented)
- Phase 3: Availability management & conflict detection
- Phase 4: Calendar integration (iCal feeds)
- Phase 5: Communication & offer flow
- Phase 6: Time tracking & payroll
- Phase 7: Crew portal
