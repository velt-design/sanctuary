import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

type Role = 'admin' | 'staff';

type EnvUser = {
  email?: string;
  passwordHash?: string;
  role: Role;
};

const USERS: EnvUser[] = [
  {
    email: process.env.STAFF_ADMIN_EMAIL,
    passwordHash: process.env.STAFF_ADMIN_HASH,
    role: 'admin',
  },
  {
    email: process.env.STAFF_USER_EMAIL,
    passwordHash: process.env.STAFF_USER_HASH,
    role: 'staff',
  },
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
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

        const matched = USERS.find((u) => normalizeEmail(u.email ?? '') === email);
        if (!matched?.email || !matched.passwordHash) return null;

        const ok = await bcrypt.compare(password, matched.passwordHash);
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

