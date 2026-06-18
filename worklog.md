# DomusGes — Worklog

## Task: admin-settings
- **Agent**: full-stack-developer
- **Task description**: Create two React view components for the DomusGes app — an admin-only users management view (`admin-users-view.tsx`) and a settings view (`settings-view.tsx`) — following the existing project patterns (Next.js 16 App Router, shadcn/ui, TanStack Query via `@/hooks/api`, react-hook-form + zod, Lucide icons, domain atoms at `@/components/domain`).

### Work Log
- Read existing codebase (`hooks/api.ts`, `lib/schemas.ts`, `components/domain.tsx`, `types/domain.ts`, `lib/auth.ts`, `lib/server.ts`, sibling features) to internalize conventions before writing.
- Created `/home/z/my-project/src/features/admin/admin-users-view.tsx` (~960 lines including comments):
  - Header with "Crear usuario" button that opens a Dialog with the create form.
  - Professionals table (Avatar + name/email, role, numColegiado, active Switch toggle, admin Badge, actions column with Edit / Reset password / Delete icon buttons).
  - `ActiveToggle` performs an immediate PATCH via `useUpdateProfessional` with optimistic UI + toast feedback.
  - `CreateUserDialog` uses `useForm` with `zodResolver(professionalCreateSchema)`; renders name/email/role/numColegiado/phone, an 8-swatch `ColorPicker` (buttons with `aria-pressed`), an `isAdmin` Switch, and password + confirmPassword inputs with a show/hide toggle.
  - `EditUserDialog` mirrors the create form minus password, using `professionalUpdateSchema`, pre-filled from the selected professional.
  - `ResetPasswordDialog` collects a new password + confirm (with inline validation, show/hide toggle), calls `useResetProfessionalPassword`.
  - `DeleteUserDialog` is an `AlertDialog`; the delete button in the row is disabled when `user.id === prof.id` (self-protection), and the action button is also disabled + shows an inline warning.
  - `AuditLogCard` renders the last 20 entries from `useAuditLog(50)` in a `Table` with sticky header and `max-h-96` scroll, formatted with `formatDateTime` (es-ES).
  - Defense-in-depth: renders an "Acceso restringido" card if `user.isAdmin` is false.
- Created `/home/z/my-project/src/features/settings/settings-view.tsx` (~535 lines):
  - `Tabs` with "Mi perfil" (always) and "Centro" (admin-only, disabled otherwise).
  - `ProfileTab`: identity summary card (Avatar, name, email, role Badge, admin Badge, "Miembro desde" via `formatDate(joinedAt)`), then a form editable for name/phone/color (read-only email/role). Uses `professionalUpdateSchema.pick({ name, phone, color })` and `useUpdateProfessional` with the full payload (email/role/isActive/isAdmin echoed from the current professional record so the PATCH validates). Submit disabled unless dirty.
  - `CentreTab` (admin): four inputs (Nombre del centro, Dirección, Teléfono, Email de contacto) persisted to `localStorage` under `domusges.settings.centre`. Used a lazy `useState` initializer reading from `localStorage` (no `useEffect` + `setState`, avoiding the `react-hooks/set-state-in-effect` rule). Save button shows a success toast.
  - `AccountSection`: "Cerrar sesión en todos los dispositivos" calls `signOut({ redirect: false })` (placeholder for full token revocation); "Eliminar mi cuenta" is disabled with a `Tooltip` reading "Contacta con el administrador".
- Accessibility: all inputs have `Label htmlFor` ↔ `Input id` pairs (with unique ids across create/edit/reset dialogs to avoid collisions), icon-only buttons have `aria-label`, the color picker uses `role="radiogroup"`/`role="radio"` with `aria-checked`, the active toggle Switch has `aria-label`, loading states use `disabled={isPending}` + pending button labels, and destructive actions use `AlertDialog`.
- Mobile responsiveness: tables wrap with `overflow-x-auto`, columns hide at `md:`/`lg:` breakpoints, form grids collapse from `sm:grid-cols-2` to single column on small screens.
- Fixed a `react-hooks/set-state-in-effect` ESLint error in the Centre tab by switching from `useEffect` + `setCentre`/`setLoaded` to a lazy `useState(() => readCentre())` initializer guarded with `typeof window === "undefined"`.
- Fixed project-wide react-hook-form + zod v4 resolver type mismatches in my two files by using the three-type-parameter overload `useForm<z.input<typeof schema>, any, z.output<typeof schema>>` (TFieldValues = input, TTransformedValues = output), so `handleSubmit` correctly expects `SubmitHandler<Output>`. Adjusted `ColorPicker` to accept `value: string | undefined` since `color` is optional in the input shape.
- Ran `bun run lint` → **0 errors, 3 pre-existing warnings** (all in untouched files: `new-patient-form.tsx`, `patient-detail-view.tsx`, `new-visit-form.tsx`).
- Ran `bunx tsc --noEmit` → **0 errors in the two new files** (pre-existing errors in other files unchanged).

### Stage Summary
Both views are complete, accessible, mobile-responsive, and conform to the project's established patterns (TanStack Query hooks, shadcn/ui, react-hook-form + zod, domain atoms). The admin view covers full CRUD on professionals, password reset, active toggling, self-delete protection, and a scrollable audit log. The settings view covers profile editing (own name/phone/color), admin-only centre settings persisted to localStorage, and account actions (sign-out placeholder + disabled account deletion). ESLint passes with no new errors; TypeScript passes for the two new files. The files are ready to be rendered by the parent `page.tsx` via the existing Zustand view state (`admin-users` and `settings`).
