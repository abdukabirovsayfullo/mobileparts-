import { protectDebtOwnership } from '../src/utils/debtOwnership';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import { authReplica, requireOwner } from './auth';
import { dataStore, type PosDatabaseState } from './dataStore';
import { repairReplica } from './repairStore';
import { mergeDeviceState, type DeviceSnapshot as Snapshot, type MergeConflict } from './deviceMerge';

const directory = path.resolve('data');
const tokenFile = path.join(directory, 'device-token');
const baselineFile = path.join(directory, 'device-baseline');
const baselineState = path.join(directory, 'device-baseline.json');
const pendingFile = path.join(directory, 'device-pending.json');
const commitFile = path.join(directory, 'device-commit.json');
const journal = path.join(directory, 'device-install.json');
const remote = 'https://77-81-138-243.sslip.io/api/device-sync';

type PendingMerge = {
  id: string;
  base: string;
  source: Snapshot;
  target: Snapshot;
  conflicts: MergeConflict[];
};

const digest = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshot = (): Snapshot => ({ pos: dataStore.getState(), auth: authReplica.read(), repairs: repairReplica.read() });

function read(file: string) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
}

function write(file: string, contents: string) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, contents, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function valid(value: Snapshot | undefined): value is Snapshot {
  return Boolean(value && typeof value.pos?.lastUpdated === 'string' && typeof value.pos.apiKey === 'string' &&
    ['products', 'categories', 'movements', 'debts', 'supplierDebts', 'customers', 'onlineOrders', 'expenses', 'cashShifts']
      .every(key => Array.isArray(value.pos[key as keyof PosDatabaseState])) &&
    value.pos.storeInfo && Array.isArray(value.auth?.users) &&
    value.auth.users.some(user => user.role === 'owner' && user.active) &&
    Array.isArray(value.repairs?.orders) && Number.isSafeInteger(value.repairs.nextOrderNumber));
}

function readJSON<T>(file: string): T | undefined {
  const contents = read(file);
  return contents ? JSON.parse(contents) as T : undefined;
}

function apply(next: Snapshot) {
  const previous = snapshot();
  if (digest(next.auth) !== digest(previous.auth)) authReplica.write(next.auth);
  if (digest(next.repairs) !== digest(previous.repairs)) repairReplica.write(next.repairs);
  if (digest(next.pos) !== digest(previous.pos)) dataStore.replaceReplicaState(next.pos);
}

function install(next: Snapshot) {
  const protectedDebts = protectDebtOwnership(next.pos.debts, dataStore.getState().debts, next.pos.movements);
  if (protectedDebts.some((d, i) => ['customerName', 'customerPhone', 'movementId', 'currency'].some(k => (d as any)[k] !== (next.pos.debts[i] as any)[k]))) {
    throw new Error('Nasiya egasi o‘zgargan nusxa qabul qilinmadi. Qurilmani yangilang.');
  }
  write(path.join(directory, 'before-device-sync.json'), JSON.stringify(snapshot()));
  write(journal, JSON.stringify(next));
  apply(next);
  fs.rmSync(journal);
}

function remember(state: Snapshot) {
  write(baselineState, JSON.stringify(state));
  write(baselineFile, digest(state));
}

function archive(id: string, details: unknown) {
  const folder = path.join(directory, 'device-conflicts');
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  write(path.join(folder, id + '.json'), JSON.stringify(details));
}

function finishLocalCommit() {
  const commit = readJSON<{ remote: Snapshot; local: Snapshot }>(commitFile);
  if (!commit) return;
  if (digest(snapshot()) !== digest(commit.local)) install(commit.local);
  remember(commit.remote);
  fs.rmSync(pendingFile, { force: true });
  fs.rmSync(commitFile);
}

export function installDeviceSync(app: Express, local: boolean) {
  const incomplete = readJSON<Snapshot>(journal);
  if (incomplete) {
    apply(incomplete);
    fs.rmSync(journal);
  }
  if (local) finishLocalCommit();
  if (!local) {
    app.post('/api/device-sync/pair', requireOwner, (_req, res) => {
      const token = crypto.randomBytes(32).toString('hex');
      // A new pairing revokes the previous device.
      write(tokenFile, digest(token));
      res.set('Cache-Control', 'no-store').json({ token });
    });
    app.use('/api/device-sync/state', (req, res, next) => {
      const token = req.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      const expected = read(tokenFile);
      if (!token || !/^[a-f0-9]{64}$/.test(expected) ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(digest(token)))) {
        return res.sendStatus(401);
      }
      res.set('Cache-Control', 'no-store');
      next();
    });
    app.get('/api/device-sync/state', (_req, res) => {
      const state = snapshot();
      res.json({ revision: digest(state), state });
    });
    app.put('/api/device-sync/state', (req, res) => {
      const { base, state, conflicts } = req.body || {};
      const current = snapshot();
      if (base !== digest(current)) return res.sendStatus(409);
      if (!valid(state)) return res.sendStatus(400);
      const mergeId = state.pos.deviceLastMerge;
      if (Array.isArray(conflicts) && conflicts.length &&
          typeof mergeId === 'string' && /^[a-f0-9-]{36}$/.test(mergeId)) {
        archive(mergeId, { before: current, conflicts });
      }
      install(state);
      res.json({ revision: digest(snapshot()) });
    });
    return;
  }

  let status = 'waiting';
  let lastSync: string | null = null;
  let review = fs.existsSync(path.join(directory, 'device-conflicts'));
  app.get('/api/device-sync/status', (_req, res) => res.json({ status, lastSync, review }));
  const token = read(tokenFile);
  if (!token) return;
  let running = false;
  const sync = async () => {
    if (running) return;
    running = true;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(remote + '/state', { headers, signal: AbortSignal.timeout(6000) });
      if (response.status === 401) { status = 'unpaired'; return; }
      if (!response.ok) throw new Error('VPS unavailable');
      const { revision, state } = await response.json() as { revision: string; state: Snapshot };
      if (!valid(state) || revision !== digest(state)) throw new Error('Invalid snapshot');
      finishLocalCommit();
      const current = snapshot();
      const localRevision = digest(current);
      const baseRevision = read(baselineFile);
      let pending = readJSON<PendingMerge>(pendingFile);

      if (pending && state.pos.deviceLastMerge !== pending.id && revision !== pending.base) {
        // A different edit reached the server first. Rebuild on its new revision.
        fs.rmSync(pendingFile);
        pending = undefined;
      }

      if (!pending && localRevision === revision) {
        if (!read(baselineState) || baseRevision !== revision) remember(state);
      } else if (!pending && localRevision === baseRevision) {
        write(commitFile, JSON.stringify({ remote: state, local: state }));
        finishLocalCommit();
      } else {
        if (!pending) {
          const saved = readJSON<Snapshot>(baselineState);
          const backup = saved ?? readJSON<Snapshot>(path.join(directory, 'before-device-sync.json'));
          const base = backup && digest(backup) === baseRevision ? backup : undefined;
          const merged = revision === baseRevision
            ? { state: structuredClone(current), conflicts: [] }
            : mergeDeviceState(base, current, state);
          if (!base && revision !== baseRevision) {
            merged.conflicts.push({ path: 'baseline unavailable for older installation' });
          }
          const id = crypto.randomUUID();
          merged.state.pos.deviceLastMerge = id;
          merged.state.pos.lastUpdated = new Date().toISOString();
          pending = { id, base: revision, source: current, target: merged.state, conflicts: merged.conflicts };
          if (pending.conflicts.length) {
            archive(id, { local: current, vps: state, conflicts: pending.conflicts });
          }
          write(pendingFile, JSON.stringify(pending));
        }

        if (state.pos.deviceLastMerge !== pending.id) {
          const result = await fetch(remote + '/state', {
            method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ base: pending.base, state: pending.target, conflicts: pending.conflicts }),
            signal: AbortSignal.timeout(6000)
          });
          if (result.status === 409) { status = 'waiting'; return; }
          if (result.status === 401) { status = 'unpaired'; return; }
          if (!result.ok) throw new Error('Upload failed');
          const saved = await result.json() as { revision: string };
          if (saved.revision !== digest(pending.target)) throw new Error('Unexpected revision');
        }

        // Keep edits made during the upload. The next pass uploads that delta.
        const latest = snapshot();
        const rebased = digest(latest) === digest(pending.source)
          ? { state: pending.target, conflicts: [] }
          : mergeDeviceState(pending.source, latest, pending.target);
        if (rebased.conflicts.length) {
          archive(pending.id + '-during-upload', { local: latest, vps: pending.target, conflicts: rebased.conflicts });
        }
        review = pending.conflicts.length > 0 || rebased.conflicts.length > 0 || review;
        write(commitFile, JSON.stringify({ remote: pending.target, local: rebased.state }));
        finishLocalCommit();
      }
      status = 'synced';
      lastSync = new Date().toISOString();
    } catch {
      status = 'offline';
    } finally {
      running = false;
    }
  };
  void sync();
  setInterval(sync, 15_000);
}
