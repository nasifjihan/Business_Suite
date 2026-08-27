import { toast } from "@/components/feedback/Toast";

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function camelToTitle(s: string): string {
  const result = s.replace(/([A-Z])/g, " $1");
  return capitalize(result.trim().toLowerCase());
}

function truncate(s: string, max: number = 120): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

const rtkToastMiddleware =
  (_store: any) => (next: any) => (action: any) => {
    const { type, meta, payload, error } = action ?? {};

    if (typeof type === "string") {
      const arg = meta?.arg;
      const isMutation = arg?.type === "mutation";

      if (type.endsWith("/fulfilled") && isMutation) {
        const endpointName = arg?.endpointName ?? "operation";
        const title = `${camelToTitle(endpointName)} completed successfully`;
        toast.success(title);
      }

      if (type.endsWith("/rejected")) {
        if (isMutation || (meta?.condition === false)) {
          const message =
            (payload?.data?.error?.message as string) ||
            (payload?.data?.message as string) ||
            (payload?.error as string) ||
            (error?.message as string) ||
            "An error occurred";

          const endpointName = arg?.endpointName;
          const title = endpointName
            ? `${camelToTitle(endpointName)} failed`
            : "Request failed";

          const cleanMsg = truncate(String(message), 120);
          toast.error(title, cleanMsg);
        }
      }
    }

    return next(action);
  };

export default rtkToastMiddleware;
