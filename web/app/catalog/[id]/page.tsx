import { notFound } from "next/navigation";
import { catalog, getCard } from "@/lib/data";
import { CardDetail } from "./CardDetail";

export function generateStaticParams() {
  return catalog.map((c) => ({ id: c.id }));
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCard(id);
  if (!c) notFound();
  return <CardDetail c={c} />;
}
