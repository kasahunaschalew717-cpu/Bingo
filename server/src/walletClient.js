// Production Game Server Client for Ardi Game Wallet API (game-wallet-api.md)
import { config } from './config.js';
import { mockWallet } from './mockWalletApi.js';

const REF_REGEX = /^[A-Za-z0-9_.:-]{1,64}$/;
const RETRY_DELAYS_MS = [350, 1000, 2200];

export class WalletApiError extends Error {
  constructor(message, { code = 'UNKNOWN_ERROR', status = 500, balance = undefined, details = null } = {}) {
    super(message);
    this.name = 'WalletApiError';
    this.code = code;
    this.status = status;
    this.balance = balance;
    this.details = details;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WalletClient {
  constructor() {
    this.apiUrl = config.apiUrl;
    this.gameKey = config.gameKey;
    this.useMock = config.useMockWallet;
  }

  _validateRef(ref) {
    if (!ref || !REF_REGEX.test(ref)) {
      throw new WalletApiError(`Invalid ref format: "${ref}"`, { code: 'BAD_REQUEST', status: 400 });
    }
  }

  _validateSantim(amount) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new WalletApiError(`Amount must be a positive integer in santim, got: ${amount}`, {
        code: 'BAD_REQUEST',
        status: 400
      });
    }
  }

  async _singleRequest(action, body) {
    if (this.useMock) {
      const authHeader = `Bearer ${this.gameKey}`;
      switch (action) {
        case 'whoami':
          return mockWallet.handleWhoami(authHeader);
        case 'session':
          return mockWallet.handleSession(authHeader, body);
        case 'balance':
          return mockWallet.handleBalance(authHeader, body);
        case 'debit':
          return mockWallet.handleDebit(authHeader, body);
        case 'credit':
          return mockWallet.handleCredit(authHeader, body);
        case 'refund':
          return mockWallet.handleRefund(authHeader, body);
        default:
          return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: `Unknown action ${action}` } };
      }
    }

    const payload = JSON.stringify(body || {});
    if (Buffer.byteLength(payload, 'utf8') > 4096) {
      throw new WalletApiError('Request body exceeds 4 KB API limit', { code: 'BAD_REQUEST', status: 400 });
    }

    const response = await fetch(`${this.apiUrl}/api/games/v1/${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.gameKey}`,
        'Content-Type': 'application/json'
      },
      body: payload,
      signal: AbortSignal.timeout(8000)
    });

    let resBody;
    try {
      resBody = await response.json();
    } catch {
      resBody = { ok: false, code: 'SERVER_ERROR', message: `Non-JSON response (HTTP ${response.status})` };
    }
    return { status: response.status, body: resBody };
  }

  async _request(action, body, { idempotent = false } = {}) {
    const maxAttempts = idempotent ? RETRY_DELAYS_MS.length + 1 : 2;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await this._singleRequest(action, body);
        if (res.body && res.body.ok) {
          return res.body;
        }

        const code = res.body?.code || 'SERVER_ERROR';
        const message = res.body?.message || `Wallet API refused ${action} (${code})`;
        const err = new WalletApiError(message, {
          code,
          status: res.status,
          balance: res.body?.balance,
          details: res.body
        });

        // Retry only on 5xx / SERVER_ERROR or 429 RATE_LIMITED
        const retryable = res.status >= 500 || code === 'SERVER_ERROR' || res.status === 429;
        if (!retryable || attempt === maxAttempts - 1) {
          throw err;
        }
        lastError = err;
      } catch (err) {
        if (err instanceof WalletApiError && err.status < 500 && err.status !== 429) {
          throw err;
        }
        lastError = err;
        if (attempt === maxAttempts - 1) {
          if (err instanceof WalletApiError) throw err;
          throw new WalletApiError(err.message || 'Network error calling Ardi Wallet API', {
            code: 'SERVER_ERROR',
            status: 500
          });
        }
      }

      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      await sleep(delay);
    }

    throw lastError;
  }

  async whoami() {
    return this._request('whoami', {});
  }

  async getSession(token) {
    if (!token || typeof token !== 'string') {
      throw new WalletApiError('Missing player session token', { code: 'BAD_REQUEST', status: 400 });
    }
    return this._request('session', { token });
  }

  async getBalance(token) {
    const res = await this._request('balance', { token });
    return res.balance;
  }

  async debitBet({ token, amount, ref, roundId }) {
    this._validateSantim(amount);
    this._validateRef(ref);
    return this._request('debit', { token, amount, ref, roundId }, { idempotent: true });
  }

  async creditWin({ token, amount, ref, roundId }) {
    this._validateSantim(amount);
    this._validateRef(ref);
    return this._request('credit', { token, amount, ref, roundId }, { idempotent: true });
  }

  async refundBet({ token, ref, debitRef }) {
    this._validateRef(ref);
    this._validateRef(debitRef);
    return this._request('refund', { token, ref, debitRef }, { idempotent: true });
  }
}

export const walletClient = new WalletClient();
