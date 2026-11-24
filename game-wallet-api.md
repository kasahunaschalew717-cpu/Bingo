# Game wallet API

For developers of a web game that Ardi Game Zone lists under **Extra Games**. Players open your game inside the Ardi app (a Telegram Mini App). Your game's **server** takes bets and pays wins from the player's ETB wallet through this API.

## 1. How players reach your game

The desk enters your game's address. When a player taps **Play**, the app opens a link built from it:

| In the link | What it is |
| --- | --- |
| `token` | The player's session token, `ags_…`. It's added as `?token=`, unless the desk's URL pattern places `{token}` somewhere else. |
| `chat_id` | The player's Telegram id. It's only there when the desk turned it on: as `?chat_id=`, at the end of the path, or wherever the URL pattern places `{chatId}`. |

- Your page reads the token and hands it to your server. Your server sends it with every API call.
- **Never move money on a chat id alone.** Anyone can type a chat id into a link. Only the token, checked by this API, says who the player is.
- A token takes bets for 12 hours after the player opened the game. Wins and refunds still work on it for 30 days, so a round already played can always be paid.
- The page runs in a sandboxed frame. It can't navigate the app itself, but it can open links in a new window.

## 2. Calling the API

```
POST {API}/api/games/v1/{action}
Authorization: Bearer agk_…
Content-Type: application/json
```

- `{API}` is the backend address shown on the desk's **Extra Games** page.
- `agk_…` is your game's key. The desk sees it only once, when the game is added or the key is replaced. Keep it on your server: never in a page, an app or a repository. A replaced key stops working at once.
- **Amounts are whole santim:** 100 = 1 ETB.
- **`ref`** is your own id for one move: 1–64 characters from `A–Z a–z 0–9 _ . : -`, unique within your game.
  - Sending the same request again returns the first answer with `"replayed": true` and moves nothing. After a timeout or a 5xx answer, send it again with the same `ref`.
  - Using a `ref` again for a different move is refused with `REF_CONFLICT`.
- **`roundId`** is your id for a round. A win must be for a round in which this player has a bet that wasn't refunded.
- At most 1,200 requests a minute per key; a JSON body of 4 KB at most.

### Actions

| Action | Body | Answer |
| --- | --- | --- |
| `whoami` | `{}` | `{ ok, game: { slug, title, txName, enabled } }` |
| `session` | `{ token }` | `{ ok, player: { ref, chatId, name }, balance, currency: "ETB" }` |
| `balance` | `{ token }` | `{ ok, balance }` |
| `debit` (a bet) | `{ token, amount, ref, roundId }` | `{ ok, balance, moveId, replayed }` |
| `credit` (a win) | `{ token, amount, ref, roundId }` | `{ ok, balance, moveId, replayed }` |
| `refund` (gives one bet back, in full) | `{ token, ref, debitRef }` | `{ ok, balance, moveId, replayed }` |

- In the `session` answer:
  - `player.ref` is the player's id for your game only. It's the same every time and is no use anywhere else.
  - `player.name` is shortened for privacy (`Kas*****`). Show it to other players as it is.
  - `chatId` is the player's Telegram id, or `null` for a player who isn't on Telegram.
- `balance` is always in santim, as it stands after the move.

### Refusals

A refusal is `{ ok: false, code, message }` with this HTTP status:

| Code | Status | When |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | No key, a wrong key, or a replaced key |
| `BAD_REQUEST` | 400 | The body isn't what the action takes |
| `NOT_FOUND` | 404 | Unknown action |
| `RATE_LIMITED` | 429 | Too many requests |
| `SESSION_UNKNOWN` | 404 | The token isn't from your game's link |
| `SESSION_EXPIRED` | 403 | A bet more than 12 hours after the player opened the game. They open it from the app again. |
| `GAME_OFF` | 403 | A bet while the desk has the game switched off |
| `PARLOR_PAUSED` | 403 | A bet while the whole parlor is paused |
| `PLAYER_CLOSED` | 403 | A bet from a closed account |
| `BET_LIMIT` | 422 | A bet below or above your game's bet limits |
| `INSUFFICIENT_FUNDS` | 422 | The balance doesn't cover the bet (the answer includes `balance`) |
| `NO_BET_IN_ROUND` | 409 | A win for a round the player has no bet in |
| `BET_UNKNOWN` | 404 | A refund for a bet this player didn't make |
| `ALREADY_REFUNDED` | 409 | That bet was refunded before |
| `REF_CONFLICT` | 409 | The `ref` was already used for a different move |
| `PAYOUT_LIMIT` | 422 | The win would pass your game's daily payout limit (see below) |
| `SERVER_ERROR` | 500 | Our problem: send the same request again |

## 3. Limits the desk sets

- **Bet limits:** each bet's smallest and largest amount.
- **Daily payout limit:** how much more your game may pay out than it took in one Ethiopian day (wins + refunds − bets).
  - A win that would pass the limit isn't paid. The game then switches itself off, and the desk is alerted.
  - The desk checks the game and switches it on again.
- **Switched off, or the parlor paused:** no new bets. Wins and refunds for rounds already played still go through.

## 4. Talking to the app (optional)

From your page inside the frame:

```js
// After a bet or a win, so the app shows the new balance right away:
window.parent.postMessage({ type: "ardi:balance" }, "*");
// To close the game and go back to the app:
window.parent.postMessage({ type: "ardi:close" }, "*");
```

The app only takes these from your game's own site.

## 5. Example

```sh
API=https://your-backend.example
KEY=agk_...        # from the desk, kept on your server
TOKEN=ags_...      # from the player's link

curl -s -X POST "$API/api/games/v1/session" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\"}"

# A 10 ETB bet in round 7781
curl -s -X POST "$API/api/games/v1/debit" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"amount\":1000,\"ref\":\"bet-7781-1\",\"roundId\":\"7781\"}"

# The round's win: 35 ETB
curl -s -X POST "$API/api/games/v1/credit" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"amount\":3500,\"ref\":\"win-7781-1\",\"roundId\":\"7781\"}"

# Or, if the round was called off, the bet back
curl -s -X POST "$API/api/games/v1/refund" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"ref\":\"refund-7781-1\",\"debitRef\":\"bet-7781-1\"}"
```
