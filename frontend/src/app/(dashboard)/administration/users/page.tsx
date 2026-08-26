"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import {
  UserPlus,
  UserRoundCog,
  ShieldCheck,
  Pencil,
  Power,
  RefreshCw,
  Copy,
  CheckCircle2,
  ShieldAlert,
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
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";

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

// ─────────────────────────────────────────────────────────────────────────────
// Role → StatusBadge tone map (NO YELLOW/AMBER family per user profile!)
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_TONE: Record<
  string,
  "violet" | "sky" | "rose" | "emerald" | "teal" | "slate"
> = {
  SUPER_ADMIN: "violet",
  ADMIN: "sky",
  MANAGER: "sky",
  HR: "rose",
  SALES: "emerald",
  CASHIER: "teal",
  VIEWER: "slate",
};

function UsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "users.create" });
  const canUpdate = useHasPermission({ one: "users.update" });
  const authUserId = useAppSelector((s) => s.auth.user?.id);

  // ── Construct filters from URL search params (always source of truth) ───
  const filters: ListUsersArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      status:
        (searchParams?.get("status") as "ACTIVE" | "INACTIVE" | undefined) ||
        undefined,
      roleId: searchParams?.get("roleId") || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const {
    data: usersRes,
    isFetching,
    refetch,
  } = useListUsersQuery(filters, { refetchOnMountOrArgChange: true });
  const { data: rolesRes } = useListRolesQuery();

  const users = usersRes?.data?.items ?? [];
  const meta = usersRes?.data?.meta;
  const roles = rolesRes?.data?.items ?? [];

  const rolesById = useMemo(() => {
    const m = new Map<string, (typeof roles)[number]>();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.displayName })),
    [roles],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      { value: "ACTIVE", label: "Active" },
      { value: "INACTIVE", label: "Inactive" },
    ],
    [],
  );

  const roleFilterOptions = useMemo(
    () => [{ value: "", label: "All roles" }, ...roleOptions],
    [roleOptions],
  );

  // ── Helpers: update filter URL params (shared with GlobalTable URL sync) ──
  const buildParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === "" || v === null) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      });
      params.delete("page"); // Reset to page 1 on any filter change
      return params.toString();
    },
    [searchParams],
  );

  const pushParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const qs = buildParams(patch);
      router.push(`?${qs}`, { scroll: false });
    },
    [buildParams, router],
  );

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

  const onOpenCreate = () => {
    setCreatedPassword(null);
    setModal({ kind: "create" });
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

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<TableFeatures, UserListItem, any>[] = useMemo(() => {
    const col = createColumns<UserListItem>();

    return [
      col.display({
        id: "user",
        header: "User",
        cell: ({ row: { original: u } }) => (
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
        ),
      }),
      col.display({
        id: "role",
        header: "Role",
        cell: ({ row: { original: u } }) => {
          const role = rolesById.get(u.roleId ?? "");
          const tone = ROLE_TONE[u.role] ?? ROLE_TONE.VIEWER;
          return (
            <StatusBadge
              tone={tone}
              size="md"
              icon={<ShieldCheck className="w-3 h-3" />}
              label={role?.displayName ?? u.roleDisplayName ?? u.role}
            />
          );
        },
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: u } }) =>
          u.status === "ACTIVE" ? (
            <StatusBadge
              tone="active"
              size="md"
              dot
              icon={<CheckCircle2 className="w-3 h-3" />}
              label="Active"
            />
          ) : (
            <StatusBadge
              tone="inactive"
              size="md"
              icon={<ShieldAlert className="w-3 h-3" />}
              label="Inactive"
            />
          ),
      }),
      col.accessor("lastLoginAt" as any, {
        id: "lastLoginAt",
        header: "Last login",
        enableSorting: true,
        cell: ({ row: { original: u } }) =>
          u.lastLoginAt ? (
            <DateDisplay date={u.lastLoginAt as string} format="short" />
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: u } }) => {
          const isSelf = u.id === authUserId;
          return (
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
                    onClick={() => setModal({ kind: "deactivate", user: u })}
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
                    onClick={() => setModal({ kind: "activate", user: u })}
                    className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Activate</span>
                  </Button>
                )}
              </PermissionGate>
            </div>
          );
        },
      }),
    ];
  }, [authUserId, rolesById]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Administration" }, { label: "Users" }]}
        title="Users"
        description="Manage system accounts, roles, and access."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={cn("w-4 h-4", isFetching && "animate-spin")}
              />
              Refresh
            </Button>
            <PermissionGate one="users.create">
              <Button size="sm" onClick={onOpenCreate}>
                <UserPlus className="w-4 h-4" /> New user
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by name or email…"
        onCreateNew={canCreate ? onOpenCreate : undefined}
        disableCreateNew={!canCreate}
        startContent={
          <>
            <GlobalSelect
              value={filters.status ?? ""}
              onChange={(v) => pushParams({ status: v })}
              options={statusOptions}
              placeholder="Status"
              className="w-40"
            />
            <GlobalSelect
              value={filters.roleId ?? ""}
              onChange={(v) => pushParams({ roleId: v })}
              options={roleFilterOptions}
              placeholder="Role"
              className="w-48"
            />
          </>
        }
      />

      <GlobalTable<UserListItem>
        columns={columns}
        data={users}
        meta={meta}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: usersRes?.data as any,
          isFetching,
        }}
        getRowId={(u) => u.id}
        emptyIcon={<UserRoundCog className="w-10 h-10" />}
        emptyTitle="No users found"
        emptyDescription="No users match the current filters."
        emptyAction={
          <PermissionGate one="users.create">
            <Button size="sm" onClick={onOpenCreate}>
              <UserPlus className="w-4 h-4" /> New user
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      {/* ─── GlobalModal: Create user ─────────────────────────────────────── */}
      <GlobalModal
        open={modal.kind === "create" && !createdPassword}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new user"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-user-form"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create user"}
            </Button>
          </div>
        }
      >
        <form
          id="create-user-form"
          onSubmit={form.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="First name"
              required
              error={form.formState.errors.firstName?.message}
              {...form.register("firstName")}
            />
            <GlobalInput
              label="Last name"
              required
              error={form.formState.errors.lastName?.message}
              {...form.register("lastName")}
            />
          </div>
          <GlobalInput
            label="Email"
            inputType="email"
            required
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <GlobalSelect
            label="Role"
            required
            value={form.watch("roleId")}
            onChange={(v) =>
              form.setValue("roleId", v, { shouldValidate: true })
            }
            options={roleOptions}
            placeholder="Select a role…"
            error={form.formState.errors.roleId?.message}
          />
          <GlobalInput
            label="Phone (optional)"
            error={form.formState.errors.phone?.message}
            {...form.register("phone")}
          />

          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                createState.error as {
                  data?: { error?: { message?: string } };
                }
              ).data?.error?.message ?? "Failed to create user."}
            </div>
          )}
        </form>
      </GlobalModal>

      {/* ─── GlobalModal: Created password (shown ONCE after create) ──────── */}
      <GlobalModal
        open={modal.kind === "create" && !!createdPassword}
        onOpenChange={(o) => !o && closeModal()}
        title="User created"
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button onClick={closeModal}>Done</Button>
          </div>
        }
      >
        <div className="space-y-4">
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
              <span className="truncate select-all">{createdPassword}</span>
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
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </GlobalModal>

      {/* ─── GlobalModal: Edit user ─────────────────────────────────────── */}
      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit user"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-user-form"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="edit-user-form"
          onSubmit={form.handleSubmit(onSubmitEdit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="First name"
              required
              error={form.formState.errors.firstName?.message}
              {...form.register("firstName")}
            />
            <GlobalInput
              label="Last name"
              required
              error={form.formState.errors.lastName?.message}
              {...form.register("lastName")}
            />
          </div>
          <GlobalInput
            label="Email"
            inputType="email"
            required
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <GlobalSelect
            label="Role"
            required
            value={form.watch("roleId")}
            onChange={(v) =>
              form.setValue("roleId", v, { shouldValidate: true })
            }
            options={roleOptions}
            placeholder="Select a role…"
            error={form.formState.errors.roleId?.message}
          />
          <GlobalInput
            label="Phone (optional)"
            error={form.formState.errors.phone?.message}
            {...form.register("phone")}
          />

          {updateState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                updateState.error as {
                  data?: { error?: { message?: string } };
                }
              ).data?.error?.message ?? "Failed to update user."}
            </div>
          )}
        </form>
      </GlobalModal>

      {/* ─── ConfirmDialog: Deactivate ───────────────────────────────────── */}
      <ConfirmDialog
        open={modal.kind === "deactivate"}
        onOpenChange={(o) => !o && closeModal()}
        title="Deactivate user"
        variant="destructive"
        description={
          modal.kind === "deactivate"
            ? `Deactivating ${modal.user.firstName} ${modal.user.lastName} will sign them out of every device immediately. They will not be able to sign back in until reactivated.`
            : ""
        }
        confirmText={
          deactivateState.isLoading ? "Deactivating…" : "Deactivate user"
        }
        loading={deactivateState.isLoading}
        icon={<ShieldAlert className="w-5 h-5" />}
        onConfirm={handleDeactivate}
      />

      {/* ─── ConfirmDialog: Activate ─────────────────────────────────────── */}
      <ConfirmDialog
        open={modal.kind === "activate"}
        onOpenChange={(o) => !o && closeModal()}
        title="Reactivate user"
        variant="primary"
        description={
          modal.kind === "activate"
            ? `Reactivating ${modal.user.firstName} ${modal.user.lastName} will allow them to sign in again.`
            : ""
        }
        confirmText={
          activateState.isLoading ? "Activating…" : "Reactivate user"
        }
        loading={activateState.isLoading}
        onConfirm={handleActivate}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div>Loading users...</div>}>
      <UsersPageContent />
    </Suspense>
  );
}
