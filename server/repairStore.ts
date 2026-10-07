import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type RepairStatus = 'received' | 'repairing' | 'ready' | 'delivered' | 'cancelled';

export interface RepairOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  deviceColor: string;
  complaint: string;
  agreedPrice?: number;
  advance: number;
  dueDate: string;
  dueTime?: string;
  note?: string;
  status: RepairStatus;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

interface RepairDatabase {
  nextOrderNumber: number;
  orders: RepairOrder[];
  updatedAt: string;
}

const REPAIR_FILE = path.join(process.cwd(), 'data', 'repairs.json');
const allowedStatuses = new Set<RepairStatus>(['received', 'repairing', 'ready', 'delivered', 'cancelled']);

function emptyDatabase(): RepairDatabase {
  return { nextOrderNumber: 1, orders: [], updatedAt: new Date().toISOString() };
}

function loadDatabase(): RepairDatabase {
  try {
    if (fs.existsSync(REPAIR_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(REPAIR_FILE, 'utf8')) as RepairDatabase;
      if (Array.isArray(parsed.orders) && Number.isInteger(parsed.nextOrderNumber)) return parsed;
    }
  } catch (error) {
    console.error('[RepairStore] repairs.json o‘qilmadi:', error);
  }
  return emptyDatabase();
}

let database = loadDatabase();

function saveDatabase(): void {
  database.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(REPAIR_FILE), { recursive: true });
  const tempFile = `${REPAIR_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(database, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tempFile, REPAIR_FILE);
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export const repairStore = {
  list(): RepairOrder[] {
    return [...database.orders].sort((a, b) => b.orderNumber - a.orderNumber);
  },

  create(input: Record<string, unknown>): RepairOrder {
    const customerName = cleanText(input.customerName, 80);
    const customerPhone = cleanText(input.customerPhone, 30);
    const deviceModel = cleanText(input.deviceModel, 100);
    const deviceColor = cleanText(input.deviceColor, 50);
    const complaint = cleanText(input.complaint, 500);
    const dueDate = cleanText(input.dueDate, 10);
    const dueTime = cleanText(input.dueTime, 5);
    const note = cleanText(input.note, 500);
    const agreedPrice = input.agreedPrice === '' || input.agreedPrice == null ? undefined : Number(input.agreedPrice);
    const advance = input.advance === '' || input.advance == null ? 0 : Number(input.advance);

    if (customerName.length < 2) throw new Error('Mijoz ismini kiriting.');
    if (customerPhone.length < 3) throw new Error('Mijoz telefon raqamini kiriting.');
    if (deviceModel.length < 2) throw new Error('Telefon modelini kiriting.');
    if (complaint.length < 2) throw new Error('Mijoz shikoyatini kiriting.');
    if (!validDate(dueDate)) throw new Error('Tayyor bo‘lish sanasini kiriting.');
    if (dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) throw new Error('Tayyor bo‘lish vaqti noto‘g‘ri.');
    if (agreedPrice !== undefined && (!Number.isFinite(agreedPrice) || agreedPrice < 0)) throw new Error('Kelishilgan narx noto‘g‘ri.');
    if (!Number.isFinite(advance) || advance < 0) throw new Error('Avans noto‘g‘ri.');
    if (agreedPrice !== undefined && advance > agreedPrice) throw new Error('Avans kelishilgan narxdan katta bo‘lmaydi.');

    const now = new Date().toISOString();
    const order: RepairOrder = {
      id: `repair-${crypto.randomUUID()}`,
      orderNumber: database.nextOrderNumber,
      customerName,
      customerPhone,
      deviceModel,
      deviceColor,
      complaint,
      agreedPrice,
      advance,
      dueDate,
      dueTime: dueTime || undefined,
      note: note || undefined,
      status: 'received',
      createdAt: now,
      updatedAt: now
    };
    database.nextOrderNumber += 1;
    database.orders.push(order);
    saveDatabase();
    return order;
  },

  update(id: string, input: Record<string, unknown>): RepairOrder {
    const order = database.orders.find(item => item.id === id);
    if (!order) throw new Error('Buyurtma topilmadi.');
    if (input.status !== undefined) {
      const status = String(input.status) as RepairStatus;
      if (!allowedStatuses.has(status)) throw new Error('Noto‘g‘ri holat.');
      order.status = status;
      order.deliveredAt = status === 'delivered' ? new Date().toISOString() : undefined;
    }
    if (input.agreedPrice !== undefined) {
      const price = input.agreedPrice === '' ? undefined : Number(input.agreedPrice);
      if (price !== undefined && (!Number.isFinite(price) || price < 0)) throw new Error('Narx noto‘g‘ri.');
      order.agreedPrice = price;
    }
    if (input.advance !== undefined) {
      const advance = Number(input.advance);
      if (!Number.isFinite(advance) || advance < 0) throw new Error('Avans noto‘g‘ri.');
      order.advance = advance;
    }
    order.updatedAt = new Date().toISOString();
    saveDatabase();
    return order;
  },

  resetForTests(): void {
    database = emptyDatabase();
  }
};
