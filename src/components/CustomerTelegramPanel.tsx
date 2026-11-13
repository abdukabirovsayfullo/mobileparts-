import React, { useCallback, useEffect, useState } from 'react';

interface Overview {
  enabled: boolean; hasToken: boolean; username?: string; weeklyHour: number; lastError?: string;
  localOnly: boolean; queued: number;
  links: { customerId: string; name: string; connected: boolean; telegramName?: string; pending: boolean; pendingName?: string }[];
  jobs: { id: string; customerName: string; text: string; status: string; createdAt: string; sentAt?: string; error?: string }[];
}

export function CustomerTelegramPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [token, setToken] = useState('');
  const [hour, setHour] = useState('9');
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async (initial = false) => {
    const response = await fetch('/api/v1/customer-telegram', { cache: 'no-store' });
    if (!response.ok) throw new Error('Telegram holatini yuklab bo‘lmadi.');
    const body = await response.json() as Overview;
    setData(body);
    if (initial) { setHour(String(body.weeklyHour)); setEnabled(body.hasToken ? body.enabled : true); }
  }, []);

  useEffect(() => {
    const refresh = () => { void load().catch(() => undefined); };
    void load(true).catch(e => setError(e.message));
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function action(url: string, body: unknown = {}) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/v1/customer-telegram' + url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Amal bajarilmadi.');
      await load();
      return result;
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const labels: Record<string, string> = {
    queued: 'Navbatda', sending: 'Yuborilmoqda', sent: 'Yuborildi', failed: 'Yuborilmadi', cancelled: 'Bekor qilingan'
  };
  const dateLabel = (value: string) => new Date(value).toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  return (
    <section className="space-y-3 rounded-2xl border border-sky-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-black text-stone-950">Telegram — mijozlar nasiya hisobi</h3>
          <p className="text-xs text-stone-600">{data?.enabled ? `Bot yoqilgan · @${data.username}` : 'Bot hali yoqilmagan'} · Navbatda {data?.queued ?? 0} ta xabar</p>
        </div>
        <button type="button" onClick={() => setSettingsOpen(v => !v)} aria-expanded={settingsOpen} className="rounded-lg border px-3 py-2 text-xs font-bold">Bot sozlamalari</button>
      </div>
      <p className="text-xs text-stone-600">Nasiya xaridi va to‘lovidan keyin xabar yuboriladi. Haftalik hisob yakshanba kuni Toshkent vaqti bilan {data?.weeklyHour ?? 9}:00 da keladi.</p>
      {data?.localOnly && <p className="text-sm font-bold text-amber-800">Bot va mijozlar ulanishini VPS saytidan boshqaring. Oflayn savdo VPS’ga sinxronlangach xabar yuboriladi.</p>}
      {settingsOpen && !data?.localOnly && (
        <form className="grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-2" onSubmit={async e => {
          e.preventDefault();
          const result = await action('/config', { ...(token.trim() ? { token: token.trim() } : {}), enabled, weeklyHour: Number(hour) });
          if (result) setToken('');
        }}>
          <label className="text-xs font-bold">Bot tokeni
            <input type="password" autoComplete="new-password" value={token} onChange={e => setToken(e.target.value)} placeholder={data?.hasToken ? 'Token saqlangan. Almashtirish uchun yozing.' : 'BotFather bergan token'} className="mt-1 w-full rounded-lg border p-2 text-stone-900" />
          </label>
          <label className="text-xs font-bold">Yakshanbalik hisob soati · Toshkent
            <select value={hour} onChange={e => setHour(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Avtomatik xabarlar yoqilgan</label>
          <button disabled={busy} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Tekshirilmoqda…' : 'Tekshirish va saqlash'}</button>
        </form>
      )}
      {(error || data?.lastError) && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700">{error || data?.lastError}</p>}
      {!data?.localOnly && (
        <div className="space-y-2">
          {data?.links.map(customer => (
            <div key={customer.customerId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 p-3 text-xs">
              <div><strong>{customer.name}</strong><p className="text-stone-500">{customer.connected ? `Ulangan · ${customer.telegramName}` : customer.pending ? `Tasdiq kutilmoqda · ${customer.pendingName}` : 'Telegram ulanmagan'}</p></div>
              <div className="flex flex-wrap gap-2">
                {customer.pending && <button type="button" disabled={busy} onClick={() => action('/' + encodeURIComponent(customer.customerId) + '/approve')} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">Ulashni tasdiqlash</button>}
                {!customer.connected && !customer.pending && <button type="button" disabled={busy || !data.enabled} onClick={async () => {
                  const result = await action('/' + encodeURIComponent(customer.customerId) + '/pair');
                  if (result) setLink({ name: customer.name, url: result.url });
                }} className="rounded-lg bg-sky-100 px-3 py-2 font-bold text-sky-900 disabled:opacity-50">Telegramga ulash</button>}
                {(customer.connected || customer.pending) && <button type="button" disabled={busy} onClick={() => action('/' + encodeURIComponent(customer.customerId) + '/disconnect')} className="rounded-lg border px-3 py-2">Ulanishni bekor qilish</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {link && (
        <div className="space-y-2 rounded-xl bg-sky-50 p-3 text-xs">
          <strong>{link.name} uchun ulash havolasi</strong>
          <input aria-label="Mijozning Telegram ulash havolasi" readOnly value={link.url} onFocus={e => e.currentTarget.select()} className="w-full rounded-lg border bg-white p-2 text-stone-900" />
          <p>Havola 15 daqiqa amal qiladi. Uni faqat shu mijozga bering. Mijoz botda Start bosgach, Telegramdagi ismini tekshirib «Ulashni tasdiqlash»ni bosing.</p>
          <button type="button" onClick={() => setLink(null)} className="font-bold">Yopish</button>
        </div>
      )}
      {data && (
        <details className="rounded-xl border border-stone-200 p-3">
          <summary className="cursor-pointer text-xs font-bold">Xabarlar tarixi ({data.jobs.length})</summary>
          <p className="mt-2 text-xs text-stone-500">Oxirgi 40 ta xabar. Vaqtlar Toshkent vaqti bilan. «Yuborildi» Telegram qabul qilganini bildiradi; o‘qilganini bildirmaydi.</p>
          <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
            {!data.jobs.length && <p className="py-2 text-xs text-stone-500">Hali xabarlar yo‘q.</p>}
            {data.jobs.map(job => <details key={job.id} className="rounded-lg border border-stone-200 p-3 text-xs">
              <summary className="cursor-pointer space-y-1">
                <span className="font-bold">{job.customerName} · {labels[job.status] || job.status}</span>
                <span className="block text-stone-600">{job.sentAt ? `Yuborilgan: ${dateLabel(job.sentAt)}` : `Navbatga qo‘yilgan: ${dateLabel(job.createdAt)}`}</span>
                <span className="block font-semibold text-sky-700">Xabar matnini ko‘rish</span>
              </summary>
              <p className="mt-2 text-stone-500">Navbatga qo‘yilgan: {dateLabel(job.createdAt)}</p>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-stone-50 p-3 font-sans text-stone-900">{job.text}</pre>
              {job.error && <p className="mt-2 text-red-700">{job.error}</p>}
              {job.status === 'failed' && <button type="button" disabled={busy} onClick={() => action('/' + job.id + '/retry')} className="mt-2 font-bold text-sky-700">Qayta yuborish</button>}
            </details>)}
          </div>
        </details>
      )}
    </section>
  );
}
