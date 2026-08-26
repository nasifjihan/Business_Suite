"use client";

import { forwardRef } from "react";
import {
  PasswordField,
  PasswordFieldProps,
} from "@/components/auth/PasswordField";

export type GlobalPasswordFieldProps = PasswordFieldProps;

export const GlobalPasswordField = forwardRef<HTMLInputElement, GlobalPasswordFieldProps>(
  function GlobalPasswordField(props, ref) {
    return <PasswordField {...props} ref={ref} />;
  }
);
