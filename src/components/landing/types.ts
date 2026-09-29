/** Minimal user shape passed from the server landing page into client sections. */
export type LandingUser = {
  name: string;
  email: string;
  role: string;
} | null;
