"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "@/lib/client";
import { Button } from "./ui";

export function HostButton({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true); setError(null);
          try {
            const { code } = await request<{ code: string }>("/api/sessions", { body: { quizId } });
            router.push(`/host/${code}`);
          } catch (e) { setError((e as Error).message); setBusy(false); }
        }}
      >
        {busy ? "Starting…" : "Host"}
      </Button>
      {error && <p role="alert" className="text-xs text-wrong">{error}</p>}
    </div>
  );
}
