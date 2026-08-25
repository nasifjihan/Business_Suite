/**
 * Permissions matcher — supports:
 *   "customers:view" exact match
 *   "customers:*"    wildcard (covers view/create/edit/delete/export)
 *   "*"              super-admin — matches everything
 */
export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes("*")) return true;
  if (userPermissions.includes(required)) return true;
  const [reqScope, reqAction] = required.split(":");
  return userPermissions.includes(`${reqScope}:*`);
}

export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

export function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((p) => hasPermission(userPermissions, p));
}
