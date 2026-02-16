"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AuthTestPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (test: string, success: boolean, message: string, data?: any) => {
    setTestResults((prev) => [
      ...prev,
      {
        test,
        success,
        message,
        data,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const testDatabaseConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/test-db");
      const data = await response.json();

      if (response.ok && data.success) {
        addResult("Database Connection", true, "Database connected successfully", data.results);
        toast.success("Database connection test passed!");
      } else {
        addResult("Database Connection", false, data.error || "Connection failed", data);
        toast.error("Database connection test failed");
      }
    } catch (error) {
      addResult("Database Connection", false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, null);
      toast.error("Database connection test error");
    } finally {
      setIsLoading(false);
    }
  };

  const testUserRegistration = async () => {
    setIsLoading(true);
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;

    try {
      const response = await fetch("/api/auth/registerUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test User",
          email: testEmail,
          password: "password123",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addResult("User Registration", true, `User registered successfully with email: ${testEmail}`, data.user);
        toast.success("User registration test passed!");
      } else {
        addResult("User Registration", false, data.error || "Registration failed", data);
        toast.error(`Registration failed: ${data.error}`);
      }
    } catch (error) {
      addResult("User Registration", false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, null);
      toast.error("User registration test error");
    } finally {
      setIsLoading(false);
    }
  };

  const testVendorRegistration = async () => {
    setIsLoading(true);
    const timestamp = Date.now();
    const testEmail = `testvendor${timestamp}@example.com`;

    try {
      const response = await fetch("/api/auth/registerVendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Vendor",
          email: testEmail,
          password: "password123",
          storeName: `Test Store ${timestamp}`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addResult("Vendor Registration", true, `Vendor registered successfully with email: ${testEmail}`, data.vendor);
        toast.success("Vendor registration test passed!");
      } else {
        addResult("Vendor Registration", false, data.error || "Registration failed", data);
        toast.error(`Registration failed: ${data.error}`);
      }
    } catch (error) {
      addResult("Vendor Registration", false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, null);
      toast.error("Vendor registration test error");
    } finally {
      setIsLoading(false);
    }
  };

  const runAllTests = async () => {
    setTestResults([]);
    await testDatabaseConnection();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await testUserRegistration();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await testVendorRegistration();
  };

  const clearResults = () => {
    setTestResults([]);
    toast.info("Test results cleared");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#e16b22] mb-2">
          Authentication Testing Dashboard
        </h1>
        <p className="text-gray-600">
          Test and verify user registration, vendor registration, and database connectivity
        </p>
      </div>

      {/* Test Controls */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
          <CardDescription>
            Run individual tests or all tests at once
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              onClick={testDatabaseConnection}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Test Database
            </Button>
            <Button
              onClick={testUserRegistration}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              Test User Registration
            </Button>
            <Button
              onClick={testVendorRegistration}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Test Vendor Registration
            </Button>
            <Button
              onClick={runAllTests}
              disabled={isLoading}
              className="bg-[#e16b22] hover:bg-[#cf610d]"
            >
              Run All Tests
            </Button>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={clearResults} variant="outline" size="sm">
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>
            {testResults.length === 0
              ? "No tests run yet. Click a test button above to start."
              : `${testResults.length} test${testResults.length !== 1 ? 's' : ''} completed`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🧪</div>
              <p>No test results yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`border-l-4 p-4 rounded-r-lg ${
                    result.success
                      ? "border-green-500 bg-green-50"
                      : "border-red-500 bg-red-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={result.success ? "default" : "destructive"}
                        className={result.success ? "bg-green-600" : "bg-red-600"}
                      >
                        {result.success ? "✓ PASS" : "✗ FAIL"}
                      </Badge>
                      <h3 className="font-semibold">{result.test}</h3>
                    </div>
                    <span className="text-xs text-gray-500">{result.timestamp}</span>
                  </div>
                  <p className="text-sm mb-2">{result.message}</p>
                  {result.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-800">
                        View Details
                      </summary>
                      <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Testing Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Manual Testing</CardTitle>
          <CardDescription>
            Test authentication flows manually with custom data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* User Registration Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                fetch("/api/auth/registerUser", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: formData.get("name"),
                    email: formData.get("email"),
                    password: formData.get("password"),
                  }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.user) {
                      toast.success("User registered successfully!");
                      addResult("Manual User Registration", true, `Registered: ${data.user.email}`, data.user);
                    } else {
                      toast.error(data.error || "Registration failed");
                      addResult("Manual User Registration", false, data.error, data);
                    }
                  })
                  .catch((error) => {
                    toast.error("Registration error");
                    addResult("Manual User Registration", false, error.message, null);
                  });
              }}
              className="space-y-4 p-4 border rounded-lg"
            >
              <h3 className="font-semibold">User Registration</h3>
              <div>
                <Label htmlFor="user-name">Name</Label>
                <Input id="user-name" name="name" required />
              </div>
              <div>
                <Label htmlFor="user-email">Email</Label>
                <Input id="user-email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="user-password">Password</Label>
                <Input id="user-password" name="password" type="password" required />
              </div>
              <Button type="submit" className="w-full">
                Register User
              </Button>
            </form>

            {/* Vendor Registration Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                fetch("/api/auth/registerVendor", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: formData.get("name"),
                    email: formData.get("email"),
                    password: formData.get("password"),
                    storeName: formData.get("storeName"),
                  }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.vendor) {
                      toast.success("Vendor registered successfully!");
                      addResult("Manual Vendor Registration", true, `Registered: ${data.vendor.email}`, data.vendor);
                    } else {
                      toast.error(data.error || "Registration failed");
                      addResult("Manual Vendor Registration", false, data.error, data);
                    }
                  })
                  .catch((error) => {
                    toast.error("Registration error");
                    addResult("Manual Vendor Registration", false, error.message, null);
                  });
              }}
              className="space-y-4 p-4 border rounded-lg"
            >
              <h3 className="font-semibold">Vendor Registration</h3>
              <div>
                <Label htmlFor="vendor-name">Name</Label>
                <Input id="vendor-name" name="name" required />
              </div>
              <div>
                <Label htmlFor="vendor-email">Email</Label>
                <Input id="vendor-email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="vendor-password">Password</Label>
                <Input id="vendor-password" name="password" type="password" required />
              </div>
              <div>
                <Label htmlFor="vendor-store">Store Name</Label>
                <Input id="vendor-store" name="storeName" required />
              </div>
              <Button type="submit" className="w-full">
                Register Vendor
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
          <CardDescription>Navigate to registration and login pages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button asChild variant="outline">
              <a href="/auth/register" target="_blank">
                User Registration Page
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/vendors/register" target="_blank">
                Vendor Registration Page
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/auth/login" target="_blank">
                Login Page
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
