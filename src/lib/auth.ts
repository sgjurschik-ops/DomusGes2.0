// Auth configuration: NextAuth.js v4 with Credentials provider.
// Passwords are stored as bcrypt hashes in the Professional table.
// No passwords are ever sent to the client.

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

// Tras MAX_FAILED_LOGINS contraseñas incorrectas seguidas, la cuenta queda
// bloqueada LOCK_MINUTES minutos. Un/a administrador/a puede desbloquearla
// antes restableciendo la contraseña.
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const LOCKED_ERROR = "LOCKED";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 }, // 1h — idle timeout in app-shell handles the 15-min cutoff
  pages: { signIn: "/" }, // the SPA handles login UI at /
  providers: [
    CredentialsProvider({
      name: "Nexo",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(creds) {
        if (!creds) return null;
        const parsed = loginSchema.safeParse({
          email: creds.email,
          password: creds.password,
        });
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const prof = await db.professional.findUnique({ where: { email } });
        if (!prof || !prof.isActive) {
          await audit(prof?.id ?? null, "auth.login_failed", "Professional", prof?.id ?? null, { email, reason: prof ? "inactive" : "unknown_email" });
          return null;
        }

        // Cuenta bloqueada temporalmente por demasiados intentos fallidos.
        if (prof.lockedUntil && prof.lockedUntil > new Date()) {
          await audit(prof.id, "auth.login_blocked", "Professional", prof.id);
          throw new Error(LOCKED_ERROR);
        }

        const ok = await bcrypt.compare(parsed.data.password, prof.passwordHash);
        if (!ok) {
          const failed = prof.failedLoginCount + 1;
          const lock = failed >= MAX_FAILED_LOGINS;
          await db.professional.update({
            where: { id: prof.id },
            data: lock
              ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
              : { failedLoginCount: failed },
          });
          await audit(prof.id, lock ? "auth.locked" : "auth.login_failed", "Professional", prof.id, { attempt: failed });
          if (lock) throw new Error(LOCKED_ERROR);
          return null;
        }

        if (prof.failedLoginCount > 0 || prof.lockedUntil) {
          await db.professional.update({
            where: { id: prof.id },
            data: { failedLoginCount: 0, lockedUntil: null },
          });
        }
        await audit(prof.id, "auth.login", "Professional", prof.id);

        return {
          id: prof.id,
          name: prof.name,
          email: prof.email,
          role: prof.role,
        } as const;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
      }
      // Always refresh isActive/isAdmin/userRole from DB so changes take
      // effect without forcing the user to log out and back in.
      const prof = await db.professional.findUnique({
        where: { id: token.id as string },
        select: { isActive: true, isAdmin: true, userRole: true },
      });
      if (!prof || !prof.isActive) {
        return { ...token, expired: true } as typeof token;
      }
      token.isAdmin = prof.isAdmin;
      token.userRole = prof.userRole ?? (prof.isAdmin ? "admin" : "therapist");
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { isAdmin?: boolean }).isAdmin = token.isAdmin as boolean;
        (session.user as { userRole?: string }).userRole = token.userRole as string;
      }
      return session;
    },
  },
};

// Extend the type locally so consumers can read id/role/isAdmin/userRole off session.user.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      isAdmin: boolean;
      userRole: "admin" | "therapist" | "guest";
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isAdmin?: boolean;
    userRole?: string;
    expired?: boolean;
  }
}
