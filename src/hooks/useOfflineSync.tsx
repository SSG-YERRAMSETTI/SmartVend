import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  initOfflineDB, 
  queueOfflineAction, 
  getPendingActions, 
  markActionSynced,
  clearSyncedActions,
  isOnline,
  onOnlineStatusChange 
} from '@/lib/offlineSync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useOfflineSync() {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    initOfflineDB();
    updatePendingCount();
    
    const cleanup = onOnlineStatusChange((isOnline) => {
      setOnline(isOnline);
      if (isOnline) {
        syncPendingActions();
      }
    });
    
    return cleanup;
  }, []);

  async function updatePendingCount() {
    const pending = await getPendingActions();
    setPendingCount(pending.length);
  }

  async function queueAction(type: string, data: any) {
    await queueOfflineAction({ type: type as any, data });
    await updatePendingCount();
    
    if (!online) {
      toast.info('Action queued for sync when online');
    }
  }

  async function syncPendingActions() {
    if (syncing || !online) return;
    
    setSyncing(true);
    const pending = await getPendingActions();
    
    if (pending.length === 0) {
      setSyncing(false);
      return;
    }

    toast.info(`Syncing ${pending.length} pending action(s)...`);
    
    let successCount = 0;
    
    for (const action of pending) {
      try {
        switch (action.type) {
          case 'complete_stop':
            await supabase
              .from('route_stops')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', action.data.stopId);
            break;
            
          case 'update_refill':
            await supabase
              .from('refill_orders')
              .update({ 
                picked_qty: action.data.pickedQty,
                fulfilled: action.data.fulfilled 
              })
              .eq('id', action.data.orderId);
            break;
            
          case 'cash_collection':
            await supabase
              .from('cash_collections')
              .insert(action.data);
            break;
            
          case 'create_ticket':
            // Would create ticket via API
            console.log('Syncing ticket:', action.data);
            break;
        }
        
        await markActionSynced(action.id);
        successCount++;
      } catch (error) {
        console.error('Failed to sync action:', action, error);
      }
    }
    
    if (successCount > 0) {
      toast.success(`Synced ${successCount} action(s)`);
      await clearSyncedActions();
      queryClient.invalidateQueries();
    }
    
    await updatePendingCount();
    setSyncing(false);
  }

  return {
    online,
    syncing,
    pendingCount,
    queueAction,
    syncPendingActions,
  };
}
