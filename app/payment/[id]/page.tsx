import { redirect } from 'next/navigation';

// Retain old booking links while routing every client through the live form.
export default async function PaymentPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const selection = new URLSearchParams();
  for (const key of ['date', 'time']) if (typeof query[key] === 'string') selection.set(key, query[key]);
  selection.set('medium', query.medium === 'inperson' || query.type === 'inperson' ? 'inperson' : 'online');
  redirect(`/schedule/${encodeURIComponent(id)}?${selection}`);
}
