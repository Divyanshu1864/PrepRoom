"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type GoogleSignInButtonProps = {
  callbackUrl?: string;
};

export function GoogleSignInButton({
  callbackUrl = "/dashboard",
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const onGoogleSignIn = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl });
    setIsLoading(false);
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onGoogleSignIn}
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Continue with Google
    </Button>
  );
}
