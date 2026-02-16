"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function VendorRegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleVendorRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const storeName = formData.get("storeName") as string;

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/registerVendor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, storeName }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Vendor account created successfully! Please log in.");
        router.push("/auth/login");
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch (err) {
      console.error('Vendor registration error:', err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold">Become a Vendor</h1>
          <p className="text-gray-500">Join thousands of sellers on our platform and reach customers worldwide</p>
        </div>

        <Tabs defaultValue="individual" className="mx-auto max-w-4xl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Individual Seller</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
          </TabsList>

          <TabsContent value="individual">
            <Card>
              <CardHeader>
                <CardTitle>Individual Seller Registration</CardTitle>
                <CardDescription>
                  Perfect for artisans, crafters, and individuals selling their own products
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleVendorRegister}>
                <CardContent className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Personal Information</h3>

                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" name="name" placeholder="John Doe" required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" name="email" type="email" placeholder="johndoe@example.com" required />
                    </div>
                  </div>

                  {/* Account Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Account Information</h3>

                    <div className="space-y-2">
                      <Label htmlFor="storeName">Store Name</Label>
                      <Input id="storeName" name="storeName" placeholder="My Awesome Store" required />
                      <p className="text-xs text-gray-500">This will be visible to customers on your store page</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" name="password" type="password" required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input id="confirmPassword" name="confirmPassword" type="password" required />
                    </div>
                  </div>

                {/* Store Description */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Store Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="description">Store Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Tell customers about yourself and your products..."
                      className="min-h-[120px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Product Categories</Label>
                    <p className="text-xs text-gray-500 mb-2">Select the categories that best match your products</p>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        "Electronics",
                        "Fashion",
                        "Home & Garden",
                        "Beauty & Health",
                        "Toys & Games",
                        "Sports",
                        "Food & Beverage",
                        "Art & Collectibles",
                        "Handmade",
                        "Vintage",
                        "Digital Products",
                        "Others"
                      ].map((category) => (
                        <div key={category} className="flex items-center space-x-2">
                          <Checkbox id={`category-${category}`} />
                          <Label
                            htmlFor={`category-${category}`}
                            className="text-sm font-normal"
                          >
                            {category}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-4">
                  <div className="flex items-start space-x-2">
                    <Checkbox id="terms" className="mt-1" />
                    <div>
                      <Label
                        htmlFor="terms"
                        className="text-sm font-normal"
                      >
                        I agree to the <Link href="/terms" className="text-[#e16b22] hover:underline">Terms and Conditions</Link>, <Link href="/privacy" className="text-[#e16b22] hover:underline">Privacy Policy</Link>, and <Link href="/seller-agreement" className="text-[#e16b22] hover:underline">Seller Agreement</Link>
                      </Label>
                    </div>
                  </div>
                </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Vendor Account"}
                  </Button>
                  <p className="text-center text-sm text-gray-500">
                    Already have a vendor account? <Link href="/auth/login" className="text-violet-600 hover:underline">Log in</Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="business">
            <Card>
              <CardHeader>
                <CardTitle>Business Registration</CardTitle>
                <CardDescription>
                  For registered businesses, companies, and organizations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Business Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Business Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="business-name">Legal Business Name</Label>
                    <Input id="business-name" placeholder="Example Company Inc." />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-type">Business Type</Label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option>Select a business type</option>
                      <option>Sole Proprietorship</option>
                      <option>Partnership</option>
                      <option>Limited Liability Company (LLC)</option>
                      <option>Corporation</option>
                      <option>Nonprofit Organization</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tax-id">Tax ID / Business Number</Label>
                      <Input id="tax-id" placeholder="XX-XXXXXXX" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="years-in-business">Years in Business</Label>
                      <Input id="years-in-business" type="number" min="0" placeholder="1" />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Contact Information</h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Contact Person Name</Label>
                      <Input id="contact-name" placeholder="Jane Smith" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Position/Title</Label>
                      <Input id="position" placeholder="Manager" />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="business-email">Business Email</Label>
                      <Input id="business-email" type="email" placeholder="contact@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-phone">Business Phone</Label>
                      <Input id="business-phone" type="tel" placeholder="+1 (555) 000-0000" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-address">Business Address</Label>
                    <Input id="business-address" placeholder="123 Business St." />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" placeholder="New York" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input id="state" placeholder="NY" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP/Postal Code</Label>
                      <Input id="zip" placeholder="10001" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option>United States</option>
                      <option>Canada</option>
                      <option>United Kingdom</option>
                      <option>Australia</option>
                      <option>Germany</option>
                      <option>France</option>
                      <option>Japan</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                {/* Store Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Store Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="store-name-business">Store Name</Label>
                    <Input id="store-name-business" placeholder="Example Store" />
                    <p className="text-xs text-gray-500">This will be visible to customers on your store page</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username-business">Username</Label>
                    <Input id="username-business" placeholder="example-store" />
                    <p className="text-xs text-gray-500">This will be your store URL: example.com/vendor/username</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Company Website (Optional)</Label>
                    <Input id="website" type="url" placeholder="https://example.com" />
                  </div>
                </div>

                {/* Account Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Account Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="password-business">Password</Label>
                    <Input id="password-business" type="password" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password-business">Confirm Password</Label>
                    <Input id="confirm-password-business" type="password" />
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-4">
                  <div className="flex items-start space-x-2">
                    <Checkbox id="terms-business" className="mt-1" />
                    <div>
                      <Label
                        htmlFor="terms-business"
                        className="text-sm font-normal"
                      >
                        I agree to the <Link href="/terms" className="text-[#e16b22] hover:underline">Terms and Conditions</Link>, <Link href="/privacy" className="text-[#e16b22] hover:underline">Privacy Policy</Link>, and <Link href="/seller-agreement" className="text-[#e16b22] hover:underline">Seller Agreement</Link>
                      </Label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox id="representative" className="mt-1" />
                    <div>
                      <Label
                        htmlFor="representative"
                        className="text-sm font-normal"
                      >
                        I certify that I am an authorized representative of this business and have the authority to register on behalf of this business
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-2">
                <Button className="w-full" size="lg">Create Business Vendor Account</Button>
                <p className="text-center text-sm text-gray-500">
                  Already have a vendor account? <Link href="/vendors/login" className="text-violet-600 hover:underline">Log in</Link>
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Benefits Section */}
        <div className="mt-16">
          <h2 className="mb-8 text-center text-2xl font-bold">Why Sell With Us?</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Reach Millions of Customers",
                description: "Get access to our global customer base and increase your sales potential.",
                icon: "🌎"
              },
              {
                title: "Powerful Seller Tools",
                description: "Manage your inventory, track orders, and analyze sales with our easy-to-use dashboard.",
                icon: "🛠️"
              },
              {
                title: "Low Fees & Fast Payments",
                description: "Competitive fees and quick payment processing so you can focus on growing your business.",
                icon: "💰"
              },
            ].map((benefit, index) => (
              <div key={index} className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-4 text-4xl">{benefit.icon}</div>
                <h3 className="mb-2 text-xl font-semibold">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="mb-8 text-center text-2xl font-bold">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                question: "How much does it cost to become a vendor?",
                answer: "Registration is free. We charge a small commission on each sale, typically between 5-10% depending on your product category."
              },
              {
                question: "How do I get paid?",
                answer: "We process payments every 14 days for all successful orders. You can receive payments via direct deposit, PayPal, or other supported payment methods."
              },
              {
                question: "How do I handle shipping?",
                answer: "You're responsible for shipping your products to customers. You can set your own shipping rates or use our shipping calculator to provide accurate costs."
              },
              {
                question: "What kind of support do you offer vendors?",
                answer: "We provide dedicated vendor support via email, chat, and phone. We also offer resources, guides, and webinars to help you succeed."
              },
            ].map((faq, index) => (
              <div key={index} className="rounded-lg border p-4">
                <h3 className="mb-2 text-lg font-medium">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
