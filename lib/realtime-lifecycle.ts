import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

const closing = new Map<string, Promise<unknown>>();
// A same-topic channel must finish leaving before Supabase can reuse it.
export function subscribePrivate(db: SupabaseClient, topic: string, setup: (channel: RealtimeChannel) => RealtimeChannel) {
  let disposed = false;
  let channel: RealtimeChannel | undefined;
  const join = () => {
    if (!disposed) channel = setup(db.channel(topic, { config: { private: true } }));
  };
  const previous = closing.get(topic);
  if (previous) void previous.then(join, join);
  else join();
  return () => {
    disposed = true;
    if (!channel) return;
    const task = db.removeChannel(channel);
    closing.set(topic, task);
    const forget = () => { if (closing.get(topic) === task) closing.delete(topic); };
    void task.then(forget, forget);
  };
}
