"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";
import { useSettings } from "@/hooks/use-settings";

/**
 * Protects authenticated routes by validating the backend session client-side.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const canLoadSettings = !!session && !session.user.mustChangePassword;
  const settings = useSettings(canLoadSettings);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    } else if (!isPending && session?.user.mustChangePassword) {
      router.replace("/change-password");
    } else if (!isPending && settings.data?.locale === null) {
      router.replace("/language");
    }
  }, [isPending, session, settings.data?.locale, router]);

  if (isPending || !session || session.user.mustChangePassword || settings.isPending || settings.data?.locale === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return <>{children}</>;
}
