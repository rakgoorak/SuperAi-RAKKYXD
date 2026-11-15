/** Coalesce provider bursts without delaying permissions, snapshots or end-of-turn state. */
export function createItemBatch<T extends { id: string }>(
  deliver: (items: T[]) => void,
  schedule: (callback: () => void) => number,
  cancel: (handle: number) => void,
) {
  const pending = new Map<string, T>();
  let handle: number | undefined;
  const reset = () => {
    if (handle !== undefined) cancel(handle);
    handle = undefined;
    pending.clear();
  };
  const flush = () => {
    if (handle !== undefined) cancel(handle);
    handle = undefined;
    if (!pending.size) return;
    const items = [...pending.values()];
    pending.clear();
    deliver(items);
  };
  return {
    push(item: T) {
      pending.set(item.id, item);
      if (handle === undefined) handle = schedule(() => { handle = undefined; flush(); });
    },
    flush,
    reset,
  };
}
