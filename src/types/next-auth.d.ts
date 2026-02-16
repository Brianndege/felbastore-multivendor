import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      storeName?: string;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    storeName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    storeName?: string;
  }
}
