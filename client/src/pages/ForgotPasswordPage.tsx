import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useForgotPassword } from "@/hooks/useAuth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const forgotPassword = useForgotPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || forgotPassword.isPending) return;
    forgotPassword.mutate(email.trim());
  };

  const isSuccess = forgotPassword.isSuccess;
  const isLoading = forgotPassword.isPending;
  const isError = forgotPassword.isError;

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a secure link to get back into your account."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
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
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center gap-4 py-6 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Check your inbox</h3>
              <p className="max-w-xs text-sm leading-relaxed text-slate-500">
                If an account exists for{" "}
                <span className="font-medium text-slate-700">{email}</span>, a secure
                reset link has been sent. The link expires in 15 minutes.
              </p>
            </div>
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
              <p className="text-xs leading-relaxed text-amber-800">
                <strong>Didn't receive it?</strong> Check your spam folder, or wait a
                few minutes and try again.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Error Banner */}
            <AnimatePresence>
              {isError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-xs leading-relaxed text-red-700">
                      {forgotPassword.error?.message ||
                        "Something went wrong. Please try again in a few minutes."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              icon={<Mail className="h-4 w-4" />}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />

            <Button type="submit" isLoading={isLoading} disabled={!email.trim() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>

            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/60 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-xs leading-relaxed text-slate-500">
                For your security, we can only send a limited number of reset emails
                per hour. The reset link will expire after 15 minutes and can only be
                used once.
              </p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}