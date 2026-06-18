# Work record — admin-settings / full-stack-developer

## Task
Create two React view components for the DomusGes app:
1. `/home/z/my-project/src/features/admin/admin-users-view.tsx` — admin-only users management (CRUD + reset password + audit log).
2. `/home/z/my-project/src/features/settings/settings-view.tsx` — settings (profile, centre, account).

## Context reviewed (prior agent records)
The `/agent-ctx` directory was empty when this task started — this is the first agent on the DomusGes refactor. To stay consistent with the codebase, I read the following existing files before writing any code:

- `src/hooks/api.ts` — confirmed hook signatures (`useCurrentSession`, `useProfessionals`, `useCreateProfessional`, `useUpdateProfessional`, `useResetProfessionalPassword`, `useDeleteProfessional`, `useAuditLog`) and `ApiError`.
- `src/lib/schemas.ts` — confirmed `professionalCreateSchema`, `professionalUpdateSchema`, `PROFESSIONAL_ROLES`, `PROFESSIONAL_COLORS`.
- `src/components/domain.tsx` — confirmed `Avatar`, `formatDate`, `formatDateTime` exports.
- `src/types/domain.ts` — confirmed `ProfessionalDTO` and `AuditLogDTO` shapes.
- `src/lib/auth.ts` + `src/lib/server.ts` — confirmed `Session.user` shape (`{ id, name, email, role, isAdmin }`) and `requireAdmin()` server enforcement.
- `src/features/patients/new-patient-form.tsx` and `patient-detail-view.tsx` — copied the existing `useForm` + `zodResolver` + `Controller` + `Field` helper patterns and `toast` usage.
- shadcn/ui components (`dialog.tsx`, `alert-dialog.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `tooltip.tsx`) — confirmed export lists and class hooks.

Future agents working on DomusGes should re-read the above to keep patterns consistent.

## Files created
1. `/home/z/my-project/src/features/admin/admin-users-view.tsx` (~960 lines)
2. `/home/z/my-project/src/features/settings/settings-view.tsx` (~535 lines)

## Key implementation notes (for future agents)
- **react-hook-form + zod v4 typing**: The project has pre-existing TS errors because schemas use `.optional().default(...)`, making `z.input` ≠ `z.output`. In the new files I avoided the issue by using the three-type-parameter overload: `useForm<z.input<typeof schema>, any, z.output<typeof schema>>`. This makes `handleSubmit` expect `SubmitHandler<Output>`. Existing files (`new-patient-form.tsx`, `patient-detail-view.tsx`, `calendar-view.tsx`) still have the old 1-type-parameter pattern and TS errors — consider migrating them later.
- **Avoid `setState` in `useEffect`**: The React Compiler lint rule `react-hooks/set-state-in-effect` fails the build. For loading from `localStorage`, use a lazy `useState(() => readFromStorage())` initializer guarded with `typeof window === "undefined"`. This is safe for components that only mount client-side (e.g. inside an admin-gated tab).
- **Dialog state pattern**: I used a single discriminated union `ModalState` (`{ kind: "create" | "edit" | "reset" | "delete", prof? }`) and conditionally mount each dialog component. Mounting/unmounting (instead of always rendering with `open` prop) ensures `useForm` state is fresh each time.
- **Color picker**: Lives in `ColorPicker` component in admin view; inlined in settings view. Both use `role="radiogroup"`/`role="radio"` with `aria-checked`. Accepts `value: string | undefined` because `color` is optional in the zod input shape.
- **Self-delete protection**: The delete row button is `disabled={user?.id === prof.id}` and the AlertDialog action is also disabled when `isSelf` with an inline warning text.
- **Audit log**: Uses `useAuditLog(50)` and slices to 20 rows; renders in a `max-h-96 overflow-y-auto` Table with a sticky header (`className="sticky top-0 bg-background z-10"`).
- **Centre tab persistence**: localStorage key is `domusges.settings.centre`. Shape: `{ name, address, phone, email }`.

## Verification
- `bun run lint` → 0 errors, 3 pre-existing warnings (in untouched files).
- `bunx tsc --noEmit` → 0 errors in the two new files.
- Dev server still healthy (port 3000 PID 3567).

## Stage Summary
Both views are production-ready and conform to project patterns. They are not yet wired into `page.tsx`'s view router (the task explicitly said not to modify other files); the parent can render them via `<AdminUsersView />` when `view === "admin-users"` and `<SettingsView />` when `view === "settings"`.
