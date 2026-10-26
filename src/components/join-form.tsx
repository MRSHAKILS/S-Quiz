"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = CODE_RE.test(code);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (valid) router.push(`/j/${code}`);
      }}
      noValidate
    >
      <label htmlFor="code" className="text-sm font-medium">Join code</label>
      <div className="flex gap-2">
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="K7M3QX"
          aria-invalid={touched && !valid}
          aria-describedby="code-help"
          className="tnum h-14 min-w-0 flex-1 rounded-(--radius-control) border border-line bg-surface px-4 font-mono text-2xl tracking-[0.25em] uppercase placeholder:text-muted/50"
        />
        <button
          type="submit"
          className="h-14 rounded-(--radius-control) bg-accent px-6 text-base font-semibold text-accent-ink transition-opacity hover:opacity-90 active:opacity-80"
        >
          Join
        </button>
      </div>
      <p id="code-help" className={`text-sm ${touched && !valid ? "text-wrong" : "text-muted"}`}>
        {touched && !valid ? "Enter the 6-character code shown on the host's screen." : "6 characters, shown on the host's screen."}
      </p>
    </form>
  );
}
