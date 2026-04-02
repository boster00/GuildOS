import { Suspense } from "react";
import SignInClient from "./SignInClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center p-8">Loading…</div>}>
      <SignInClient />
    </Suspense>
  );
}
