// Game server client for Ardi Game Wallet API
import { mockWallet } from './mockWalletApi.js';

export class WalletClient {
  constructor() {
    this.apiUrl = process.env.ARDI_API_URL || null;
    this.gameKey = process.env.ARDI_GAME_KEY || "agk_sample_secret_key_123456789";
    this.useMock = !this.apiUrl || process.env.USE_MOCK_WALLET === 'true';
  }

  async _request(action, body) {
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
          return { status: 404, body: { ok: false, code: "NOT_FOUND", message: `Unknown action ${action}` } };
      }
    }

    // Live HTTP call to Ardi Desk API
    const response = await fetch(`${this.apiUrl}/api/games/v1/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.gameKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });
    const resBody = await response.json();
    return { status: response.status, body: resBody };
  }

  async getSession(token) {
    const res = await this._request('session', { token });
    if (!res.body.ok) {
      throw new Error(res.body.message || `Session failed with code ${res.body.code}`);
    }
    return res.body;
  }

  async getBalance(token) {
    const res = await this._request('balance', { token });
    if (!res.body.ok) {
      throw new Error(res.body.message || `Balance check failed with code ${res.body.code}`);
    }
    return res.body.balance;
  }

  async debitBet({ token, amount, ref, roundId }) {
    // amount in whole santim: 100 santim = 1 ETB
    const res = await this._request('debit', { token, amount, ref, roundId });
    if (!res.body.ok) {
      const err = new Error(res.body.message || `Debit failed with ${res.body.code}`);
      err.code = res.body.code;
      err.details = res.body;
      throw err;
    }
    return res.body;
  }

  async creditWin({ token, amount, ref, roundId }) {
    // amount in whole santim: 100 santim = 1 ETB
    const res = await this._request('credit', { token, amount, ref, roundId });
    if (!res.body.ok) {
      const err = new Error(res.body.message || `Credit failed with ${res.body.code}`);
      err.code = res.body.code;
      err.details = res.body;
      throw err;
    }
    return res.body;
  }

  async refundBet({ token, ref, debitRef }) {
    const res = await this._request('refund', { token, ref, debitRef });
    if (!res.body.ok) {
      const err = new Error(res.body.message || `Refund failed with ${res.body.code}`);
      err.code = res.body.code;
      err.details = res.body;
      throw err;
    }
    return res.body;
  }
}

export const walletClient = new WalletClient();
