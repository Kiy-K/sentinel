export type UiEvent = {
  ts: string;
  deliveryId?: string;
  kind: string;
  message: string;
};

const CAP = 300;

const buffer: UiEvent[] = [];
const subscribers = new Set<(e: UiEvent) => void>();

export function publishEvent(e: Omit<UiEvent, "ts">): void {
  const event: UiEvent = { ts: new Date().toISOString(), ...e };
  buffer.push(event);
  if (buffer.length > CAP) buffer.splice(0, buffer.length - CAP);
  for (const fn of subscribers) {
    try {
      fn(event);
    } catch {
      // a broken subscriber must not take down publishers or other subscribers
    }
  }
}

export function recentEvents(deliveryId?: string, limit = 100): UiEvent[] {
  const filtered = deliveryId ? buffer.filter((e) => e.deliveryId === deliveryId) : buffer;
  return filtered.slice(-limit);
}

export function subscribe(fn: (e: UiEvent) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
