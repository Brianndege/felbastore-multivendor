import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      storeName?: string;
      sessionVersion?: number;
      mustChangePassword?: boolean;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    storeName?: string;
    sessionVersion?: number;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    storeName?: string;
    sessionVersion?: number;
    mustChangePassword?: boolean;
  }
}
