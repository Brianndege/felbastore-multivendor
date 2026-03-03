import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login");
  }

  const userName = session.user.name || "User";
  const userEmail = session.user.email || "";
  const userImage = session.user.image || undefined;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader className="items-center text-center">
            <Avatar className="h-20 w-20">
              {userImage ? <AvatarImage src={userImage} alt={userName} /> : null}
              <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <CardTitle className="mt-3">My Account</CardTitle>
            <CardDescription>Authenticated account profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{userName}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{userEmail}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="font-medium">{session.user.role}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
