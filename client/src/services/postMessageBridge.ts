// Integration bridge with Ardi Game Zone parent container
// Implements the communication protocol defined in game-wallet-api.md Section 4

export function notifyParentBalanceChange() {
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'ardi:balance' }, '*');
      console.log('[Ardi Bridge] Sent ardi:balance to parent frame');
    } catch (e) {
      console.warn('[Ardi Bridge] Could not postMessage ardi:balance', e);
    }
  }
}

export function requestCloseGame() {
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'ardi:close' }, '*');
      console.log('[Ardi Bridge] Sent ardi:close to parent frame');
    } catch (e) {
      console.warn('[Ardi Bridge] Could not postMessage ardi:close', e);
    }
  } else {
    // If running standalone, prompt or history back
    if (window.history.length > 1) {
      window.history.back();
    } else {
      console.log('[Ardi Bridge] Standalone mode: Close requested');
    }
  }
}
