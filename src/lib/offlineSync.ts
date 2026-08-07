import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineAction {
  id: string;
  type: 'complete_stop' | 'update_refill' | 'cash_collection' | 'create_ticket';
  data: any;
  timestamp: number;
  synced: boolean;
}

interface OfflineDB extends DBSchema {
  actions: {
    key: string;
    value: OfflineAction;
  };
}

let db: IDBPDatabase<OfflineDB> | null = null;

export async function initOfflineDB() {
  if (db) return db;
  
  db = await openDB<OfflineDB>('driver-offline', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('actions')) {
        const store = db.createObjectStore('actions', { keyPath: 'id' });
        (store as any).createIndex('by-synced', 'synced');
      }
    },
  });
  
  return db;
}

export async function queueOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'synced'>) {
  const database = await initOfflineDB();
  const offlineAction: OfflineAction = {
    ...action,
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    synced: false,
  };
  
  await database.add('actions', offlineAction);
  return offlineAction;
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const database = await initOfflineDB();
  const tx = database.transaction('actions');
  const store = tx.objectStore('actions');
  const index = (store as any).index('by-synced');
  return await index.getAll(IDBKeyRange.only(false));
}

export async function markActionSynced(actionId: string) {
  const database = await initOfflineDB();
  const action = await database.get('actions', actionId);
  if (action) {
    action.synced = true;
    await database.put('actions', action);
  }
}

export async function clearSyncedActions() {
  const database = await initOfflineDB();
  const tx = database.transaction('actions', 'readwrite');
  const store = tx.objectStore('actions');
  const index = (store as any).index('by-synced');
  const synced = await index.getAll(IDBKeyRange.only(true));
  
  await Promise.all([
    ...synced.map((action: OfflineAction) => store.delete(action.id)),
    tx.done,
  ]);
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void) {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
