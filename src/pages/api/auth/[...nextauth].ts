import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
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
        userType: { label: "User Type", type: "text" },
      },

      async authorize(credentials) {
        console.log("[NextAuth] Login attempt started");

        if (!credentials?.email || !credentials?.password || !credentials?.userType) {
          throw new Error("MISSING_CREDENTIALS");
        }

        if (!["user", "vendor", "admin"].includes(credentials.userType)) {
          throw new Error("INVALID_USER_TYPE");
        }

        let user: any = null;

        if (credentials.userType === "user" || credentials.userType === "admin") {
          user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
        } else if (credentials.userType === "vendor") {
          user = await prisma.vendor.findUnique({
            where: { email: credentials.email },
          });
        }

        if (!user) {
          if (credentials.userType === "vendor") {
            throw new Error("VENDOR_NOT_FOUND");
          }
          if (credentials.userType === "admin") {
            throw new Error("ADMIN_NOT_FOUND");
          }
          throw new Error("USER_NOT_FOUND");
        }

        if (!user.password) {
          throw new Error("PASSWORD_NOT_SET");
        }

        if (credentials.userType === "admin" && user.role !== "admin") {
          throw new Error("ADMIN_ACCESS_DENIED");
        }

        if (credentials.userType === "user" && user.role === "admin") {
          throw new Error("USER_ROLE_MISMATCH");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("INVALID_PASSWORD");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          storeName: user.storeName || null,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;        // 🔥 IMPORTANT
        token.role = user.role;
        token.storeName = user.storeName;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;   // 🔥 IMPORTANT
        session.user.role = token.role as string;
        session.user.storeName = token.storeName as string | null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
