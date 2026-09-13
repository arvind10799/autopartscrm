import Link from 'next/link';
import { requestBackend } from '@/lib/api/backend-api';
import { AutoCloseLookupMiss } from './AutoCloseLookupMiss';

type CustomerLookupMatch = {
  exists: true;
  customerName: string;
  phone: string | null;
  recordType: 'order' | 'lead';
  recordId: string;
  recordLabel: string;
  crmUrl: string;
};

type CustomerLookupMiss = {
  exists: false;
  phone: string;
  message: string;
};

type CustomerLookupResult = CustomerLookupMatch | CustomerLookupMiss;

type CustomerLookupPageProps = {
  searchParams: Promise<{
    phone?: string;
    token?: string;
  }>;
};

export default async function RingCentralCustomerLookupPage({
  searchParams,
}: CustomerLookupPageProps) {
  const params = await searchParams;
  const phone = params.phone ?? '';
  const token = params.token ?? '';
  const result = await loadCustomerLookup(phone, token);

  if (result.success && result.data && !result.data.exists) {
    return <AutoCloseLookupMiss />;
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/30">
        <div className="border-b border-slate-800 bg-slate-950 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">
            RingCentral Lookup
          </p>
          <h1 className="mt-2 text-2xl font-black text-white">
            {result.success && result.data?.exists
              ? 'Existing Customer'
              : 'Lookup Issue'}
          </h1>
        </div>

        <div className="space-y-4 px-6 py-6">
          {!result.success ? (
            <StatusCard
              tone="error"
              title="Lookup unavailable"
              description={result.message}
            />
          ) : result.data?.exists ? (
            <ExistingCustomerCard match={result.data} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

async function loadCustomerLookup(phone: string, token: string) {
  const backendPath = `/ringcentral/customer-lookup?phone=${encodeURIComponent(
    phone,
  )}&token=${encodeURIComponent(token)}`;
  const { status, payload } = await requestBackend<CustomerLookupResult>(
    backendPath,
  );

  if (status >= 400 || !payload.success || !payload.data) {
    return {
      success: false,
      message: payload.message || 'Unable to lookup caller.',
      data: null,
    };
  }

  return {
    success: true,
    message: payload.message,
    data: payload.data,
  };
}

function ExistingCustomerCard({ match }: { match: CustomerLookupMatch }) {
  return (
    <>
      <dl className="space-y-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
        <LookupRow label="Customer" value={match.customerName} />
        <LookupRow label="Phone" value={match.phone || 'Not available'} />
        <LookupRow
          label="Record"
          value={`${capitalize(match.recordType)} · ${match.recordLabel}`}
        />
      </dl>
      <Link
        href={match.crmUrl}
        target="_blank"
        rel="noreferrer"
        className="flex h-12 items-center justify-center rounded-2xl bg-[#ff5a00] px-5 text-sm font-black text-white shadow-lg shadow-orange-950/30 transition hover:bg-[#e65000]"
      >
        Open CRM Record
      </Link>
    </>
  );
}

function StatusCard({
  tone,
  title,
  description,
}: {
  tone: 'neutral' | 'error';
  title: string;
  description: string;
}) {
  const classes =
    tone === 'error'
      ? 'border-red-400/25 bg-red-400/10 text-red-100'
      : 'border-sky-400/25 bg-sky-400/10 text-sky-100';

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function LookupRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-base font-bold text-white">{value}</dd>
    </div>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
