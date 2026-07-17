import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Logo } from "@/components/auth/Logo";

interface PageHeaderProps {
  backTo?: string;
  backLabel?: string;
  right?: ReactNode;
}

export function PageHeader({ backTo, backLabel = "Back", right }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Logo />
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </button>
          )}
        </div>
        {right}
      </div>
    </header>
  );
}