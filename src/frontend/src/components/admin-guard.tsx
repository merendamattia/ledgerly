"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";

/** Keeps admin-only pages from rendering for authenticated members. */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const isAdmin = session?.user.role === "admin";

  useEffect(() => {
    if (!isPending && session && !isAdmin) router.replace("/");
  }, [isAdmin, isPending, router, session]);

  if (isPending || !session || !isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return <>{children}</>;
}
