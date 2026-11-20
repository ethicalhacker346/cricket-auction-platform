import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        label={label}
        error={error}
        hint={hint}
        type={visible ? "text" : "password"}
        icon={<Lock className="h-4 w-4" />}
        autoComplete={props.autoComplete ?? "current-password"}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:text-slate-700"
            aria-pressed={visible}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        }
        {...props}
      />
    );
  },
);

PasswordInput.displayName = "PasswordInput";
