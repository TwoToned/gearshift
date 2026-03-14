# Crew Management (Phase 1 — Core Entity CRUD)

## Overview
Crew management tracks people (employees, freelancers, contractors, volunteers) for project staffing. Phase 1 covers core entity CRUD — crew members, roles, skills, and certifications.

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

## Server Actions (`src/server/crew.ts`)
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

## Pages
| Path | Component | Description |
|------|-----------|-------------|
| `/crew` | CrewTable | Paginated list with search/filter |
| `/crew/new` | CrewMemberForm | Create crew member |
| `/crew/[id]` | Detail page | Contact, rates, skills, certifications |
| `/crew/[id]/edit` | CrewMemberForm | Edit crew member |

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
- **Activity log**: CREATE/UPDATE/DELETE logged for crew members and roles

## Validation Schema (`src/lib/validations/crew.ts`)
- `crewMemberSchema` — full member form
- `crewRoleSchema` — role form
- `crewSkillSchema` — skill creation
- `crewCertificationSchema` — certification form

## Future Phases (not yet implemented)
- Phase 2: Project crew assignments (CrewAssignment model)
- Phase 3: Shifts & scheduling
- Phase 4: Availability management
- Phase 5: Calendar integration (iCal)
- Phase 6: Crew portal
- Phase 7: Time tracking & call sheets
