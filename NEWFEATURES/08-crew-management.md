# Feature: Crew Management System

## Summary

Build a full crew management module that tracks crew members, assigns them to projects with specific roles and shifts, manages their availability, handles both platform-login users and non-login crew contacts, and provides calendar integration (iCal feeds and per-event .ics exports). This brings GearFlow in line with what Current RMS, Flex StaffingPlus, Rentman, and LASSO offer for labor/crew management — adapted to GearFlow's architecture and multi-tenancy model.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Data Model](#2-data-model)
3. [Crew Member Types](#3-crew-member-types)
4. [Crew Roles & Skills](#4-crew-roles--skills)
5. [Project Crew Assignments](#5-project-crew-assignments)
6. [Shifts & Scheduling](#6-shifts--scheduling)
7. [Availability Management](#7-availability-management)
8. [Calendar Integration (iCal)](#8-calendar-integration-ical)
9. [Crew Communication](#9-crew-communication)
10. [Call Sheets](#10-call-sheets)
11. [Time Tracking](#11-time-tracking)
12. [Crew Rates & Labour Costs](#12-crew-rates--labour-costs)
13. [Crew Portal (Non-Login View)](#13-crew-portal-non-login-view)
14. [Routes & Pages](#14-routes--pages)
15. [Server Actions](#15-server-actions)
16. [API Routes](#16-api-routes)
17. [Sidebar & Navigation](#17-sidebar--navigation)
18. [Permissions](#18-permissions)
19. [Notifications](#19-notifications)
20. [Search Integration](#20-search-integration)
21. [PDF Documents](#21-pdf-documents)
22. [CSV Import/Export](#22-csv-importexport)
23. [Organization Export/Import](#23-organization-exportimport)
24. [Activity Log Integration](#24-activity-log-integration)
25. [Integration with Existing Systems](#25-integration-with-existing-systems)
26. [Mobile Considerations](#26-mobile-considerations)
27. [Implementation Phases](#27-implementation-phases)

---

## 1. Core Concepts

### Crew Member vs User vs Org Member

GearFlow already has three identity concepts:

- **User**: A person with a GearFlow account who can log in
- **Member**: A User who belongs to an Organization with a role (owner, admin, manager, etc.)
- **Session**: Active login tied to a User + Organization

This feature introduces a fourth concept:

- **CrewMember**: A person tracked by an organization for project staffing. May or may not have a User account. May or may not be able to log in.

The relationship:
```
CrewMember (always exists in the org's crew database)
  ├── linked to a User account (userId) → can log in, sees crew portal in-app
  ├── linked to a Member record → has org permissions, full app access
  └── standalone (no userId) → contact-only, receives emails, uses crew portal via token
```

This means:
- Every org Member who participates in crew work should have a corresponding CrewMember record (auto-created or manually linked)
- Freelancers and external contractors are CrewMembers WITHOUT a User/Member record
- A CrewMember can be "promoted" to a User at any time (send them an invite to create an account)

### Why a Separate CrewMember Model?

The existing `User` and `Member` models are tied to authentication and org permissions. Crew management needs to track people who may never log in — freelancers, day-hire labour, contractors from other companies. A separate `CrewMember` model allows:
- Storing crew-specific data (skills, rates, certifications, availability) without polluting the User model
- Managing people who don't have (and may never have) a platform account
- Linking to a User account optionally, for crew who do have accounts

---

## 2. Data Model

### `CrewMember`

```prisma
model CrewMember {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Identity
  firstName       String
  lastName        String
  email           String?
  phone           String?
  image           String?              // Profile photo URL

  // Link to platform user (optional)
  userId          String?  @unique     // If this person has a GearFlow account
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  // Employment type
  type            CrewMemberType       // EMPLOYEE, FREELANCER, CONTRACTOR, VOLUNTEER
  status          CrewMemberStatus     // ACTIVE, INACTIVE, ON_LEAVE, ARCHIVED
  department      String?              // e.g. "Audio", "Lighting", "Video", "Rigging", "Staging"

  // Skills & qualifications
  skills          CrewSkill[]          // Many-to-many with skills
  certifications  CrewCertification[]  // Licenses, tickets, certs
  notes           String?
  tags            String[] @default([])

  // Rates
  defaultDayRate    Decimal?  @db.Decimal(10, 2)
  defaultHourlyRate Decimal?  @db.Decimal(10, 2)
  overtimeMultiplier Decimal? @db.Decimal(3, 2)  // e.g. 1.5
  currency          String?                       // Override org default

  // Contact & emergency
  address         String?
  emergencyContactName  String?
  emergencyContactPhone String?
  dateOfBirth     DateTime?
  taxFileNumber   String?              // Encrypted/masked in UI
  bankDetails     String?              // Encrypted/masked in UI
  abnOrGst        String?              // ABN for Australian freelancers

  // Calendar
  icalToken       String?  @unique     // Secret token for iCal feed URL
  icalEnabled     Boolean  @default(false)

  // Portal access (for crew without a User account)
  portalToken     String?  @unique     // For email-verified portal access
  portalEnabled   Boolean  @default(false)

  // Relations
  assignments     CrewAssignment[]
  availability    CrewAvailability[]
  timeEntries     CrewTimeEntry[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  isActive        Boolean  @default(true)

  @@unique([organizationId, email])
  @@index([organizationId])
  @@index([organizationId, status])
  @@index([userId])
}

enum CrewMemberType {
  EMPLOYEE
  FREELANCER
  CONTRACTOR
  VOLUNTEER
}

enum CrewMemberStatus {
  ACTIVE
  INACTIVE
  ON_LEAVE
  ARCHIVED
}
```

### `CrewRole`

Defines the roles/positions available for crew on projects (e.g. "Sound Engineer", "Lighting Tech", "Rigger", "Stage Hand", "Driver", "Project Manager").

```prisma
model CrewRole {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name            String           // "Sound Engineer", "Bump In Crew", "FOH Engineer"
  description     String?
  department      String?          // "Audio", "Lighting", "Video", "Staging", "Transport"
  color           String?          // For calendar/UI display
  icon            String?          // Lucide icon name
  defaultRate     Decimal? @db.Decimal(10, 2)
  rateType        RateType?        // HOURLY, DAILY, FLAT
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)

  assignments     CrewAssignment[]

  @@unique([organizationId, name])
  @@index([organizationId])
}

enum RateType {
  HOURLY
  DAILY
  FLAT
}
```

### `CrewSkill`

Tags for searchable crew capabilities.

```prisma
model CrewSkill {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name            String           // "Rigging", "D&B Audiotechnik", "L-Acoustics", "ETC Eos", "Forklift"
  category        String?          // "Audio", "Lighting", "Video", "Safety", "Transport"

  crewMembers     CrewMember[]     // Many-to-many implicit relation

  @@unique([organizationId, name])
  @@index([organizationId])
}
```

### `CrewCertification`

Tracked qualifications with expiry dates.

```prisma
model CrewCertification {
  id              String   @id @default(cuid())
  crewMemberId    String
  crewMember      CrewMember @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)

  name            String           // "Working at Heights", "Forklift License", "White Card"
  issuedBy        String?          // "SafeWork NSW"
  certificateNumber String?
  issuedDate      DateTime?
  expiryDate      DateTime?
  status          CertStatus       // CURRENT, EXPIRING_SOON, EXPIRED, NOT_VERIFIED

  // Proof document (link to FileUpload)
  documentId      String?

  @@index([crewMemberId])
}

enum CertStatus {
  CURRENT
  EXPIRING_SOON
  EXPIRED
  NOT_VERIFIED
}
```

### `CrewAssignment`

Links a crew member to a project with a specific role and time period.

```prisma
model CrewAssignment {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  crewMemberId    String
  crewMember      CrewMember @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)

  crewRoleId      String?
  crewRole        CrewRole? @relation(fields: [crewRoleId], references: [id], onDelete: SetNull)

  // Assignment details
  status          AssignmentStatus   // PENDING, OFFERED, ACCEPTED, DECLINED, CONFIRMED, CANCELLED, COMPLETED
  phase           ProjectPhase?      // BUMP_IN, EVENT, BUMP_OUT, DELIVERY, PICKUP, SETUP, FULL_DURATION
  isProjectManager Boolean @default(false)  // Flag for PMs (project can have multiple)

  // Schedule (can differ from project dates)
  startDate       DateTime?
  startTime       String?            // "06:00" — stored as string for flexibility
  endDate         DateTime?
  endTime         String?            // "22:00"

  // Rate override (falls back to crew member default, then role default)
  rateOverride    Decimal?  @db.Decimal(10, 2)
  rateType        RateType?          // HOURLY, DAILY, FLAT
  estimatedHours  Decimal?  @db.Decimal(6, 2)
  estimatedCost   Decimal?  @db.Decimal(10, 2)

  // Notes
  notes           String?            // Assignment-specific notes
  internalNotes   String?            // Not visible to crew member

  // Response tracking (for offered assignments)
  offeredAt       DateTime?
  respondedAt     DateTime?
  responseNote    String?            // Crew member's response message

  // Confirmation
  confirmedAt     DateTime?
  confirmedById   String?
  confirmedBy     User?    @relation(fields: [confirmedById], references: [id], onDelete: SetNull)

  // Shifts (for multi-day projects with varying call times)
  shifts          CrewShift[]
  timeEntries     CrewTimeEntry[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([projectId, crewMemberId, phase])  // One assignment per person per phase per project
  @@index([organizationId])
  @@index([projectId])
  @@index([crewMemberId])
  @@index([crewMemberId, startDate])
}

enum AssignmentStatus {
  PENDING       // Created but not yet communicated
  OFFERED       // Availability inquiry / job offer sent
  ACCEPTED      // Crew member accepted
  DECLINED      // Crew member declined
  CONFIRMED     // Admin confirmed the booking
  CANCELLED     // Cancelled by either party
  COMPLETED     // Project is done, assignment fulfilled
}

enum ProjectPhase {
  BUMP_IN       // Load-in / setup
  EVENT         // During the event
  BUMP_OUT      // Load-out / pack-down
  DELIVERY      // Equipment delivery
  PICKUP        // Equipment pickup / collection
  SETUP         // Pre-event technical setup
  REHEARSAL     // Rehearsal period
  FULL_DURATION // Entire project duration
}
```

### `CrewShift`

For multi-day projects where crew have different call times each day.

```prisma
model CrewShift {
  id              String   @id @default(cuid())
  assignmentId    String
  assignment      CrewAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  date            DateTime          // The specific day
  callTime        String?           // "06:00"
  endTime         String?           // "18:00"
  breakMinutes    Int?              // Meal break duration
  location        String?           // If different from project location
  notes           String?           // "Park at loading dock B"
  status          ShiftStatus       // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW

  @@index([assignmentId])
  @@index([assignmentId, date])
}

enum ShiftStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}
```

### `CrewAvailability`

Crew members can mark dates they're unavailable.

```prisma
model CrewAvailability {
  id              String   @id @default(cuid())
  crewMemberId    String
  crewMember      CrewMember @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)

  startDate       DateTime
  endDate         DateTime
  type            AvailabilityType   // UNAVAILABLE, TENTATIVE, PREFERRED
  reason          String?            // "Holiday", "Other booking", "Personal"
  isAllDay        Boolean  @default(true)
  startTime       String?            // If not all day
  endTime         String?

  @@index([crewMemberId])
  @@index([crewMemberId, startDate, endDate])
}

enum AvailabilityType {
  UNAVAILABLE     // Hard block — cannot work
  TENTATIVE       // Might be available, check first
  PREFERRED       // Prefers to work these dates
}
```

### `CrewTimeEntry`

Actual hours worked (for time tracking and payroll export).

```prisma
model CrewTimeEntry {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  assignmentId    String
  assignment      CrewAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  crewMemberId    String
  crewMember      CrewMember @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)

  date            DateTime
  startTime       String           // "06:15"
  endTime         String?          // "18:30" — null if still clocked in
  breakMinutes    Int     @default(0)
  totalHours      Decimal? @db.Decimal(6, 2) // Calculated: (end - start - break)

  // Approval
  status          TimeEntryStatus   // DRAFT, SUBMITTED, APPROVED, DISPUTED, EXPORTED
  approvedById    String?
  approvedBy      User?    @relation(fields: [approvedById], references: [id], onDelete: SetNull)
  approvedAt      DateTime?
  notes           String?

  @@index([organizationId])
  @@index([assignmentId])
  @@index([crewMemberId, date])
}

enum TimeEntryStatus {
  DRAFT          // Entered but not submitted
  SUBMITTED      // Crew member submitted for approval
  APPROVED       // Manager approved
  DISPUTED       // Discrepancy flagged
  EXPORTED       // Sent to payroll
}
```

---

## 3. Crew Member Types

### Employees (EMPLOYEE)

Full-time or part-time staff. Typically have a User account and are org Members. Their CrewMember record is created automatically when they're added to the crew database, or linked from their existing User account.

### Freelancers (FREELANCER)

Independent contractors regularly engaged by the org. May or may not have a GearFlow account. Most common crew type in AV/events. Track their ABN/GST, day rates, and availability. Can access the crew portal to view their schedule and respond to offers.

### Contractors (CONTRACTOR)

From external companies. Similar to freelancers but may represent a company relationship (linked to a Supplier or Client record).

### Volunteers (VOLUNTEER)

Unpaid crew. Track hours for reporting but no rate calculations.

### Promotion Flow

```
Standalone CrewMember (no account)
    ↓ Admin clicks "Invite to platform"
    ↓ Email sent with registration link
    ↓ Person creates account
    ↓ CrewMember.userId linked to new User
    ↓ (Optional) Admin adds them as org Member with a role
Platform User with full access
```

---

## 4. Crew Roles & Skills

### Roles (CrewRole)

Organization-defined positions. Seed with common AV/events roles:
- **Audio**: FOH Engineer, Monitor Engineer, Sound Tech, Audio Crew, RF Tech
- **Lighting**: Lighting Designer, Lighting Tech, Lighting Crew, Follow Spot Operator, Programmer
- **Video**: Vision Mixer, Camera Operator, LED Tech, Video Tech, Projectionist
- **Staging**: Stage Manager, Stage Hand, Bump In/Out Crew, Rigger, Set Builder
- **Transport**: Driver, Truck Driver, Van Driver
- **Production**: Project Manager, Production Manager, Technical Director, Show Caller, Stage Manager
- **Other**: Runner, Security, Catering Liaison, Site Manager

Roles are org-specific. Users can create, rename, and reorder them.

### Skills (CrewSkill)

Freeform tags that describe what a crew member can do. Used for filtering when searching for available crew. Examples:
- Brand-specific: "D&B Audiotechnik", "L-Acoustics", "Martin MAC", "ETC Eos", "GrandMA"
- Certification-based: "Working at Heights", "Rigging", "Forklift"
- General: "Heavy Lifting", "Soldering", "Cable Management", "CAD Drawing"

### Certifications (CrewCertification)

Time-sensitive qualifications that require renewal. The system tracks expiry and alerts when certifications are expiring. Common in AV/events:
- White Card (General Construction Induction)
- Working at Heights
- Forklift License
- Electrical License
- First Aid Certificate
- Fire Warden Training
- Elevated Work Platform (EWP)

---

## 5. Project Crew Assignments

### How Crew Gets Added to Projects

On the project detail page, a new "Crew" tab/section shows all crew assignments for that project. Adding crew:

1. **Search crew database**: Filter by role, skill, availability, department
2. **Check availability**: Show conflicts with other projects, blocked dates
3. **Select phase**: Bump In, Event, Bump Out, Delivery, Full Duration, etc.
4. **Set schedule**: Default to project dates, or override with specific dates/times
5. **Set rate**: Default to crew member rate → role default → manual override
6. **Add to project**: Creates a `CrewAssignment` record

### Project Managers

The existing `Project.projectManagerId` field points to a single User. This feature enhances it:
- Multiple project managers per project (any CrewAssignment with `isProjectManager: true`)
- PMs are highlighted at the top of the crew list
- The legacy `projectManagerId` field should be migrated to use CrewAssignment — or kept for backward compatibility with a sync mechanism

### Assignment Status Flow

```
PENDING → OFFERED → ACCEPTED → CONFIRMED → COMPLETED
                  → DECLINED
          Any → CANCELLED
```

- **PENDING**: Assignment created by admin, not yet communicated to crew
- **OFFERED**: Availability inquiry or job offer email sent to crew member
- **ACCEPTED**: Crew member responded positively (via portal, app, or email reply)
- **DECLINED**: Crew member can't or won't do it
- **CONFIRMED**: Admin locks in the booking (after acceptance or directly)
- **COMPLETED**: Post-event, assignment marked as fulfilled
- **CANCELLED**: Withdrawn by either party

### Offer / Availability Inquiry Flow

When an assignment moves to OFFERED status:
1. Email sent to crew member with project details (name, dates, location, role, rate)
2. Email contains "Accept" and "Decline" links (token-based)
3. If crew member has a platform account: also shows as a notification in-app
4. If crew member is portal-only: links go to the crew portal verify page
5. Response updates `AssignmentStatus` and `respondedAt`

### Bulk Crew Operations

For large events:
- "Add multiple crew" dialog — select several crew members at once, assign to same role/phase
- "Copy crew from project" — duplicate crew assignments from a previous similar project
- "Fill from template" — project templates can include crew role slots (not specific people, but role + count)

---

## 6. Shifts & Scheduling

### Multi-Day Shift Scheduling

For projects spanning multiple days, each crew assignment can have per-day shifts with different call times:

```
Project: Summer Festival (Fri-Sun)

Sound Engineer - Alex
  Fri 14 Mar: Call 06:00, Wrap 22:00 (Bump In)
  Sat 15 Mar: Call 08:00, Wrap 23:00 (Show Day 1)
  Sun 16 Mar: Call 08:00, Wrap 02:00 (Show Day 2 + Bump Out)

Lighting Crew - Jordan
  Fri 14 Mar: Call 06:00, Wrap 18:00 (Bump In only)
  Sun 16 Mar: Call 22:00, Wrap 04:00 (Bump Out only)
```

### Shift Generation

When a crew assignment is created, auto-generate shifts for each day in the assignment date range. Admins can then customise individual shifts (change times, add notes, cancel specific days).

### Crew Schedule View

A calendar/timeline view showing all crew assignments across projects. Two perspectives:
- **Project view**: All crew on one project (used on the project detail page crew tab)
- **Crew view**: All projects for one crew member (used on crew member detail page and crew planner)
- **Organisation view**: Gantt-style planner showing all crew across all projects (the main crew scheduling page)

---

## 7. Availability Management

### How Crew Mark Availability

Crew members can mark periods of unavailability through:
1. **Admin entry**: Manager adds unavailability on crew member's profile
2. **Crew portal**: Crew member marks their own availability via the portal
3. **In-app**: If the crew member has a platform account, they can manage availability from their account page

### Availability Types

- **UNAVAILABLE**: Hard block. Cannot be assigned to projects during this period. Shown as red in the planner.
- **TENTATIVE**: Soft block. Can be assigned but admin sees a warning. Shown as amber.
- **PREFERRED**: Crew member actively wants work on these dates. Shown as green. Useful for "I'm available and looking for work" signals.

### Conflict Detection

When adding crew to a project:
1. Check `CrewAvailability` for blocks on the project dates
2. Check other `CrewAssignment` records for overlapping dates (double-booking)
3. Show warnings but allow override (with confirmation), since crew can legitimately work back-to-back or split-shift across projects

### Visual Indicators on Crew List

When browsing crew to assign to a project:
- Green dot: Available (no conflicts, no blocks)
- Amber dot: Tentative or has another project but times may not overlap
- Red dot: Unavailable or double-booked
- Grey dot: Inactive or archived

---

## 8. Calendar Integration (iCal)

### Personal iCal Feed (per crew member)

Each crew member gets a unique, secret iCal feed URL:
```
GET /api/crew/calendar/{icalToken}.ics
```

This feed contains all CONFIRMED assignments for that crew member as VEVENT entries. The URL can be added to Google Calendar, Apple Calendar, Outlook, etc. as a subscription calendar.

### VEVENT Format

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GearFlow//Crew Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:GearFlow - Alex Smith
X-WR-TIMEZONE:Australia/Sydney

BEGIN:VEVENT
UID:assignment-{assignmentId}@gearflow
DTSTART;TZID=Australia/Sydney:20260315T060000
DTEND;TZID=Australia/Sydney:20260315T220000
SUMMARY:Summer Festival - Sound Engineer
DESCRIPTION:Project: Summer Festival\nRole: Sound Engineer\nLocation: Sydney Olympic Park\nPhase: Bump In\n\nNotes: Park at loading dock B
LOCATION:Sydney Olympic Park, Homebush
STATUS:CONFIRMED
CATEGORIES:GearFlow,Bump In
END:VEVENT

...
END:VCALENDAR
```

### Per-Event .ics Download

In addition to the feed, users can download a single `.ics` file for a specific assignment. This is useful for:
- Emailing a calendar invite to a crew member
- One-off calendar adds without subscribing to the full feed

### Admin-Generated Calendar Invites

Admins can generate `.ics` files for crew members and either:
- Email them directly (attached to the assignment notification email)
- Download and forward manually
- Bulk-generate for all crew on a project

### Token Security

- `icalToken` is a cryptographically random string (32 bytes, URL-safe base64)
- Generated when `icalEnabled` is set to true
- Can be regenerated (invalidates old URL) if compromised
- The API route does NOT require authentication — the token IS the auth (same pattern as Google Calendar iCal feeds)
- Rate-limit the endpoint to prevent enumeration attacks

### Organisation-Wide Calendar Feed (Admin)

An org-level iCal feed that shows ALL crew assignments across all projects. Useful for production managers who need a complete view. Protected by a per-org secret token stored in `Organization.metadata`.

---

## 9. Crew Communication

### Assignment Notification Emails

Sent when:
- A crew member is offered a job (PENDING → OFFERED)
- An offer is confirmed (ACCEPTED → CONFIRMED)
- Assignment details change (date, time, location, role)
- Assignment is cancelled
- A reminder before the event (configurable: 24h, 48h, 1 week before)

### Email Content

Job offer email includes:
- Project name and number
- Role and phase
- Dates and call times
- Location (with address)
- Rate (if org settings allow showing rates in offers)
- Notes
- Accept / Decline buttons (token-based links)
- .ics attachment for the assignment
- Link to crew portal for full details

### Bulk Messaging

From the project crew tab, admin can:
- Send a message to all crew on the project
- Send a message to crew in a specific role or phase
- Message includes project context automatically

### Reminder System

Configurable automatic reminders:
- "You have a call tomorrow at 06:00 for [Project Name]"
- Sent via email (and in-app notification if they have an account)
- Default: 24 hours before first shift of each assignment

---

## 10. Call Sheets

### What's a Call Sheet

A production document listing all crew for a specific day of a project, with their call times, roles, and contact info. Standard in AV/events production.

### Call Sheet Generation

Generate a call sheet PDF for a specific project + date:
- Project name, date, location
- Table of crew: Name, Role, Call Time, End Time, Phone, Notes
- Sorted by call time, then role
- Site contact information
- Venue/location details
- Parking and access notes (from project or assignment notes)

### Call Sheet PDF Template

Add `src/lib/pdf/call-sheet-pdf.tsx` following the existing PDF patterns (Helvetica only, no Unicode). Include the call sheet as a new document type in the project documents API.

### Digital Call Sheet

In addition to PDF, show an interactive call sheet on the project detail page — a day picker that shows the crew schedule for each day of the project.

---

## 11. Time Tracking

### Basic Time Tracking (Phase 1)

Admin manually enters or adjusts time entries for crew:
- Date, start time, end time, break duration
- Auto-calculates total hours
- Linked to a specific assignment

### Crew Self-Service (Phase 2, if crew portal is built)

Crew members can log their own hours via the crew portal:
- Clock in / clock out (timestamped)
- Submit timesheet for approval
- Admin reviews and approves

### Time Entry Approval Workflow

```
DRAFT → SUBMITTED → APPROVED → EXPORTED
                  → DISPUTED → (resolve) → APPROVED
```

### Payroll Export

Export approved time entries as CSV:
- Columns: Crew Name, Date, Project, Role, Start, End, Break, Total Hours, Rate, Total Cost
- Filterable by date range, project, crew member, department

---

## 12. Crew Rates & Labour Costs

### Rate Cascade

When calculating cost for an assignment, the rate is resolved in order:
1. `CrewAssignment.rateOverride` (if set)
2. `CrewMember.defaultDayRate` or `defaultHourlyRate` (based on rate type)
3. `CrewRole.defaultRate` (role-level default)
4. Manual entry required (warn admin)

### Labour Cost on Projects

The project financial summary should include a labour cost section:
- Sum of all crew assignment estimated costs
- Displayed alongside the existing equipment subtotal
- Optional: include labour in the total (configurable per org or per project)
- Labour costs visible in the project detail but can be excluded from client-facing documents

### Labour as Line Items

Crew assignments can optionally generate `ProjectLineItem` records of type `LABOUR`:
- This allows labour to appear on quotes and invoices alongside equipment
- Link: `ProjectLineItem.crewAssignmentId` (new field)
- Toggle: org setting or per-assignment flag for whether to create a line item

---

## 13. Crew Portal (Non-Login View)

### Purpose

For crew members who don't have a GearFlow account. They receive emails with links to a minimal portal where they can:
- View their upcoming assignments (project, dates, role, location)
- Accept or decline offered assignments
- View shift details and call times
- View and download call sheets
- Mark their availability
- Log hours (if time tracking is enabled)

### Access Method

Same pattern as the Project Sharing guest access:
1. Crew member receives email with a tokenised link
2. Link lands on `/crew-portal/verify?token={token}`
3. Verification code sent to their email
4. 24-hour session cookie issued after verification
5. Portal shows only their own assignments — no org data leakage

Alternatively, for a simpler v1: each email action link (Accept, Decline, View Details) is a one-time-use tokenised link that performs the action without requiring a full session. This avoids the complexity of session management for simple responses.

### Portal Routes

| Route | Purpose |
|-------|---------|
| `/crew-portal/verify` | Email verification |
| `/crew-portal/schedule` | View upcoming assignments |
| `/crew-portal/assignment/[id]` | Assignment details |
| `/crew-portal/availability` | Mark availability |
| `/crew-portal/timesheet` | Log hours (if enabled) |

The portal has a minimal layout (no sidebar, no org navigation — similar to the shared project view).

---

## 14. Routes & Pages

### App Pages (Authenticated)

| Route | Page | Description |
|-------|------|-------------|
| `/crew` | Crew list | Table of all crew members with search, filter by type/status/department/skill |
| `/crew/new` | Create crew member | Full form with personal details, skills, rates, certifications |
| `/crew/[id]` | Crew member detail | Profile, assignments, availability, time entries, certifications, documents |
| `/crew/[id]/edit` | Edit crew member | Same form as create, pre-populated |
| `/crew/planner` | Crew planner | Gantt-style timeline showing all crew across all projects |
| `/crew/roles` | Manage roles | Table of crew roles with CRUD |
| `/crew/skills` | Manage skills | Table of skills with CRUD |

### Project Detail Enhancement

Add a "Crew" tab to the project detail page (`/projects/[id]`) showing:
- Assigned crew grouped by phase (Bump In, Event, Bump Out, etc.)
- Per-person: name, role, call time, status badge, rate, actions (edit, remove, offer, confirm)
- "Add Crew" button opening the crew assignment dialog
- "Generate Call Sheet" button for a specific date
- Labour cost summary

### Crew Planner (`/crew/planner`)

A Gantt-style horizontal timeline (similar to Current RMS resource planner and Rentman crew scheduling):
- Y-axis: Crew members (filterable by role, department, skill)
- X-axis: Dates (scrollable, zoomable)
- Bars: Project assignments (color-coded by project or role)
- Grey blocks: Unavailability periods
- Click a bar to view/edit the assignment
- Drag-and-drop to reassign (stretch goal)

This is the most complex UI component. Consider using a library like `@tanstack/react-table` for the list or a timeline library, or build a custom component.

---

## 15. Server Actions

### `src/server/crew.ts`

```typescript
"use server";
export async function createCrewMember(data: CreateCrewMemberInput): Promise<CrewMember>;
export async function updateCrewMember(id: string, data: UpdateCrewMemberInput): Promise<CrewMember>;
export async function deleteCrewMember(id: string): Promise<void>;
export async function getCrewMembers(filters: CrewFilters): Promise<PaginatedResult<CrewMember>>;
export async function getCrewMemberById(id: string): Promise<CrewMember>;
export async function linkCrewToUser(crewMemberId: string, userId: string): Promise<void>;
export async function inviteCrewToRegister(crewMemberId: string): Promise<void>;
export async function searchAvailableCrew(params: AvailabilitySearchParams): Promise<CrewMember[]>;
export async function getCrewStats(): Promise<CrewStats>;
```

### `src/server/crew-assignments.ts`

```typescript
"use server";
export async function createAssignment(data: CreateAssignmentInput): Promise<CrewAssignment>;
export async function updateAssignment(id: string, data: UpdateAssignmentInput): Promise<CrewAssignment>;
export async function deleteAssignment(id: string): Promise<void>;
export async function getProjectCrew(projectId: string): Promise<CrewAssignment[]>;
export async function getCrewSchedule(crewMemberId: string, dateRange?: DateRange): Promise<CrewAssignment[]>;
export async function offerAssignment(id: string): Promise<void>;  // Send offer email
export async function bulkOfferAssignments(ids: string[]): Promise<void>;
export async function confirmAssignment(id: string): Promise<void>;
export async function respondToOffer(token: string, accept: boolean, note?: string): Promise<void>;
export async function generateShifts(assignmentId: string): Promise<CrewShift[]>;
export async function updateShift(shiftId: string, data: Partial<ShiftInput>): Promise<CrewShift>;
export async function copyCrewFromProject(sourceProjectId: string, targetProjectId: string): Promise<void>;
```

### `src/server/crew-availability.ts`

```typescript
"use server";
export async function addAvailability(data: AvailabilityInput): Promise<CrewAvailability>;
export async function removeAvailability(id: string): Promise<void>;
export async function getCrewAvailability(crewMemberId: string, dateRange: DateRange): Promise<CrewAvailability[]>;
export async function checkCrewConflicts(crewMemberId: string, startDate: Date, endDate: Date, excludeAssignmentId?: string): Promise<Conflict[]>;
```

### `src/server/crew-time.ts`

```typescript
"use server";
export async function createTimeEntry(data: TimeEntryInput): Promise<CrewTimeEntry>;
export async function updateTimeEntry(id: string, data: Partial<TimeEntryInput>): Promise<CrewTimeEntry>;
export async function deleteTimeEntry(id: string): Promise<void>;
export async function getTimeEntries(filters: TimeEntryFilters): Promise<PaginatedResult<CrewTimeEntry>>;
export async function approveTimeEntries(ids: string[]): Promise<void>;
export async function exportTimesheetCSV(filters: TimeEntryFilters): Promise<string>;
```

### `src/server/crew-roles.ts`

```typescript
"use server";
export async function createCrewRole(data: CreateRoleInput): Promise<CrewRole>;
export async function updateCrewRole(id: string, data: UpdateRoleInput): Promise<CrewRole>;
export async function deleteCrewRole(id: string): Promise<void>;
export async function getCrewRoles(): Promise<CrewRole[]>;
```

---

## 16. API Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/crew/calendar/[token].ics` | GET | iCal feed for a crew member | Token in URL (no session required) |
| `/api/crew/calendar/org/[token].ics` | GET | Org-wide crew calendar feed | Org token in URL |
| `/api/crew/assignment/[token]/respond` | GET | Accept/Decline via email link | Token-based |
| `/api/crew/assignment/[id]/ics` | GET | Download single assignment .ics | Authenticated or portal session |
| `/api/documents/[projectId]?type=call-sheet&date=2026-03-15` | GET | Call sheet PDF | Authenticated |

### `/api/crew/calendar/[token].ics`

Returns a full iCal calendar for the crew member. The token is `CrewMember.icalToken`. No authentication required — the secret token IS the auth.

Security:
- Rate limit: 60 requests per hour per IP
- Token must be 32+ bytes of cryptographic randomness
- Regenerate token on demand (invalidates old URL)
- Only include CONFIRMED assignments (not PENDING or OFFERED)

### `/api/crew/assignment/[token]/respond`

Query params: `?action=accept` or `?action=decline`

Performs the action and redirects to a simple confirmation page. The token is a one-time-use token generated when the offer email is sent.

---

## 17. Sidebar & Navigation

Add to the main sidebar:
```typescript
{
  title: "Crew",
  url: "/crew",
  icon: Users, // or HardHat
  resource: "crew",
  children: [
    { title: "Crew List", url: "/crew" },
    { title: "Planner", url: "/crew/planner" },
    { title: "Roles", url: "/crew/roles" },
    { title: "Skills", url: "/crew/skills" },
  ]
}
```

Position in sidebar: after Projects, before Warehouse (crew and projects are closely related).

Add segment labels to top bar:
```typescript
crew: "Crew",
planner: "Planner",
roles: "Roles",
skills: "Skills",
```

---

## 18. Permissions

Add a new `crew` resource to `src/lib/permissions.ts`:

```typescript
crew: ["create", "read", "update", "delete"]
```

Role defaults:
- **owner/admin**: All CRUD
- **manager**: All CRUD
- **member**: Read + create assignments (can add crew to their projects)
- **viewer**: Read only

Sensitive fields (rates, bank details, tax info) should have an additional check — only users with `crew: update` permission can see financial details.

---

## 19. Notifications

Add notification types to `src/server/notifications.ts`:

| Type | Trigger | Link |
|------|---------|------|
| `crew_offer_pending` | Assignment offered, awaiting response for 24h+ | `/projects/{id}` |
| `crew_offer_accepted` | Crew member accepted an offer | `/projects/{id}` |
| `crew_offer_declined` | Crew member declined an offer | `/projects/{id}` |
| `crew_cert_expiring` | Certification expires within 30 days | `/crew/{id}` |
| `crew_upcoming_call` | Assignment starts within 24 hours | `/projects/{id}` |

---

## 20. Search Integration

### Global Search (`src/server/search.ts`)

Add crew member search:
- Search by: firstName, lastName, email, phone, skills, department
- Result links to `/crew/[id]`
- Show role and department as subtitle

### Page Commands (`src/lib/page-commands.ts`)

```typescript
{
  label: "Crew",
  href: "/crew",
  aliases: ["staff", "team", "labour", "labor", "freelancer"],
  icon: "Users",
  description: "Crew management and scheduling",
  searchable: true,
  searchType: "crew",
  children: [
    { label: "Crew Planner", href: "/crew/planner", aliases: ["schedule", "gantt", "timeline"] },
    { label: "Crew Roles", href: "/crew/roles", aliases: ["positions", "job titles"] },
    { label: "Crew Skills", href: "/crew/skills", aliases: ["qualifications", "capabilities"] },
  ]
}
```

---

## 21. PDF Documents

### Call Sheet PDF

New template: `src/lib/pdf/call-sheet-pdf.tsx`

Content:
- Header: Org name/logo, project name, date
- Project info: Location, site contact, parking notes
- Crew table: Name, Role, Call Time, End Time, Phone, Notes
- Grouped by phase (Bump In crew, Event crew, Bump Out crew) or sorted by call time
- Footer: page numbers, generated date

Add `call-sheet` as a document type in `/api/documents/[projectId]` with a required `date` query param.

### Labour Summary on Existing PDFs

On the Quote PDF: optionally include a "Labour" section showing crew roles and rates (not individual names — just "2x Sound Engineer @ $800/day").

On the Invoice PDF: include labour line items if they were converted to `ProjectLineItem` records.

---

## 22. CSV Import/Export

### Export

```typescript
export async function exportCrewCSV(): Promise<string>;
// Columns: firstName, lastName, email, phone, type, department, skills, defaultDayRate, defaultHourlyRate, status

export async function exportCrewAssignmentsCSV(projectId?: string): Promise<string>;
// Columns: crewMember, role, project, phase, startDate, endDate, callTime, rate, status
```

### Import

```typescript
export async function importCrewCSV(csvContent: string): Promise<ImportResult>;
// Upsert by email (unique per org)
// Map columns flexibly (same pattern as asset CSV import)
```

---

## 23. Organization Export/Import

Add all new models to export/import:
- `CrewMember` (remap userId by email matching)
- `CrewRole`
- `CrewSkill`
- `CrewCertification`
- `CrewAssignment` (remap projectId, crewMemberId, crewRoleId, confirmedById)
- `CrewShift`
- `CrewAvailability`
- `CrewTimeEntry`

On import: `icalToken` and `portalToken` should be regenerated (don't import secrets).

---

## 24. Activity Log Integration

If the Activity Log feature is implemented, log:
- Crew member CRUD (create, update, delete/archive)
- Assignment CRUD (create, update status, cancel, confirm)
- Offer sent, accepted, declined
- Time entry submitted, approved, disputed
- Availability changes
- Calendar token regenerated

---

## 25. Integration with Existing Systems

### Project Detail Page

- Add "Crew" tab alongside existing tabs (Info, Line Items, Documents, etc.)
- Show crew assignment summary in the project header area (e.g. "8 crew assigned")
- Labour cost shown in financial summary (below equipment subtotal)

### Dashboard

- "Crew on projects today" stat card
- Crew assignments in the upcoming projects list
- Pending offers / unanswered inquiries alert

### Warehouse

- Warehouse view could show which crew are assigned to check out a project's gear
- No direct functional integration needed in v1

### Project Templates

- Templates can include crew role slots (not specific people):
  - "2x Sound Engineer", "4x Stage Hand", "1x Project Manager"
  - When creating a project from a template, role slots are created as unfilled assignments that need crew members assigned

### Availability Calendar

The existing availability calendar (for equipment) could gain a crew layer showing crew availability alongside equipment availability. This is a stretch goal — keep the systems independent in v1.

---

## 26. Mobile Considerations

### Crew List Page

- Responsive table with progressive column hiding
- Card view option for mobile (name, role, status, quick-call button)

### Crew Planner

- The Gantt view will be challenging on mobile. Fall back to a list view grouped by date on small screens.
- Scroll horizontally on tablets.

### Project Crew Tab

- Stack crew cards vertically on mobile
- Touch-friendly status toggle and action buttons

### Call Sheet

- Call sheet page should be printable and mobile-friendly (crew may view it on their phone on-site)

---

## 27. Implementation Phases

### Phase 1: Core Crew Database

1. Database models: `CrewMember`, `CrewRole`, `CrewSkill`, `CrewCertification`
2. Server actions for CRUD
3. Pages: `/crew`, `/crew/new`, `/crew/[id]`, `/crew/[id]/edit`, `/crew/roles`, `/crew/skills`
4. Sidebar, search, page commands
5. CSV import/export for crew members

### Phase 2: Project Crew Assignments

1. `CrewAssignment` model + `CrewShift` model
2. Assignment CRUD server actions
3. Project detail "Crew" tab with add/remove/edit assignments
4. Phase and schedule management
5. Labour cost calculation on project financials
6. Call sheet PDF generation

### Phase 3: Availability & Scheduling

1. `CrewAvailability` model + CRUD
2. Conflict detection when assigning crew
3. Crew planner page (Gantt-style timeline)
4. Visual availability indicators on crew list

### Phase 4: Calendar Integration

1. iCal feed API route per crew member
2. Per-assignment .ics download
3. Admin-generated calendar invites
4. Org-wide calendar feed
5. Calendar token management

### Phase 5: Communication & Offers

1. Offer/inquiry email flow
2. Accept/Decline via email links
3. Assignment status tracking
4. Bulk operations (offer all, message all)
5. Automatic reminders

### Phase 6: Time Tracking & Payroll

1. `CrewTimeEntry` model + CRUD
2. Admin time entry management
3. Approval workflow
4. Timesheet CSV export for payroll
5. (Future) Crew self-service time logging via portal

### Phase 7: Crew Portal

1. Portal access for non-login crew members
2. Token-based email verification (same pattern as project sharing guest access)
3. Portal pages: schedule, assignment details, availability, timesheets
4. Minimal standalone layout

---

## Notes

- The `CrewMember` model is separate from `User`/`Member` intentionally. Many AV companies manage 50+ freelancers who will never log into the platform. They're contacts with schedules, not software users.
- Crew roles are per-org, not global. Each company has their own terminology ("Bump In Crew" vs "Load In Crew" vs "Setup Team").
- The iCal feed is one-way (read-only). GearFlow publishes the calendar; crew subscribe. Two-way sync (reading crew's personal calendars) is out of scope for v1 but worth considering later.
- Rate and financial data for crew should be gated behind appropriate permissions. A general crew member with platform access should not see other crew members' rates.
- Consider adding a `CrewMember.rating` system later (1-5 stars per assignment, aggregated) — this is what LASSO and Rentman offer for crew performance tracking. Out of scope for v1.
- The crew planner (Gantt view) is the single most complex UI component in this feature. Budget significant time for it, and consider starting with a simpler list/calendar view and upgrading to Gantt later.
