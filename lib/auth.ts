import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

type Role = 'admin' | 'staff';

type EnvUser = {
  email?: string;
  password?: string;
  passwordHash?: string;
  role: Role;
};

function splitEmailList(raw: string): string[] {
  return raw
    .split(/[,\n]/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function getUsersFromEnv(): EnvUser[] {
  const users: EnvUser[] = [];

  users.push({
    email: process.env.STAFF_ADMIN_EMAIL,
    password: process.env.STAFF_ADMIN_PASSWORD,
    passwordHash: process.env.STAFF_ADMIN_HASH,
    role: 'admin',
  });

  const staffEmails = splitEmailList([process.env.STAFF_USER_EMAILS, process.env.STAFF_USER_EMAIL].filter(Boolean).join(','));
  for (const email of staffEmails) {
    users.push({
      email,
      password: process.env.STAFF_USER_PASSWORD,
      passwordHash: process.env.STAFF_USER_HASH,
      role: 'staff',
    });
  }

  return users;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

async function verifyUserPassword(user: EnvUser, password: string): Promise<boolean> {
  const plain = typeof user.password === 'string' ? user.password : '';
  if (plain) return timingSafeEqualStr(password, plain);

  const hash = typeof user.passwordHash === 'string' ? user.passwordHash : '';
  if (hash) return bcrypt.compare(password, hash);

  return false;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },

  providers: [
    CredentialsProvider({
      name: 'Staff Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email ?? '');
        const password = credentials?.password ?? '';
        if (!email || !password) return null;

        const users = getUsersFromEnv();
        const matched = users.find((u) => normalizeEmail(u.email ?? '') === email);
        if (!matched?.email) return null;

        const ok = await verifyUserPassword(matched, password);
        if (!ok) return null;

        return { id: matched.email, email: matched.email, role: matched.role } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = (token as any).role ?? 'staff';
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },
};
