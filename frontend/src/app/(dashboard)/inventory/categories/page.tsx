"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FolderPlus,
  Folders,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from "@/lib/api/inventoryEndpoints";
import type {
  CategoryItem,
  ListCategoriesArgs,
} from "@/lib/api/inventoryEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(255),
  parentId: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export default function CategoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "inventory.categories.create" });
  const canUpdate = useHasPermission({ one: "inventory.categories.update" });
  const canDelete = useHasPermission({ one: "inventory.categories.delete" });

  const filters: ListCategoriesArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      parentId: searchParams?.get("parentId") ?? undefined,
    };
  }, [searchParams]);

  const { data: categoriesRes, isFetching, refetch } = useListCategoriesQuery(filters, {
    refetchOnMountOrArgChange: true,
  });

  const { data: allCategoriesRes } = useListCategoriesQuery({ page: 1, pageSize: 1000 });

  const categories = extract(categoriesRes as any).items as CategoryItem[];
  const meta = extract(categoriesRes as any).meta;
  const allCategories = extract(allCategoriesRes as any).items as CategoryItem[];

  const parentFilterOptions = useMemo(() => {
    const opts = [{ value: "", label: "All categories" }];
    for (const c of allCategories) {
      opts.push({ value: c.id, label: c.name });
    }
    return opts;
  }, [allCategories]);

  const parentFormOptions = useMemo(() => {
    return allCategories.map((c) => ({ value: c.id, label: c.name }));
  }, [allCategories]);

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
      params.delete("page");
      return params.toString();
    },
    [searchParams]
  );

  const pushParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const qs = buildParams(patch);
      router.push(`?${qs}`, { scroll: false });
    },
    [buildParams, router]
  );

  type ModalState =
    | { kind: "none" }
    | { kind: "create" }
    | { kind: "edit"; category: CategoryItem }
    | { kind: "delete"; category: CategoryItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateCategoryMutation();
  const [updateTrigger, updateState] = useUpdateCategoryMutation();
  const [deleteTrigger, deleteState] = useDeleteCategoryMutation();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      parentId: "",
      description: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      form.reset({
        name: modal.category.name,
        parentId: modal.category.parentId ?? "",
        description: modal.category.description ?? "",
      });
    } else if (modal.kind === "create") {
      form.reset({
        name: "",
        parentId: "",
        description: "",
      });
    }
  }, [modal, form]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const onSubmitCreate = async (v: CategoryFormValues) => {
    const out = await createTrigger({
      name: v.name,
      parentId: v.parentId || undefined,
      description: v.description || undefined,
      isActive: true,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: CategoryFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.category.id,
      body: {
        name: v.name,
        parentId: v.parentId || undefined,
        description: v.description || undefined,
      },
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.category.id);
    setModal({ kind: "none" });
  };

  const onOpenCreate = () => setModal({ kind: "create" });

  const columns: ColumnDef<TableFeatures, CategoryItem, any>[] = useMemo(() => {
    const col = createColumns<CategoryItem>();
    return [
      col.display({
        id: "categoryCode",
        header: "ID",
        cell: ({ row: { original: c } }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[10ch]">
            {c.categoryCode}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Name",
        cell: ({ row: { original: c } }) => (
          <p className="font-medium text-sm text-foreground truncate max-w-[20ch]">{c.name}</p>
        ),
      }),
      col.display({
        id: "parent",
        header: "Parent Category",
        cell: ({ row: { original: c } }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[14ch] block">
            {c.parent?.name ?? "—"}
          </span>
        ),
      }),
      col.display({
        id: "productCount",
        header: "Products",
        cell: ({ row: { original: c } }) => (
          <StatusBadge
            tone="teal"
            size="sm"
            label={`${c.productCount ?? 0}`}
          />
        ),
      }),
      col.display({
        id: "isActive",
        header: "Status",
        cell: ({ row: { original: c } }) => (
          <StatusBadge
            tone={c.isActive ? "emerald" : "slate"}
            size="sm"
            dot={c.isActive}
            label={c.isActive ? "Active" : "Inactive"}
          />
        ),
      }),
      col.accessor("createdAt" as any, {
        id: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row: { original: c } }) => (
          <DateDisplay date={c.createdAt} format="short" />
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: c } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <PermissionGate one="inventory.categories.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "edit", category: c })}
                disabled={!canUpdate}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </PermissionGate>
            <PermissionGate one="inventory.categories.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "delete", category: c })}
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                disabled={!canDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
          </div>
        ),
      }),
    ];
  }, [canUpdate, canDelete]);

  const formIdCreate = "catFormIdCreate";
  const formIdEdit = "catFormIdEdit";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Inventory" }, { label: "Categories" }]}
        title="Categories"
        description="Manage product categories and hierarchical classification."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="inventory.categories.create">
              <Button size="sm" onClick={onOpenCreate} disabled={!canCreate}>
                <FolderPlus className="w-4 h-4" /> New category
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search category names…"
        onCreateNew={canCreate ? onOpenCreate : undefined}
        disableCreateNew={!canCreate}
        startContent={
          <GlobalSelect
            value={filters.parentId ?? ""}
            onChange={(v) => pushParams({ parentId: v })}
            options={parentFilterOptions}
            placeholder="Parent category"
            className="w-48"
          />
        }
      />

      <GlobalTable<CategoryItem>
        columns={columns}
        data={categories}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: categoriesRes?.data as any,
          isFetching,
        }}
        getRowId={(c) => c.id}
        emptyIcon={<Folders className="w-10 h-10" />}
        emptyTitle="No categories found"
        emptyDescription="No categories match the current filters."
        emptyAction={
          <PermissionGate one="inventory.categories.create">
            <Button size="sm" onClick={onOpenCreate}>
              <FolderPlus className="w-4 h-4" /> New category
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new category"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formIdCreate}
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create category"}
            </Button>
          </div>
        }
      >
        <form
          id={formIdCreate}
          onSubmit={form.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
            <GlobalSelect
              label="Parent category"
              value={form.watch("parentId")}
              onChange={(v) => form.setValue("parentId", v, { shouldValidate: true })}
              options={parentFormOptions}
              placeholder="Select parent…"
              error={form.formState.errors.parentId?.message}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Description</label>
            <textarea
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Optional description for this category…"
              rows={4}
              maxLength={2000}
              {...form.register("description")}
            />
            {form.formState.errors.description?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create category."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit category"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formIdEdit}
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id={formIdEdit}
          onSubmit={form.handleSubmit(onSubmitEdit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
            <GlobalSelect
              label="Parent category"
              value={form.watch("parentId")}
              onChange={(v) => form.setValue("parentId", v, { shouldValidate: true })}
              options={parentFormOptions.map((o) => ({
                ...o,
                disabled: modal.kind === "edit" && o.value === modal.category.id,
              }))}
              placeholder="Select parent…"
              error={form.formState.errors.parentId?.message}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Description</label>
            <textarea
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Optional description for this category…"
              rows={4}
              maxLength={2000}
              {...form.register("description")}
            />
            {form.formState.errors.description?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          {updateState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update category."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete category"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Deleting "${modal.category.name}" is permanent and cannot be undone. Products in this category will remain but will no longer be classified under this category.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete category"}
        loading={deleteState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />
    </div>
  );
}
