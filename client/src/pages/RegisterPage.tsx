import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Mail, Phone, User } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { RoleSelector } from "@/components/auth/RoleSelector";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/lib/validators/authSchemas";
import { useRegister } from "@/hooks/useAuth";

export default function RegisterPage() {
  const registerUser = useRegister();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get("role");
  // URL hints only select the three self-registration roles, never ADMIN.
  const initialRole =
    requestedRole === "ORGANIZER" || requestedRole === "FRANCHISE_OWNER"
      ? requestedRole
      : "PLAYER";
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: initialRole,
      terms: false,
    },
  });

  const password = watch("password");

  const onSubmit = (values: RegisterFormValues) => {
    registerUser.mutate(values);
  };

  return (
    <AuthLayout
      title="Create your GullyBid account"
      subtitle="Set up your profile and step into the auction arena."
      footer={
        <p className="text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/login"
            state={location.state}
            className="font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <RoleSelector
              value={field.value}
              onChange={field.onChange}
              error={errors.role?.message}
            />
          )}
        />

        <Input
          label="Full name"
          placeholder="Virat Sharma"
          icon={<User className="h-4 w-4" />}
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            icon={<Mail className="h-4 w-4" />}
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Phone (optional)"
            type="tel"
            placeholder="+91 98765 43210"
            icon={<Phone className="h-4 w-4" />}
            autoComplete="tel"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </div>

        <div>
          <PasswordInput
            label="Password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            maxLength={128}
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <PasswordInput
          label="Confirm password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          maxLength={128}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <div>
          <label className="flex items-start gap-2.5 text-sm text-slate-600">
            <input
              type="checkbox"
              aria-invalid={errors.terms ? true : undefined}
              aria-describedby={errors.terms ? "terms-error" : undefined}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              {...register("terms")}
            />
            <span>
              I agree to GullyBid's{" "}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-800 underline underline-offset-4"
              >
                Terms of Service
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-800 underline underline-offset-4"
              >
                Privacy Policy
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
              .
            </span>
          </label>
          {errors.terms?.message && (
            <p
              id="terms-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-red-600"
            >
              {errors.terms.message}
            </p>
          )}
        </div>

        <Button type="submit" isLoading={registerUser.isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
