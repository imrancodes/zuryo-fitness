import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/features/auth/auth-heading";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="space-y-8">
      <AuthHeading title="Create your account" description="Join Zuryo as a customer or a trainer." />
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
