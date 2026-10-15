import { redirect } from "next/navigation";

export default async function VaultMarket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/supply/${id}`);
}
