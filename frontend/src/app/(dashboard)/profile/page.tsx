"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  KeyRound,
  Save,
  ShieldCheck,
  UserCircle2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalPasswordField } from "@/components/form/GlobalPasswordField";
import { GlobalInput } from "@/components/form/GlobalInput";
import {
  useChangeOwnPasswordMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
} from "@/lib/api/adminEndpoints";
import { useAppSelector } from "@/store/hooks";
import { useHasPermission } from "@/components/auth/PermissionGate";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});
type ProfileValues = z.infer<typeof profileSchema>;

const changePwSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z.string().regex(passwordRegex, {
      message:
        "Must be 8+ characters with uppercase, lowercase, digit, and one special character.",
    }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must differ from current password.",
    path: ["newPassword"],
  });
type ChangePwValues = z.infer<typeof changePwSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const canAdmin = useHasPermission({ any: ["users.read", "roles.read", "audit.read"] });

  const authUser = useAppSelector((s) => s.auth.user);
  const {
    data: profileRes,
    isFetching: profileLoading,
    refetch,
  } = useGetProfileQuery();
  const profile = profileRes?.data as ProfileValues & { email?: string; avatarUrl?: string | null } | undefined;

  const [updateTrigger, updateState] = useUpdateProfileMutation();
  const [changePwTrigger, changePwState] = useChangeOwnPasswordMutation();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: authUser?.firstName ?? "",
      lastName: authUser?.lastName ?? "",
      phone: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone ?? "",
      });
    }
  }, [profile, profileForm]);

  const onSubmitProfile = async (v: ProfileValues) => {
    const out = await updateTrigger(v);
    if ("data" in out && out.data?.success) {
      refetch();
    }
  };

  const pwForm = useForm<ChangePwValues>({
    resolver: zodResolver(changePwSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const onSubmitPw = async (v: ChangePwValues) => {
    const out = await changePwTrigger({
      currentPassword: v.currentPassword,
      newPassword: v.newPassword,
    });
    if ("data" in out && out.data?.success) {
      pwForm.reset();
    }
  };

  const email = profile?.email ?? authUser?.email;
  const initials = authUser
    ? `${authUser.firstName?.[0] ?? ""}${authUser.lastName?.[0] ?? ""}`.toUpperCase() || "U"
    : "U";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your name, contact information, and security settings."
        breadcrumbs={[{ label: "Profile" }]}
        action={
          canAdmin ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/administration/users">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Users
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-5">
        <div className="rounded-full bg-primary/10 text-primary h-16 w-16 flex items-center justify-center font-semibold text-xl border border-primary/20">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold">
            {profileForm.watch("firstName")}{" "}
            {profileForm.watch("lastName")}
          </p>
          {email && <p className="text-sm text-muted-foreground truncate">{email}</p>}
          <div className="mt-2">
            <StatusBadge
              tone="emerald"
              icon={<ShieldCheck className="w-3 h-3" />}
              size="sm"
              label={authUser?.role ?? "—"}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <UserCircle2 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Personal information</h2>
          </div>

          <form
            onSubmit={profileForm.handleSubmit(onSubmitProfile)}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-2 gap-4">
              <GlobalInput
                label="First name"
                required
                {...profileForm.register("firstName")}
                value={profileForm.watch("firstName")}
                error={profileForm.formState.errors.firstName?.message}
              />
              <GlobalInput
                label="Last name"
                required
                {...profileForm.register("lastName")}
                value={profileForm.watch("lastName")}
                error={profileForm.formState.errors.lastName?.message}
              />
            </div>

            <GlobalInput
              label="Phone (optional)"
              {...profileForm.register("phone")}
              value={profileForm.watch("phone")}
              error={profileForm.formState.errors.phone?.message}
              placeholder="+1 (555) 000-0000"
            />

            {updateState.isSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                Profile updated successfully.
              </div>
            )}
            {updateState.isError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                {(
                  (updateState.error as { data?: { error?: { message?: string } } })
                    .data?.error?.message ?? "Failed to update profile."
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={updateState.isLoading || profileLoading}>
                {updateState.isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </span>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Change password</h2>
          </div>

          <form
            onSubmit={pwForm.handleSubmit(onSubmitPw)}
            className="space-y-4"
            noValidate
          >
            <GlobalPasswordField
              label="Current password"
              error={pwForm.formState.errors.currentPassword?.message}
              placeholder="Enter your current password"
              {...pwForm.register("currentPassword")}
            />
            <GlobalPasswordField
              label="New password"
              error={pwForm.formState.errors.newPassword?.message}
              placeholder="At least 8 characters, upper, lower, digit, special"
              showStrengthMeter
              {...pwForm.register("newPassword")}
            />
            <GlobalPasswordField
              label="Confirm new password"
              error={pwForm.formState.errors.confirmPassword?.message}
              placeholder="Type new password again"
              {...pwForm.register("confirmPassword")}
            />

            {changePwState.isSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                Password changed. Other devices have been signed out.
              </div>
            )}
            {changePwState.isError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                {(
                  (changePwState.error as { data?: { error?: { message?: string } } })
                    .data?.error?.message ?? "Failed to change password."
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={changePwState.isLoading}>
                {changePwState.isLoading ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-dashed border-border bg-card/40 p-6 flex items-start gap-4">
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 p-2 border border-slate-200/70 dark:border-slate-700/70">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Two-factor authentication</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            2FA (TOTP) will be enabled in a later phase. No configuration required today.
          </p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" disabled title="Phase 4 feature">
            Coming soon
          </Button>
        </div>
      </section>
    </div>
  );
}
