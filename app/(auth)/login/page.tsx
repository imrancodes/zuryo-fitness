import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/features/auth/auth-heading";
import { DemoAccessNotice } from "@/features/auth/demo-access-notice";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <AuthHeading title="Welcome back" description="Sign in to continue to your Zuryo workspace." />
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        New to Zuryo?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <DemoAccessNotice />
    </div>
  );
}
