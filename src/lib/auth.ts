// Auth configuration: NextAuth.js v4 with Credentials provider.
// Passwords are stored as bcrypt hashes in the Professional table.
// No passwords are ever sent to the client.

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/schemas";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h idle session
  pages: { signIn: "/" }, // the SPA handles login UI at /
  providers: [
    CredentialsProvider({
      name: "DomusGes",
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

        const prof = await db.professional.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!prof || !prof.isActive) return null;

        const ok = await bcrypt.compare(parsed.data.password, prof.passwordHash);
        if (!ok) return null;

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
        token.role = (user as { role: string }).role;
      }
      // Always refresh isActive/isAdmin from DB so disabled admins are kicked
      const prof = await db.professional.findUnique({
        where: { id: token.id as string },
        select: { isActive: true, isAdmin: true },
      });
      if (!prof || !prof.isActive) {
        // Force sign-out by returning an empty token
        return { ...token, expired: true } as typeof token;
      }
      token.isAdmin = prof.isAdmin;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { isAdmin?: boolean }).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
};

// Extend the type locally so consumers can read id/role/isAdmin off session.user.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      isAdmin: boolean;
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isAdmin?: boolean;
    expired?: boolean;
  }
}
