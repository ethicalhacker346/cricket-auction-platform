// src/hooks/useDualImageUpload.ts
import { useCallback, useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/utils/errorMessage";

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadFn = (file: File) => Promise<{ url: string }>;
type RemoveFn = () => Promise<unknown>;
type UpdateFn = (payload: Record<string, string | undefined>) => Promise<unknown>;

type UploadMode = "library" | "custom" | null;

interface UseDualImageUploadOptions {
  /** Current image URL from the entity */
  currentUrl?: string;
  /** React Query key array for the entity detail cache */
  queryKey: readonly unknown[];
  /** Function to upload a custom file (entity-specific API call) */
  uploadFile: UploadFn;
  /** Function to remove the image entirely */
  removeImage: RemoveFn;
  /** Function to update the entity with a library URL (PATCH payload) */
  updateLibraryUrl: (url: string) => ReturnType<UpdateFn>;
  /** Field name in the entity object (e.g. 'profileImage', 'logo') */
  fieldName: string;
  /** Maximum file size in bytes (default 5MB) */
  maxFileSize?: number;
  /** Allowed MIME types */
  acceptedTypes?: string[];
}

interface UseDualImageUploadReturn {
  mode: UploadMode;
  previewUrl: string | undefined;
  isDragging: boolean;
  isUploading: boolean;
  isRemoving: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectLibrary: (url: string) => Promise<void>;
  handleFileSelect: (file: File) => Promise<void>;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  triggerFileInput: () => void;
  remove: () => Promise<void>;
  reset: () => void;
  error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDualImageUpload(
  options: UseDualImageUploadOptions
): UseDualImageUploadReturn {
  const {
    currentUrl,
    queryKey,
    uploadFile,
    removeImage,
    updateLibraryUrl,
    fieldName,
    maxFileSize = 5 * 1024 * 1024,
    acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
  } = options;

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<UploadMode>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep preview in sync if parent prop changes
  useState(() => {
    setPreviewUrl(currentUrl);
  });

  // ─── Custom Upload Mutation ────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      setPreviewUrl(data.url);
      setMode("custom");
      setError(null);
      // Invalidate detail cache so other components see the new URL
      queryClient.invalidateQueries({ queryKey });
      toast.success("Image uploaded successfully");
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      toast.error(getErrorMessage(err));
    },
  });

  // ─── Remove Mutation ───────────────────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: removeImage,
    onSuccess: () => {
      setPreviewUrl(undefined);
      setMode(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey });
      toast.success("Image removed");
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      toast.error(getErrorMessage(err));
    },
  });

  // ─── Library Selection ─────────────────────────────────────────────────────
  const selectLibrary = useCallback(
    async (url: string) => {
      setError(null);
      try {
        await updateLibraryUrl(url);
        setPreviewUrl(url);
        setMode("library");
        queryClient.invalidateQueries({ queryKey });
      } catch (err) {
        setError(getErrorMessage(err));
        toast.error(getErrorMessage(err));
        throw err;
      }
    },
    [updateLibraryUrl, queryClient, queryKey]
  );

  // ─── File Validation ───────────────────────────────────────────────────────
  const validateFile = useCallback(
    (file: File): string | null => {
      if (!acceptedTypes.includes(file.type)) {
        return `Invalid format. Allowed: ${acceptedTypes.map((t) => t.replace("image/", ".")).join(", ")}`;
      }
      if (file.size > maxFileSize) {
        return `File too large. Max: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`;
      }
      return null;
    },
    [acceptedTypes, maxFileSize]
  );

  // ─── File Handling ─────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        toast.error(validationError);
        return;
      }

      // Instant local preview (base64) for snappy UX
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);
      setMode("custom");

      try {
        await uploadMutation.mutateAsync(file);
        URL.revokeObjectURL(localPreview); // clean up blob
      } catch {
        // On error, revert to previous known URL or undefined
        setPreviewUrl(currentUrl);
        setMode(currentUrl ? (currentUrl.includes("cloudinary") ? "custom" : "library") : null);
        URL.revokeObjectURL(localPreview);
      }
    },
    [validateFile, uploadMutation, currentUrl]
  );

  // ─── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const remove = useCallback(async () => {
    setError(null);
    await removeMutation.mutateAsync();
  }, [removeMutation]);

  const reset = useCallback(() => {
    setPreviewUrl(currentUrl);
    setMode(currentUrl ? (currentUrl.includes("cloudinary") ? "custom" : "library") : null);
    setError(null);
  }, [currentUrl]);

  return {
    mode,
    previewUrl,
    isDragging,
    isUploading: uploadMutation.isPending,
    isRemoving: removeMutation.isPending,
    fileInputRef,
    selectLibrary,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    triggerFileInput,
    remove,
    reset,
    error,
  };
}