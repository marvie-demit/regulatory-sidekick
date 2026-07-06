import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Reset your password
      </h1>
      <p className="mb-5 mt-1.5 text-sm text-muted">
        Enter your work email and we&apos;ll send you a link to set a new
        password.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
