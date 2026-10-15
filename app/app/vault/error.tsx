"use client";

export default function VaultError({ error }: { error: Error }) {
  return (
    <div>
      <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Vault</h1>
      <p className="mt-3 text-[14px] text-[#8a8a8a]">{error.message || "Morpho did not return this vault."}</p>
    </div>
  );
}
