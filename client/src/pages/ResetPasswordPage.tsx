import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import {
  isResetToken,
  useVerifyResetToken,
  useResetPassword,
} from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/utils/errorMessage";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const verification = useVerifyResetToken(token);
  const resetPassword = useResetPassword();
  const requirements = [
    {
      met: password.length >= 8 && password.length <= 128,
      label: "8–128 characters",
    },
    { met: /[A-Z]/.test(password), label: "One uppercase letter" },
    { met: /[a-z]/.test(password), label: "One lowercase letter" },
    { met: /[0-9]/.test(password), label: "One number" },
    { met: /[^A-Za-z0-9]/.test(password), label: "One special character" },
  ];
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;
  const verified = isResetToken(token) && verification.data?.valid === true;
  const canSubmit =
    verified &&
    requirements.every((r) => r.met) &&
    passwordsMatch &&
    !resetPassword.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && token)
      resetPassword.mutate({ token, password, confirmPassword });
  };

  // Never briefly expose an enabled reset form for a missing/malformed token.
  if (!token) return <Navigate to="/forgot-password" replace />;
  if (
    !isResetToken(token) ||
    verification.isError ||
    (verification.isSuccess && !verification.data?.valid)
  ) {
    return (
      <AuthLayout
        title="This link is unavailable"
        subtitle="The password reset link is invalid, expired, or has already been used."
      >
        <div className="space-y-5">
          <p className="text-sm leading-7 text-slate-600">
            Request a fresh link to securely reset your password. Reset links
            can only be used once.
          </p>
          <Link
            className="gb-button gb-button--ink w-full"
            to="/forgot-password"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Request a new reset link
          </Link>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      title="Create new password"
      subtitle={
        verification.isLoading
          ? "Verifying your reset link…"
          : "Choose a strong, unique password for your account."
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {resetPassword.isSuccess ? (
        <div role="status" className="space-y-4 py-5">
          <ShieldCheck
            className="h-9 w-9 text-emerald-800"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold text-slate-900">
            Password updated.
          </h2>
          <p className="text-sm leading-7 text-slate-600">
            You can now sign in with your new password. Taking you back to sign
            in…
          </p>
        </div>
      ) : verification.isLoading ? (
        <p role="status" className="py-8 text-sm text-slate-600">
          Checking your secure reset link…
        </p>
      ) : (
        <form className="space-y-5" onSubmit={submit} noValidate>
          {resetPassword.isError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            >
              {getErrorMessage(resetPassword.error)}
            </p>
          )}
          <div>
            <PasswordInput
              id="new-password"
              name="newPassword"
              label="New password"
              placeholder="Create a strong password"
              autoComplete="new-password"
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-requirements"
            />
            <PasswordStrengthMeter password={password} />
            <ul id="password-requirements" className="mt-3 space-y-1.5">
              {requirements.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center gap-2 text-xs ${item.met ? "text-emerald-800" : "text-slate-600"}`}
                >
                  <Check
                    size={13}
                    className={item.met ? "opacity-100" : "opacity-25"}
                    aria-hidden="true"
                  />
                  <span>
                    {item.label}
                    {item.met && <span className="sr-only"> — met</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <PasswordInput
            id="confirm-password"
            name="confirmPassword"
            label="Confirm password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            maxLength={128}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={
              confirmPassword && !passwordsMatch
                ? "Passwords do not match"
                : undefined
            }
          />
          <Button
            type="submit"
            isLoading={resetPassword.isPending}
            loadingText="Updating password…"
            disabled={!canSubmit}
          >
            Reset password
          </Button>
          <p className="text-xs leading-6 text-slate-600">
            This link expires after 15 minutes and can only be used once. Sign
            in again with your new password after resetting.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
