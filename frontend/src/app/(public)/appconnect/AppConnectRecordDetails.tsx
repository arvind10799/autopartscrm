import Link from 'next/link';

export type AppConnectRecordDetailRow = {
  label: string;
  value: string;
};

export type AppConnectRecordDetail = {
  title: string;
  subtitle: string;
  badge: string;
  crmUrl: string;
  rows: AppConnectRecordDetailRow[];
};

type AppConnectRecordDetailsProps = {
  actionLabel: string;
  detail: AppConnectRecordDetail;
};

export function AppConnectRecordDetails({
  actionLabel,
  detail,
}: AppConnectRecordDetailsProps) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/30">
        <div className="border-b border-slate-800 bg-slate-950 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">
            RingCentral App Connect
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-white">{detail.title}</h1>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-200">
              {detail.badge}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            {detail.subtitle}
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <dl className="grid gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 sm:grid-cols-2">
            {detail.rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {row.label}
                </dt>
                <dd className="mt-1 break-words text-base font-bold text-white">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href={detail.crmUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center rounded-2xl bg-[#ff5a00] px-5 text-sm font-black text-white shadow-lg shadow-orange-950/30 transition hover:bg-[#e65000]"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AppConnectRecordError({ message }: { message: string }) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-red-400/25 bg-red-400/10 p-6 shadow-2xl shadow-black/30">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-200">
          RingCentral App Connect
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">
          Record unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-200">{message}</p>
      </div>
    </section>
  );
}
