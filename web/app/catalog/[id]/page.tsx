import { Suspense } from "react";
import { catalog, getCard } from "@/lib/data";
import { CardDetail } from "./CardDetail";
import { RemoteCard } from "./RemoteCard";

export function generateStaticParams() {
  return catalog.map((c) => ({ id: c.id }));
}

async function Card({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCard(id);
  // sample ids render statically; backend ids (e.g. pokemon:base1-4) load from the API
  return c ? <CardDetail c={c} /> : <RemoteCard id={decodeURIComponent(id)} />;
}

export default function CardPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><Card params={params} /></Suspense>;
}
