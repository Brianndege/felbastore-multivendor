import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
      role: string;
      storeName?: string;
      sessionVersion?: number;
      mustChangePassword?: boolean;
      adminSecurityVerified?: boolean;
      adminAccessKeyId?: string;
      adminAccessKeyExpiresAt?: string;
      adminSessionExpiresAt?: string;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role: string;
    storeName?: string;
    sessionVersion?: number;
    mustChangePassword?: boolean;
    adminSecurityVerified?: boolean;
    adminAccessKeyId?: string;
    adminAccessKeyExpiresAt?: string;
    adminSessionExpiresAt?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    storeName?: string;
    sessionVersion?: number;
    mustChangePassword?: boolean;
    adminSecurityVerified?: boolean;
    adminAccessKeyId?: string | null;
    adminAccessKeyExpiresAt?: string | null;
    adminSessionExpiresAt?: string | null;
  }
}
