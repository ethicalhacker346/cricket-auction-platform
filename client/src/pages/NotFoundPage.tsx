import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { loginSchema, type LoginFormValues } from "@/lib/validators/authSchemas";
import { useLogin } from "@/hooks/useAuth";

export default function LoginPage() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = (values: LoginFormValues) => {
    login.mutate(values);
  };

  return (
    <AuthLayout
      title="Welcome back, captain"
      subtitle="Sign in to jump back into the auction room."
      footer={
        <p className="text-sm text-slate-500">
          New to GullyBid?{" "}
          <Link
            to="/register"
            className="font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          icon={<Mail className="h-4 w-4" />}
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <div>
          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex select-none items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                {...register("remember")}
              />
              Remember me
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" isLoading={login.isPending}>
          Sign in
        </Button>

        <div className="relative py-1 text-center">
          <span className="relative z-10 bg-white/80 px-3 text-xs uppercase tracking-wider text-slate-400">
            Secure sign-in
          </span>
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
        </div>

        <p className="text-center text-xs leading-relaxed text-slate-400">
          By continuing you agree to GullyBid's{" "}
          <span className="font-medium text-slate-500">Terms of Service</span> and{" "}
          <span className="font-medium text-slate-500">Privacy Policy</span>.
        </p>
      </form>
    </AuthLayout>
  );
}
