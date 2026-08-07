import { NotificationsDropdown } from "./NotificationsDropdown";
import { UserMenu } from "./UserMenu";

/**
 * Right-most cluster of the header: live notifications + account menu.
 * Renders nothing meaningful if there's no authenticated user, since
 * both children already guard on `useAuthStore`.
 */
export function AuthSection() {
  return (
    <div className="flex items-center gap-1.5">
      <NotificationsDropdown />
      <span aria-hidden className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
      <UserMenu />
    </div>
  );
}