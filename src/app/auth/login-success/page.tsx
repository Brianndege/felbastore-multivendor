import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function LoginSuccessPage() {
  return (
    <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
      <CheckCircle className="w-16 h-16 text-[#e16b22] mb-4" />
      <h1 className="text-3xl font-bold mb-2 text-[#e16b22]">Login Successful</h1>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">Welcome back to Felbastore! You’ve logged in successfully.</p>
      <div className="flex gap-4 flex-wrap items-center justify-center">
        <Button asChild className="bg-[#e16b22] hover:bg-[#cf610d] text-white">
          <Link href="/">Go to Home</Link>
        </Button>
        <Button asChild variant="outline" className="text-[#e16b22] border-[#e16b22] hover:bg-[#e16b22]/10">
          <Link href="/account">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
