export type UserRole = "ADMIN" | "ORGANIZER" | "FRANCHISE_OWNER" | "PLAYER";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}