import { InvoiceSigningPage } from '@/features/invoices/components/InvoiceSigningPage';

export default async function InvoiceSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <InvoiceSigningPage token={token} />;
}
