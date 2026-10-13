export function createState() {
  let revision = 0, latestRequestId = 0, copyId = 0, result = null;
  return {
    invalidate() { revision++; latestRequestId++; copyId++; result = null; },
    begin() { result = null; copyId++; return { revision, requestId: ++latestRequestId }; },
    current(ticket) { return ticket.revision === revision && ticket.requestId === latestRequestId; },
    commit(ticket, next) {
      if (!this.current(ticket)) return false;
      result = next.ok ? next.value : null;
      return true;
    },
    beginCopy() { return result === null ? null : { revision, requestId: latestRequestId, copyId: ++copyId }; },
    currentCopy(ticket) { return ticket !== null && this.current(ticket) && ticket.copyId === copyId && result !== null; },
    getResult() { return result; }
  };
}

export async function copyReport({ state, text, write, onSuccess, onFallback }) {
  const ticket = state.beginCopy();
  if (ticket === null) return;
  try {
    if (typeof write !== 'function') throw new Error('Clipboard unavailable');
    await write(text);
    if (state.currentCopy(ticket)) onSuccess();
  } catch {
    if (state.currentCopy(ticket)) onFallback(text);
  }
}
