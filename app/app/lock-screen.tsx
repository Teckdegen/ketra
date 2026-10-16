"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearWallets, hydrateSeeds, unlock } from "@/lib/wallets";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgetConfirm, setForgetConfirm] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length !== 6) {
      setError("Use 6 characters.");
      return;
    }
    setBusy(true);
    setError("");
    const ok = await unlock(password);
    if (!ok) {
      setBusy(false);
      setError("Wrong password.");
      return;
    }
    await hydrateSeeds();
    onUnlock();
  }

  function forgetDevice() {
    clearWallets();
    router.replace("/create");
  }

  return (
    <div className="glass-scrim fixed inset-0 z-50 grid place-items-center overflow-hidden px-5">
      <form onSubmit={submit} className="glass w-full max-w-[420px] rounded-[32px] px-7 py-10 text-center">
        <img src="/icon.png" alt="" className="mx-auto h-14 w-14 rounded-[16px]" />
        <p className="mt-4 text-[28px] font-bold tracking-[-0.04em] italic">KETRA</p>
        <p className="mx-auto mt-6 max-w-[280px] text-[15px] leading-6 text-[#6a6a6a]">Enter the 6-character password for this device.</p>
        <input
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
          type="password"
          maxLength={6}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="glass-field mt-6 h-12 w-full rounded-2xl px-4 text-center text-[18px] tracking-[0.3em] outline-none"
        />
        {error ? <p className="mt-3 text-[13px] text-[#8a8a8a]">{error}</p> : null}
        <button type="submit" disabled={busy} className="mt-4 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white disabled:opacity-50">
          {busy ? "Checking" : "Unlock"}
        </button>
        {forgetConfirm ? (
          <div className="mt-4 text-left">
            <p className="text-[13px] leading-5 text-[#8a8a8a]">This removes every wallet on this device. A seed phrase is the only way back.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={forgetDevice} className="rounded-full bg-[#c4362c] px-4 py-2.5 text-[13px] font-medium text-white">
                Forget this device
              </button>
              <button type="button" onClick={() => setForgetConfirm(false)} className="glass-field rounded-full px-4 py-2.5 text-[13px]">
                Keep them
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setForgetConfirm(true)} className="mt-4 text-[13px] text-[#8a8a8a] underline decoration-[#ddd] underline-offset-2">
            Forgot password?
          </button>
        )}
      </form>
    </div>
  );
}
