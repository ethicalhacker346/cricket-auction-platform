"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/Button";
import { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "default" | "destructive" | "outline";
  onConfirm: () => void;
  isLoading?: boolean;
  children?: ReactNode;
}

/**
 * Beautiful Confirm Dialog Component
 * - Built on Radix + shadcn/ui AlertDialog
 * - Elegant glassmorphic style with subtle shadows and transitions
 * - Supports loading state, destructive actions, and rich content
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "default",
  onConfirm,
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[420px] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-md">
        <AlertDialogHeader className="space-y-3 text-left">
          <AlertDialogTitle className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </AlertDialogTitle>
          
          <AlertDialogDescription className="text-slate-600 dark:text-slate-400 text-[15.5px] leading-relaxed">
            {description}
            {children && <div className="mt-4">{children}</div>}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
          <AlertDialogCancel asChild>
            <Button 
              variant="outline" 
              className="w-full sm:w-auto font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              disabled={isLoading}
            >
              {cancelText}
            </Button>
          </AlertDialogCancel>

          <AlertDialogAction asChild>
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={isLoading}
              isLoading={isLoading}
              className="w-full sm:w-auto font-semibold shadow-sm active:scale-[0.985] transition-transform"
            >
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}