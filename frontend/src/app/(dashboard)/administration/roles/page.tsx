"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Plus,
  Trash2,
  X,
  Users,
  KeyRound,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useListPermissionsQuery,
  useListRolesQuery,
  useUpdateRoleMutation,
  useGetRoleQuery,
} from "@/lib/api/adminEndpoints";
import type { PermissionsGroupedResponse, RoleItem } from "@/lib/api/adminEndpoints";
import { cn } from "@/lib/utils";
import {
  PermissionGate,
  useHasPermission,
} from "@/components/auth/PermissionGate";

// ─────────────────────────────────────────────────────────────────────────────
// Validators (match backend validators.ts shapes 1:1)
// ─────────────────────────────────────────────────────────────────────────────
const roleFormSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(50),
  displayName: z.string().trim().min(2, "At least 2 characters").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
type RoleFormValues = z.infer<typeof roleFormSchema>;

type Permission =
  PermissionsGroupedResponse["grouped"][number]["items"][number];

export default function RolesPage() {
  const canCreate = useHasPermission({ one: "roles.create" });
  const canUpdate = useHasPermission({ one: "roles.update" });
  const canDelete = useHasPermission({ one: "roles.delete" });

  const {
    data: rolesRes,
    isFetching: rolesLoading,
    refetch: refetchRoles,
  } = useListRolesQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: permsRes } = useListPermissionsQuery();

  const roles = rolesRes?.data?.items ?? [];
  const groupedPerms = permsRes?.data?.grouped ?? [];

  // ── Modals ─────────────────────────────────────────────────────────────────
  type ModalState =
    | { kind: "none" }
    | { kind: "create" }
    | { kind: "edit"; roleId: string }
    | { kind: "delete"; role: RoleItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(groupedPerms.map((g) => g.module))
  );

  // Prefetch detail when entering edit modal
  const { data: roleDetailRes } = useGetRoleQuery(
    modal.kind === "edit" ? modal.roleId : "",
    { skip: modal.kind !== "edit" }
  );

  const [createTrigger, createState] = useCreateRoleMutation();
  const [updateTrigger, updateState] = useUpdateRoleMutation();
  const [deleteTrigger, deleteState] = useDeleteRoleMutation();

  // ── Form (shared create + edit basic fields) ───────────────────────────────
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", displayName: "", description: "" },
    mode: "onTouched",
  });

  // Sync form + permission set when modal kind changes
  useEffect(() => {
    if (modal.kind === "create") {
      form.reset({ name: "", displayName: "", description: "" });
      setSelectedCodes(new Set());
      setExpandedModules(new Set(groupedPerms.map((g) => g.module)));
    } else if (modal.kind === "edit" && roleDetailRes?.success) {
      const rd = roleDetailRes.data;
      form.reset({
        name: rd.name as string,
        displayName: rd.displayName,
        description: rd.description ?? "",
      });
      setSelectedCodes(new Set(rd.permissions.map((p: any) => p.code) ?? []));
      setExpandedModules(new Set(groupedPerms.map((g) => g.module)));
    }
  }, [modal, roleDetailRes, form, groupedPerms]);

  const isSystemEdit =
    modal.kind === "edit" && roleDetailRes?.data?.isSystem;

  // ── Submit handlers ────────────────────────────────────────────────────────
  const onSubmitCreate = async (v: RoleFormValues) => {
    const out = await createTrigger({
      name: v.name,
      displayName: v.displayName,
      description: v.description || undefined,
      permissionCodes: Array.from(selectedCodes),
    });
    if ("data" in out && out.data?.success) {
      setModal({ kind: "none" });
    }
  };

  const onSubmitEdit = async (v: RoleFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.roleId,
      body: {
        ...(isSystemEdit
          ? {}
          : { name: v.name, displayName: v.displayName }),
        description: v.description || undefined,
        permissionCodes: Array.from(selectedCodes),
      },
    });
    if ("data" in out && out.data?.success) {
      setModal({ kind: "none" });
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    const out = await deleteTrigger(modal.role.id);
    if ("data" in out && out.data?.success) {
      setModal({ kind: "none" });
    }
  };

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
    setSelectedCodes(new Set());
  };

  // ── Permission matrix helpers ──────────────────────────────────────────────
  const toggleCode = (code: string) => {
    if (isSystemEdit) return;
    setSelectedCodes((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  };

  const toggleModule = (items: Permission[]) => {
    if (isSystemEdit) return;
    const allChecked = items.every((p) => selectedCodes.has(p.code));
    setSelectedCodes((prev) => {
      const n = new Set(prev);
      items.forEach((p) => {
        if (allChecked) n.delete(p.code);
        else n.add(p.code);
      });
      return n;
    });
  };

  const toggleAllModules = () => {
    if (isSystemEdit) return;
    const all = groupedPerms.flatMap((g) => g.items.map((p) => p.code));
    const allChecked = all.every((c) => selectedCodes.has(c));
    setSelectedCodes(allChecked ? new Set() : new Set(all));
  };

  const moduleCounts = useMemo(() => {
    const m: Record<string, { total: number; checked: number }> = {};
    groupedPerms.forEach((g) => {
      m[g.module] = {
        total: g.items.length,
        checked: g.items.filter((p) => selectedCodes.has(p.code)).length,
      };
    });
    return m;
  }, [groupedPerms, selectedCodes]);

  const totalPerms = groupedPerms.reduce(
    (acc, g) => acc + g.items.length,
    0
  );
  const selectedTotal = selectedCodes.size;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Roles & Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define roles and assign granular permission codes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchRoles()}
            disabled={rolesLoading}
          >
            <RefreshCw
              className={cn(
                "w-4 h-4",
                rolesLoading && "animate-spin"
              )}
            />
            Refresh
          </Button>
          <PermissionGate one="roles.create">
            <Button
              size="sm"
              onClick={() => setModal({ kind: "create" })}
            >
              <Plus className="w-4 h-4" /> New role
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Roles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roles.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "rounded-xl p-2.5 border",
                  r.isSystem
                    ? "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/60"
                    : "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-300 border-sky-200/60 dark:border-sky-900/60"
                )}
              >
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{r.displayName}</h3>
                  {r.isSystem && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/60 font-medium uppercase tracking-wider">
                      System
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {r.name}
                </p>
                {r.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {r.description}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border bg-slate-50 dark:bg-slate-900/50 p-2.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Users
                  </p>
                  <p className="font-semibold leading-tight">
                    {r.userCount}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-slate-50 dark:bg-slate-900/50 p-2.5 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Permissions
                  </p>
                  <p className="font-semibold leading-tight">
                    {r.permissionCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <PermissionGate one="roles.update">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setModal({ kind: "edit", roleId: r.id })}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              </PermissionGate>
              <PermissionGate one="roles.delete">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "delete", role: r })}
                  disabled={r.isSystem}
                  title={r.isSystem ? "Cannot delete a system role" : ""}
                  className={cn(
                    !r.isSystem &&
                      "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </PermissionGate>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Modal backdrop ─────────────────────────────────────────────────── */}
      {modal.kind !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
            {/* Create / Edit role */}
            {(modal.kind === "create" || modal.kind === "edit") && (
              <>
                <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-base font-semibold">
                      {modal.kind === "create"
                        ? "Create new role"
                        : "Edit role permissions"}
                    </h2>
                    {isSystemEdit && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 inline-flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        System role — name is locked, only permissions can be
                        adjusted
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <form
                    onSubmit={form.handleSubmit(
                      modal.kind === "create"
                        ? onSubmitCreate
                        : onSubmitEdit
                    )}
                    className="p-6 space-y-5"
                    noValidate
                  >
                    {/* Basic info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                          Machine name
                        </label>
                        <input
                          {...form.register("name")}
                          disabled={!!isSystemEdit}
                          className={cn(
                            "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 font-mono",
                            form.formState.errors.name
                              ? "border-rose-400"
                              : "border-input",
                            isSystemEdit && "opacity-60 cursor-not-allowed"
                          )}
                          placeholder="e.g. WAREHOUSE_MANAGER"
                        />
                        {form.formState.errors.name && (
                          <p className="text-xs text-rose-500 font-medium">
                            {form.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                          Display name
                        </label>
                        <input
                          {...form.register("displayName")}
                          disabled={!!isSystemEdit}
                          className={cn(
                            "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                            form.formState.errors.displayName
                              ? "border-rose-400"
                              : "border-input",
                            isSystemEdit && "opacity-60 cursor-not-allowed"
                          )}
                        />
                        {form.formState.errors.displayName && (
                          <p className="text-xs text-rose-500 font-medium">
                            {form.formState.errors.displayName.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        Description (optional)
                      </label>
                      <textarea
                        {...form.register("description")}
                        rows={2}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 resize-none"
                      />
                    </div>

                    {/* ── Permission matrix ────────────────────────────── */}
                    <div className="border-t border-border pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            Permission matrix
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Grant individual codes, or check entire modules at
                            once.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold text-foreground">
                              {selectedTotal}
                            </span>{" "}
                            / {totalPerms} selected
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={toggleAllModules}
                            disabled={!!isSystemEdit || totalPerms === 0}
                          >
                            {selectedTotal === totalPerms && totalPerms > 0 ? (
                              <>
                                <CheckSquare className="w-3.5 h-3.5" />
                                Uncheck all
                              </>
                            ) : (
                              <>
                                <Square className="w-3.5 h-3.5" />
                                Check all
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {groupedPerms.length === 0 && (
                          <div className="text-center py-10 text-sm text-slate-500">
                            Loading permission catalog…
                          </div>
                        )}
                        {groupedPerms.map((grp) => {
                          const counts = moduleCounts[grp.module];
                          const allChecked =
                            counts?.total &&
                            counts.checked === counts.total;
                          const isOpen = expandedModules.has(grp.module);
                          return (
                            <div
                              key={grp.module}
                              className="rounded-xl border border-border overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedModules((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(grp.module))
                                      n.delete(grp.module);
                                    else n.add(grp.module);
                                    return n;
                                  })
                                }
                                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleModule(grp.items);
                                  }}
                                  disabled={!!isSystemEdit}
                                  className="text-slate-500 hover:text-primary disabled:opacity-50"
                                >
                                  {allChecked ? (
                                    <CheckSquare className="w-4 h-4" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                                <span className="text-sm font-medium capitalize">
                                  {grp.module}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                  {counts?.checked ?? 0} /{" "}
                                  {counts?.total ?? grp.items.length}
                                </span>
                                <div className="ml-auto text-slate-400">
                                  {isOpen ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </div>
                              </button>
                              {isOpen && (
                                <div className="border-t border-border px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {grp.items.map((p) => {
                                    const checked = selectedCodes.has(p.code);
                                    return (
                                      <label
                                        key={p.code}
                                        className={cn(
                                          "flex items-start gap-2.5 p-2 rounded-lg border border-transparent cursor-pointer transition-colors",
                                          !isSystemEdit &&
                                            "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                                          isSystemEdit &&
                                            "cursor-not-allowed opacity-90"
                                        )}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => toggleCode(p.code)}
                                          disabled={!!isSystemEdit}
                                          className={cn(
                                            "mt-0.5",
                                            checked
                                              ? "text-primary"
                                              : "text-slate-400"
                                          )}
                                        >
                                          {checked ? (
                                            <CheckSquare className="w-4 h-4" />
                                          ) : (
                                            <Square className="w-4 h-4" />
                                          )}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-xs font-mono font-medium">
                                            {p.action}
                                          </div>
                                          {p.description && (
                                            <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                                              {p.description}
                                            </div>
                                          )}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {(createState.isError || updateState.isError) && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                        {(
                          (
                            (createState.isError
                              ? createState.error
                              : updateState.error) as {
                              data?: { error?: { message?: string } };
                            }
                          )?.data?.error?.message ?? "Failed to save role."
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
                        disabled={
                          (modal.kind === "create"
                            ? createState.isLoading || !canCreate
                            : updateState.isLoading || !canUpdate)
                        }
                      >
                        {modal.kind === "create"
                          ? createState.isLoading
                            ? "Creating…"
                            : "Create role"
                          : updateState.isLoading
                          ? "Saving…"
                          : "Save changes"}
                      </Button>
                    </div>
                  </form>
                </div>
              </>
            )}

            {/* Delete role */}
            {modal.kind === "delete" && (
              <>
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="text-base font-semibold">Delete role</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-rose-800 dark:text-rose-200">
                        This action cannot be undone
                      </p>
                      <p className="text-sm text-rose-700 dark:text-rose-300 mt-0.5">
                        Deleting role{" "}
                        <strong>{modal.role.displayName}</strong> (
                        {modal.role.userCount} users) will orphan those users
                        without a role until reassigned.
                      </p>
                    </div>
                  </div>
                  {deleteState.isError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                      {(
                        (
                          deleteState.error as {
                            data?: { error?: { message?: string } };
                          }
                        )?.data?.error?.message ?? "Failed to delete role."
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
                      onClick={handleDelete}
                      disabled={deleteState.isLoading || !canDelete}
                    >
                      {deleteState.isLoading
                        ? "Deleting…"
                        : "Delete role permanently"}
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
