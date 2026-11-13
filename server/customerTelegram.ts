import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import { requireOwner } from './auth';
import { dataStore } from './dataStore';
import { debtsForCustomer, lastSunday, saleMessage, splitMessage, weeklyMessage } from './customerTelegramLogic';

interface Link {
  chatId?: string;
  chatName?: string;
  pendingChat?: string;
  pendingName?: string;
  tokenHash?: string;
  expires?: number;
  seenDebts: string[];
  seenPayments: string[];
  weeklyCutoff: number;
}
interface Job {
  id: string; customerId: string; chatId: string; text: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';
  attempts: number; nextAttempt: number; createdAt: string;
  sentAt?: string; messageId?: number; error?: string;
}
interface State {
  token?: string; username?: string; botId?: number;
  enabled: boolean; weeklyHour: number; offset: number; lastError?: string;
  links: Record<string, Link>; jobs: Record<string, Job>;
}
class TelegramFailure extends Error {
  constructor(message: string, public code = 0, public retryAfter = 0) { super(message); }
}
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function paymentEntries(debt: { id: string; paymentHistory?: { date: string; amount: number; method: string; employeeId?: string; employeeName?: string }[] }) {
  const occurrences = new Map<string, number>();
  return (debt.paymentHistory ?? []).map(payment => {
    const value = JSON.stringify([payment.date, payment.amount, payment.method, payment.employeeId ?? '', payment.employeeName ?? '']);
    const count = occurrences.get(value) ?? 0;
    occurrences.set(value, count + 1);
    return { payment, key: sha(debt.id + '|' + value + '|' + count) };
  });
}

export class CustomerTelegram {
  private state: State;
  private running = false;
  constructor(private file: string) {
    this.state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {
      enabled: false, weeklyHour: 9, offset: 0, links: {}, jobs: {}
    };
    // A request may have reached Telegram just before a restart. Retry safely
    // for delivery, although Telegram itself has no sendMessage idempotency key.
    for (const job of Object.values(this.state.jobs)) if (job.status === 'sending') job.status = 'queued';
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.state), { mode: 0o600 });
    fs.renameSync(this.file + '.tmp', this.file);
  }
  private async api(method: string, payload: unknown, token = this.state.token): Promise<any> {
    if (!token) throw new TelegramFailure('Bot tokeni kiritilmagan.');
    let result;
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(10000)
      });
      result = await response.json();
    } catch { throw new TelegramFailure('Telegram bilan aloqa yo‘q. Qayta uriniladi.'); }
    if (!result.ok) throw new TelegramFailure(
      result.error_code === 401 ? 'Bot tokeni yaroqsiz.' :
      result.error_code === 409 ? 'Bot boshqa dasturda ishlayapti. Alohida bot ulang.' :
      result.error_code === 403 ? 'Mijoz botni bloklagan.' : 'Telegram xabari yuborilmadi.',
      result.error_code, result.parameters?.retry_after ?? 0);
    return result.result;
  }
  overview() {
    const customers = dataStore.getState().customers;
    const jobs = Object.values(this.state.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      enabled: this.state.enabled, hasToken: Boolean(this.state.token), username: this.state.username,
      weeklyHour: this.state.weeklyHour, lastError: this.state.lastError,
      localOnly: process.env.POS_LOCAL_DEVICE === '1',
      links: customers.map(c => {
        const link = this.state.links[c.id];
        return { customerId: c.id, name: c.name, connected: Boolean(link?.chatId),
          telegramName: link?.chatName, pending: Boolean(link?.pendingChat), pendingName: link?.pendingName };
      }),
      queued: jobs.filter(j => j.status === 'queued' || j.status === 'sending').length,
      jobs: jobs.slice(0, 40).map(({ chatId: _chatId, ...job }) => ({
        ...job, customerName: customers.find(c => c.id === job.customerId)?.name ?? 'Mijoz'
      }))
    };
  }
  async configure(input: { token?: string; enabled?: boolean; weeklyHour?: number }) {
    const token = input.token?.trim() || this.state.token;
    const hour = input.weeklyHour ?? this.state.weeklyHour;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('Soat 0 dan 23 gacha bo‘lsin.');
    let me;
    if (input.enabled || input.token?.trim()) {
      me = await this.api('getMe', {}, token);
      const webhook = await this.api('getWebhookInfo', {}, token);
      if (webhook.url) throw new Error('Bu bot webhook bilan boshqa tizimga ulangan. Mijozlar uchun alohida bot yarating.');
      if (this.state.botId && me.id !== this.state.botId && Object.values(this.state.links).some(l => l.chatId)) {
        throw new Error('Boshqa botni ulashdan oldin mijozlar ulanishlarini bekor qiling.');
      }
    }
    if (me && this.state.botId && me.id !== this.state.botId) {
      this.state.offset = 0;
      this.state.links = {};
      for (const job of Object.values(this.state.jobs)) if (job.status !== 'sent') job.status = 'cancelled';
    }
    this.state.token = token;
    if (me) { this.state.username = me.username; this.state.botId = me.id; }
    this.state.enabled = input.enabled ?? this.state.enabled;
    this.state.weeklyHour = hour;
    this.state.lastError = undefined;
    this.save();
    return this.overview();
  }
  pair(customerId: string, now = Date.now()) {
    const customer = dataStore.getState().customers.find(c => c.id === customerId);
    if (!customer) throw new Error('Mijoz topilmadi.');
    if (!this.state.enabled || !this.state.username) throw new Error('Avval botni sozlab yoqing.');
    if (this.state.links[customerId]?.chatId) throw new Error('Mijoz allaqachon ulangan.');
    const token = crypto.randomBytes(24).toString('base64url');
    this.state.links[customerId] = { seenDebts: [], seenPayments: [], weeklyCutoff: lastSunday(now, this.state.weeklyHour),
      tokenHash: sha(token), expires: now + 15 * 60000 };
    this.save();
    return { url: `https://t.me/${this.state.username}?start=${token}`, expiresAt: new Date(now + 15 * 60000).toISOString() };
  }
  approve(customerId: string) {
    const link = this.state.links[customerId];
    const db = dataStore.getState();
    const customer = db.customers.find(c => c.id === customerId);
    if (!link?.pendingChat || !customer || (link.expires ?? 0) < Date.now()) throw new Error('Ulash so‘rovi eskirgan yoki topilmadi.');
    if (Object.entries(this.state.links).some(([id, l]) => id !== customerId && l.chatId === link.pendingChat)) {
      throw new Error('Bu Telegram hisobi boshqa mijozga ulangan.');
    }
    link.chatId = link.pendingChat; link.chatName = link.pendingName;
    link.pendingChat = undefined; link.pendingName = undefined; link.tokenHash = undefined; link.expires = undefined;
    const debts = debtsForCustomer(customer, db.customers, db.debts);
    link.seenDebts = debts.map(d => d.id);
    link.seenPayments = debts.flatMap(d => paymentEntries(d).map(entry => entry.key));
    link.weeklyCutoff = lastSunday(Date.now(), this.state.weeklyHour);
    this.enqueue('approved:' + crypto.randomUUID(), customerId, link.chatId,
      `MOBILE PARTS hisobingiz ulandi, ${customer.name}.\nNasiya xaridlari va yakshanbalik hisob shu yerga keladi.\nQarzingizni ko‘rish uchun /qarzim, xabarlarni to‘xtatish uchun /stop.`);
    this.save();
  }
  disconnect(customerId: string) {
    delete this.state.links[customerId];
    for (const job of Object.values(this.state.jobs)) if (job.customerId === customerId && job.status !== 'sent') job.status = 'cancelled';
    this.save();
  }
  retry(id: string) {
    const job = this.state.jobs[id];
    if (!job || job.status !== 'failed') throw new Error('Xato xabar topilmadi.');
    if (this.state.links[job.customerId]?.chatId !== job.chatId) throw new Error('Mijoz qayta ulanishi kerak.');
    job.status = 'queued'; job.nextAttempt = Date.now(); this.save();
  }
  private enqueue(key: string, customerId: string, chatId: string, text: string) {
    splitMessage(text).forEach((part, index) => {
      const id = sha(key + '|' + index);
      if (!this.state.jobs[id]) this.state.jobs[id] = {
        id, customerId, chatId, text: part, status: 'queued', attempts: 0, nextAttempt: 0, createdAt: new Date().toISOString()
      };
    });
  }
  scan(now = Date.now()) {
    const db = dataStore.getState();
    for (const [customerId, link] of Object.entries(this.state.links)) {
      const customer = db.customers.find(c => c.id === customerId);
      if (!link.chatId || !customer) continue;
      const debts = debtsForCustomer(customer, db.customers, db.debts);
      for (const debt of debts) {
        if (!link.seenDebts.includes(debt.id)) {
          this.enqueue('sale:' + debt.id, customerId, link.chatId, saleMessage(customer, debt, debts, db.movements));
          link.seenDebts.push(debt.id);
        }
        paymentEntries(debt).forEach(({ payment, key }) => {
          if (link.seenPayments.includes(key)) return;
          link.seenPayments.push(key);
          if (payment.date === debt.createdAt) return;
          const currency = debt.currency === 'USD' ? 'USD' : 'so‘m';
          const total = debts.filter(d => (d.currency ?? 'UZS') === (debt.currency ?? 'UZS')).reduce((s, d) => s + Math.max(0, d.remainingAmount), 0);
          this.enqueue('payment:' + key, customerId, link.chatId,
            `MOBILE PARTS — ${payment.method === 'vazvrat' ? 'Tovar qaytarildi' : 'Nasiya to‘lovi'}\n${customer.name}\nSumma: ${payment.amount.toLocaleString('uz-UZ')} ${currency}\nJami qolgan qarz: ${total.toLocaleString('uz-UZ')} ${currency}`);
        });
      }
      const cutoff = lastSunday(now, this.state.weeklyHour);
      if (cutoff > link.weeklyCutoff) {
        const text = weeklyMessage(customer, debts, db.movements, cutoff);
        if (text) this.enqueue('weekly:' + customerId + ':' + cutoff, customerId, link.chatId, text);
        link.weeklyCutoff = cutoff;
      }
    }
    this.save();
  }
  private async updates() {
    const updates = await this.api('getUpdates', { offset: this.state.offset, timeout: 0, limit: 30, allowed_updates: ['message'] });
    for (const update of updates) {
      const message = update.message;
      if (message?.chat?.type === 'private' && typeof message.text === 'string') {
        const chatId = String(message.chat.id);
        const command = message.text.trim();
        const start = command.match(/^\/start\s+([A-Za-z0-9_-]{32})$/);
        if (start) {
          const found = Object.entries(this.state.links).find(([, l]) => l.tokenHash === sha(start[1]) && (l.expires ?? 0) > Date.now() && !l.pendingChat && !l.chatId);
          if (found) {
            const [id, link] = found;
            link.pendingChat = chatId;
            link.pendingName = [message.from?.first_name, message.from?.last_name, message.from?.username && '@' + message.from.username].filter(Boolean).join(' ');
            link.tokenHash = undefined;
            this.enqueue('start:' + update.update_id, id, chatId, 'Ulash so‘rovi yuborildi. Do‘kon rahbari tasdiqlagach hisobingiz ulanadi.');
          }
        } else {
          const found = Object.entries(this.state.links).find(([, l]) => l.chatId === chatId);
          if (found) {
            const [id] = found;
            if (command === '/stop') {
              this.disconnect(id);
            } else if (['/qarzim', '/xaridlarim', '/start', '/help', 'Qarzim', 'Xaridlarim'].includes(command.split('@')[0])) {
              const db = dataStore.getState(), customer = db.customers.find(c => c.id === id);
              if (customer) {
                const report = weeklyMessage(customer, debtsForCustomer(customer, db.customers, db.debts), db.movements, Date.now());
                this.enqueue('command:' + update.update_id, id, chatId, report || 'Hozirgi nasiya qarzingiz yo‘q.');
              }
            }
          }
        }
      }
      this.state.offset = update.update_id + 1;
      this.save();
    }
  }
  private async deliver(now: number) {
    const job = Object.values(this.state.jobs).find(j => j.status === 'queued' && j.nextAttempt <= now);
    if (!job) return;
    const link = this.state.links[job.customerId];
    const permitted = dataStore.getState().customers.some(c => c.id === job.customerId) &&
      (link?.chatId === job.chatId || link?.pendingChat === job.chatId);
    if (!permitted) { job.status = 'cancelled'; this.save(); return; }
    job.status = 'sending'; job.attempts++; this.save();
    try {
      const message = await this.api('sendMessage', {
        chat_id: job.chatId, text: job.text, disable_web_page_preview: true,
        reply_markup: { keyboard: [[{ text: 'Qarzim' }, { text: 'Xaridlarim' }]], resize_keyboard: true }
      });
      job.status = 'sent'; job.sentAt = new Date().toISOString(); job.messageId = message.message_id; job.error = undefined;
    } catch (error) {
      const failure = error as TelegramFailure;
      job.error = failure.message;
      job.status = [400, 401, 403].includes(failure.code) ? 'failed' : 'queued';
      job.nextAttempt = now + Math.max(failure.retryAfter * 1000, Math.min(300000, 5000 * 2 ** Math.min(job.attempts, 6)));
    }
    this.save();
  }
  async tick(now = Date.now()) {
    if (this.running || !this.state.enabled) return;
    this.running = true;
    try {
      this.scan(now);
      // Outgoing sales keep flowing even if polling conflicts with another consumer.
      try { await this.updates(); this.state.lastError = undefined; }
      catch (e) { this.state.lastError = (e as Error).message; }
      if (this.state.enabled) await this.deliver(now);
      this.save();
    } finally { this.running = false; }
  }
}

export function installCustomerTelegram(app: Express, local: boolean) {
  const service = new CustomerTelegram(path.resolve('data/customer-telegram.json'));
  app.use('/api/v1/customer-telegram', requireOwner);
  app.get('/api/v1/customer-telegram', (_req, res) => res.set('Cache-Control', 'no-store').json(service.overview()));
  app.post('/api/v1/customer-telegram/config', async (req, res) => {
    if (local) return res.status(400).json({ error: 'Botni VPS saytidan sozlang.' });
    try { res.json(await service.configure(req.body)); }
    catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });
  app.post('/api/v1/customer-telegram/:id/:action', (req, res) => {
    if (local) return res.status(400).json({ error: 'Telegramni VPS saytidan boshqaring.' });
    try {
      const { id, action } = req.params;
      if (action === 'pair') return res.json(service.pair(id));
      if (action === 'approve') service.approve(id);
      else if (action === 'disconnect') service.disconnect(id);
      else if (action === 'retry') service.retry(id);
      else return res.sendStatus(404);
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });
  if (!local) {
    const run = () => service.tick().catch(() => console.error('[Customer Telegram] Navbat vaqtincha to‘xtadi. Qayta uriniladi.'));
    void run();
    setInterval(run, 5000);
  }
}
