import { prisma } from "@/lib/prisma";

export const PermissionService = {
  /**
   * List all permissions GROUPED BY module, for use in the frontend
   * role permission matrix checkbox widget. Always sorted alphabetically
   * by module first, then code.
   */
  async listAllGrouped() {
    const all = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }],
      select: { id: true, code: true, module: true, action: true, description: true },
    });
    const groups = new Map<string, typeof all>();
    for (const p of all) {
      if (!groups.has(p.module)) groups.set(p.module, []);
      groups.get(p.module)!.push(p);
    }
    return {
      total: all.length,
      grouped: Array.from(groups.entries()).map(([module, items]) => ({ module, items })),
    };
  },

  /** Flat list (for admin search/autocomplete widgets). */
  async listFlat() {
    return prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }],
      select: { id: true, code: true, module: true, action: true, description: true },
    });
  },
};
