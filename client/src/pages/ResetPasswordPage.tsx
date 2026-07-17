import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
} from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { useVerifyResetToken, useResetPassword } from "@/hooks/useAuth";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: tokenData, isLoading: verifying, isError: tokenInvalid, error: tokenError } =
    useVerifyResetToken(token);

  const resetPassword = useResetPassword();
  const isSuccess = resetPassword.isSuccess;

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      navigate("/forgot-password", { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || password !== confirmPassword || password.length < 8) return;
    resetPassword.mutate({ token, password, confirmPassword });
  };

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = password.length >= 8 && hasUpper && hasLower && hasNumber && hasSpecial;

  const canSubmit = isPasswordValid && passwordsMatch && !resetPassword.isPending && !verifying && !tokenInvalid;

  // ─── Invalid Token State ────────────────────────────────────────────────
  if (tokenInvalid) {
    return (
      <AuthLayout
        title="Link expired"
        subtitle="This password reset link is no longer valid."
        footer={
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Request a new link
          </Link>
        }
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 py-6 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">Invalid or expired link</h3>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              {getErrorMessage(tokenError) ||
                "This reset link has expired or already been used. For security, reset links can only be used once and expire after 15 minutes."}
            </p>
          </div>
          <Link to="/forgot-password">
            <Button variant="outline">Request new reset link</Button>
          </Link>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create new password"
      subtitle={
        verifying
          ? "Verifying your reset link..."
          : tokenData
          ? `Resetting password for ${tokenData.email}`
          : "Enter a strong new password for your account."
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-6 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Password updated!</h3>
              <p className="max-w-xs text-sm leading-relaxed text-slate-500">
                Your password has been successfully reset. You'll be redirected to the
                sign-in page in a moment.
              </p>
            </div>
          </motion.div>
        ) : verifying ? (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-12"
          >
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm text-slate-500">Verifying your secure link...</p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Error Banner */}
            <AnimatePresence>
              {resetPassword.isError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-xs leading-relaxed text-red-700">
                      {resetPassword.error?.message ||
                        "Failed to reset password. The link may have expired."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Password Input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white/70 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={password} />
              
              {/* Password Requirements Checklist */}
              {password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  <Requirement met={password.length >= 8}>At least 8 characters</Requirement>
                  <Requirement met={hasUpper}>One uppercase letter</Requirement>
                  <Requirement met={hasLower}>One lowercase letter</Requirement>
                  <Requirement met={hasNumber}>One number</Requirement>
                  <Requirement met={hasSpecial}>One special character</Requirement>
                </ul>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    confirmPassword && !passwordsMatch
                      ? "border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/20"
                      : passwordsMatch
                      ? "border-emerald-300 bg-emerald-50/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                      : "border-slate-200 bg-white/70 focus:border-emerald-500 focus:ring-emerald-500/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="mt-1.5 text-xs font-medium text-red-500">Passwords do not match</p>
              )}
            </div>

            <Button type="submit" isLoading={resetPassword.isPending} disabled={!canSubmit}>
              {resetPassword.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Reset password"
              )}
            </Button>

            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/60 px-4 py-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-xs leading-relaxed text-slate-500">
                For security, this link expires in 15 minutes and can only be used once.
                All your active sessions will be signed out after resetting.
              </p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? "text-emerald-600" : "text-slate-400"}`}>
      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${met ? "bg-emerald-100" : "bg-slate-100"}`}>
        {met ? (
          <CheckCircle2 className="h-2.5 w-2.5" />
        ) : (
          <span className="h-1 w-1 rounded-full bg-slate-300" />
        )}
      </span>
      {children}
    </li>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}