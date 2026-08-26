"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  UserPlus,
  Search,
  UserRoundCog,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Power,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useActivateUserMutation,
  useCreateUserMutation,
  useDeactivateUserMutation,
  useListRolesQuery,
  useListUsersQuery,
  useUpdateUserMutation,
} from "@/lib/api/adminEndpoints";
import type { ListUsersArgs, UserListItem } from "@/lib/api/adminEndpoints";
import { cn } from "@/lib/utils";
import {
  PermissionGate,
  useHasPermission,
} from "@/components/auth/PermissionGate";
import { useAppSelector } from "@/store/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Validators (match backend validators.ts shapes 1:1)
// ─────────────────────────────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userFormSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(50),
  lastName: z.string().trim().min(1, "Required").max(50),
  email: z.string().trim().regex(emailRegex, "Invalid email").max(255),
  roleId: z.string().min(1, "Role is required"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});
type UserFormValues = z.infer<typeof userFormSchema>;

export default function UsersPage() {
  const canCreate = useHasPermission({ one: "users.create" });
  const canUpdate = useHasPermission({ one: "users.update" });
  const authUserId = useAppSelector((s) => s.auth.user?.id);

  // ── Filters / Pagination ──────────────────────────────────────────────────
  const [filters, setFilters] = useState<ListUsersArgs>({
    page: 1,
    pageSize: 25,
    search: "",
    status: undefined,
    roleId: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const searchInput = filters.search ?? "";

  const {
    data: usersRes,
    isFetching,
    refetch,
  } = useListUsersQuery(filters, { refetchOnMountOrArgChange: true });
  const { data: rolesRes } = useListRolesQuery();

  const users = usersRes?.data?.items ?? [];
  const meta = usersRes?.data?.meta;
  const roles = rolesRes?.data?.items ?? [];

  // ── Modals ─────────────────────────────────────────────────────────────────
  type ModalState =
    | { kind: "none" }
    | { kind: "create" }
    | { kind: "edit"; user: UserListItem }
    | { kind: "deactivate"; user: UserListItem }
    | { kind: "activate"; user: UserListItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [createTrigger, createState] = useCreateUserMutation();
  const [updateTrigger, updateState] = useUpdateUserMutation();
  const [activateTrigger, activateState] = useActivateUserMutation();
  const [deactivateTrigger, deactivateState] = useDeactivateUserMutation();

  const rolesById = useMemo(() => {
    const m = new Map<string, (typeof roles)[number]>();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  // ── Form (shared between create + edit) ────────────────────────────────────
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      roleId: "",
      phone: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      form.reset({
        firstName: modal.user.firstName,
        lastName: modal.user.lastName,
        email: modal.user.email,
        roleId: modal.user.roleId ?? "",
        phone: (modal.user as UserListItem & { phone?: string }).phone ?? "",
      });
    } else if (modal.kind === "create") {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        roleId: roles[0]?.id ?? "",
        phone: "",
      });
    }
  }, [modal, form, roles]);

  const onSubmitCreate = async (v: UserFormValues) => {
    const out = await createTrigger({
      ...v,
      phone: v.phone || undefined,
    });
    if ("data" in out && out.data?.success) {
      setCreatedPassword(out.data.data.temporaryPassword);
    }
  };

  const onSubmitEdit = async (v: UserFormValues) => {
    if (modal.kind !== "edit") return;
    await updateTrigger({
      id: modal.user.id,
      body: { ...v, phone: v.phone || undefined },
    });
    if ("data" in updateState && updateState.data?.success) {
      setModal({ kind: "none" });
    }
  };

  const handleActivate = async () => {
    if (modal.kind !== "activate") return;
    await activateTrigger(modal.user.id);
    setModal({ kind: "none" });
  };

  const handleDeactivate = async () => {
    if (modal.kind !== "deactivate") return;
    await deactivateTrigger(modal.user.id);
    setModal({ kind: "none" });
  };

  const closeModal = () => {
    setModal({ kind: "none" });
    setCreatedPassword(null);
    form.reset();
  };

  // ── Copy created pw ────────────────────────────────────────────────────────
  const copyPassword = async () => {
    if (!createdPassword) return;
    try {
      await navigator.clipboard.writeText(createdPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const initials = (u: UserListItem) =>
    `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const roleTone: Record<string, string> = {
    SUPER_ADMIN:
      "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/60",
    ADMIN:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-900/60",
    MANAGER:
      "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200/60 dark:border-sky-900/60",
    HR:
      "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 border-pink-200/60 dark:border-pink-900/60",
    SALES:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/60",
    CASHIER:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/60",
    VIEWER:
      "bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60",
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system accounts, roles, and access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn(
                "w-4 h-4",
                isFetching && "animate-spin"
              )}
            />
            Refresh
          </Button>
          <PermissionGate one="users.create">
            <Button
              size="sm"
              onClick={() => {
                setCreatedPassword(null);
                setModal({ kind: "create" });
              }}
            >
              <UserPlus className="w-4 h-4" /> New user
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))
            }
            placeholder="Search by name or email…"
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filters.status ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: e.target.value
                  ? (e.target.value as ListUsersArgs["status"])
                  : undefined,
                page: 1,
              }))
            }
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <select
          value={filters.roleId ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              roleId: e.target.value || undefined,
              page: 1,
            }))
          }
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-border text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left font-medium px-5 py-3">User</th>
                <th className="text-left font-medium px-5 py-3">Role</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-left font-medium px-5 py-3">Last login</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 && !isFetching && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-16 text-center text-slate-500"
                  >
                    <UserRoundCog className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No users match the current filters.</p>
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const role = rolesById.get(u.roleId ?? "");
                const isSelf = u.id === authUserId;
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 text-primary h-9 w-9 shrink-0 flex items-center justify-center font-semibold text-sm border border-primary/20">
                          {initials(u)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium",
                          roleTone[u.role] ??
                            roleTone.VIEWER
                        )}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {role?.displayName ?? u.roleDisplayName ?? u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60 font-medium">
                          <ShieldAlert className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <PermissionGate one="users.update">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModal({ kind: "edit", user: u })}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          {u.status === "ACTIVE" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setModal({ kind: "deactivate", user: u })
                              }
                              disabled={isSelf}
                              title={isSelf ? "Cannot deactivate yourself" : ""}
                              className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Deactivate</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setModal({ kind: "activate", user: u })
                              }
                              className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Activate</span>
                            </Button>
                          )}
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {meta && (
          <div className="border-t border-border px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              {meta.totalItems === 0
                ? 0
                : (meta.page - 1) * meta.pageSize + 1}
              —{" "}
              {Math.min(meta.page * meta.pageSize, meta.totalItems)} of{" "}
              {meta.totalItems}
            </p>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasPrevious}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
                }
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <span className="px-3 text-xs text-muted-foreground">
                Page {meta.page} / {meta.totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasNext}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                }
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modal backdrop ─────────────────────────────────────────────────── */}
      {modal.kind !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Create User */}
            {modal.kind === "create" && (
              <>
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="text-base font-semibold">
                    {createdPassword
                      ? "User created"
                      : "Create new user"}
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!createdPassword ? (
                  <form
                    onSubmit={form.handleSubmit(onSubmitCreate)}
                    className="p-6 space-y-4"
                    noValidate
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                          First name
                        </label>
                        <input
                          {...form.register("firstName")}
                          className={cn(
                            "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                            form.formState.errors.firstName
                              ? "border-rose-400"
                              : "border-input"
                          )}
                        />
                        {form.formState.errors.firstName && (
                          <p className="text-xs text-rose-500 font-medium">
                            {form.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                          Last name
                        </label>
                        <input
                          {...form.register("lastName")}
                          className={cn(
                            "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                            form.formState.errors.lastName
                              ? "border-rose-400"
                              : "border-input"
                          )}
                        />
                        {form.formState.errors.lastName && (
                          <p className="text-xs text-rose-500 font-medium">
                            {form.formState.errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Email</label>
                      <input
                        type="email"
                        {...form.register("email")}
                        className={cn(
                          "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                          form.formState.errors.email
                            ? "border-rose-400"
                            : "border-input"
                        )}
                      />
                      {form.formState.errors.email && (
                        <p className="text-xs text-rose-500 font-medium">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Role</label>
                      <select
                        {...form.register("roleId")}
                        className={cn(
                          "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                          form.formState.errors.roleId
                            ? "border-rose-400"
                            : "border-input"
                        )}
                      >
                        <option value="">Select a role…</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.displayName}
                          </option>
                        ))}
                      </select>
                      {form.formState.errors.roleId && (
                        <p className="text-xs text-rose-500 font-medium">
                          {form.formState.errors.roleId.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        Phone (optional)
                      </label>
                      <input
                        {...form.register("phone")}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      />
                    </div>

                    {createState.isError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                        {(
                          (
                            createState.error as {
                              data?: { error?: { message?: string } };
                            }
                          ).data?.error?.message ?? "Failed to create user."
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeModal}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createState.isLoading || !canCreate}
                      >
                        {createState.isLoading
                          ? "Creating…"
                          : "Create user"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="p-6 space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <div>
                          <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                            Account created successfully
                          </p>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
                            User must change their password on first login.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Temporary password — shown ONLY ONCE
                      </label>
                      <div className="mt-1.5 rounded-lg border border-border bg-slate-50 dark:bg-slate-900/60 px-3 py-2 font-mono text-base flex items-center justify-between gap-3">
                        <span className="truncate select-all">
                          {createdPassword}
                        </span>
                        <button
                          type="button"
                          onClick={copyPassword}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {copied ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button onClick={closeModal}>Done</Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Edit User */}
            {modal.kind === "edit" && (
              <>
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="text-base font-semibold">Edit user</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form
                  onSubmit={form.handleSubmit(onSubmitEdit)}
                  className="p-6 space-y-4"
                  noValidate
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">First name</label>
                      <input
                        {...form.register("firstName")}
                        className={cn(
                          "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                          form.formState.errors.firstName
                            ? "border-rose-400"
                            : "border-input"
                        )}
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-xs text-rose-500 font-medium">
                          {form.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Last name</label>
                      <input
                        {...form.register("lastName")}
                        className={cn(
                          "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                          form.formState.errors.lastName
                            ? "border-rose-400"
                            : "border-input"
                        )}
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-xs text-rose-500 font-medium">
                          {form.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Email</label>
                    <input
                      type="email"
                      {...form.register("email")}
                      className={cn(
                        "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                        form.formState.errors.email
                          ? "border-rose-400"
                          : "border-input"
                      )}
                    />
                    {form.formState.errors.email && (
                      <p className="text-xs text-rose-500 font-medium">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Role</label>
                    <select
                      {...form.register("roleId")}
                      className={cn(
                        "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                        form.formState.errors.roleId
                          ? "border-rose-400"
                          : "border-input"
                      )}
                    >
                      <option value="">Select a role…</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Phone (optional)
                    </label>
                    <input
                      {...form.register("phone")}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    />
                  </div>

                  {updateState.isError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                      {(
                        (
                          updateState.error as {
                            data?: { error?: { message?: string } };
                          }
                        ).data?.error?.message ?? "Failed to update user."
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeModal}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateState.isLoading || !canUpdate}
                    >
                      {updateState.isLoading ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </form>
              </>
            )}

            {/* Deactivate */}
            {modal.kind === "deactivate" && (
              <>
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="text-base font-semibold">Deactivate user</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-200">
                        Revoke all sessions immediately
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                        Deactivating{" "}
                        <strong>
                          {modal.user.firstName} {modal.user.lastName}
                        </strong>{" "}
                        will sign them out of every device right now. They will
                        not be able to sign back in until reactivated.
                      </p>
                    </div>
                  </div>
                  {deactivateState.isError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                      {(
                        (
                          deactivateState.error as {
                            data?: { error?: { message?: string } };
                          }
                        ).data?.error?.message ?? "Failed to deactivate user."
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeModal}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeactivate}
                      disabled={deactivateState.isLoading}
                    >
                      {deactivateState.isLoading
                        ? "Deactivating…"
                        : "Deactivate user"}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Activate */}
            {modal.kind === "activate" && (
              <>
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="text-base font-semibold">Reactivate user</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Reactivating{" "}
                    <strong>
                      {modal.user.firstName} {modal.user.lastName}
                    </strong>{" "}
                    will allow them to sign in again.
                  </p>
                  {activateState.isError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                      {(
                        (
                          activateState.error as {
                            data?: { error?: { message?: string } };
                          }
                        ).data?.error?.message ?? "Failed to activate user."
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeModal}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleActivate} disabled={activateState.isLoading}>
                      {activateState.isLoading
                        ? "Activating…"
                        : "Reactivate user"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
