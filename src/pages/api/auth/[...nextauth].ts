import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export default NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        userType: { label: "User Type", type: "text" }, // "user" or "vendor"
      },
      async authorize(credentials) {
        console.log('[NextAuth] Login attempt started');

        if (!credentials?.email || !credentials?.password || !credentials?.userType) {
          console.log('[NextAuth] Missing credentials - email:', !!credentials?.email, 'password:', !!credentials?.password, 'userType:', credentials?.userType);
          return null;
        }

        try {
          let user = null;

          console.log('[NextAuth] Looking up user with type:', credentials.userType, 'email:', credentials.email);

          if (credentials.userType === "user") {
            user = await prisma.user.findUnique({
              where: { email: credentials.email },
            });
          } else if (credentials.userType === "vendor") {
            user = await prisma.vendor.findUnique({
              where: { email: credentials.email },
            });
          }

          if (!user) {
            console.log('[NextAuth] User not found for email:', credentials.email);
            return null;
          }

          if (!user.password) {
            console.log('[NextAuth] User found but no password set (OAuth account?)');
            return null;
          }

          console.log('[NextAuth] User found, verifying password...');
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            console.log('[NextAuth] Invalid password for user:', credentials.email);
            return null;
          }

          console.log('[NextAuth] Login successful for user:', user.email, 'role:', user.role);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            storeName: user.storeName || undefined, // Only vendors have storeName
            emailVerified: user.emailVerified,
          };
        } catch (error) {
          console.error("[NextAuth] Auth error:", error);
          console.error('[NextAuth] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.storeName = user.storeName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.storeName = token.storeName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key",
});
