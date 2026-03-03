// Trialing subscription — merges into real subscription
// Backend maps Stripe 'trialing' → unified 'active' with trial.claimed = true
const DAY = 86400;
const now = Math.floor(Date.now() / 1000);

export default {
  status: 'active',
  expires: {
    timestamp: new Date((now + 7 * DAY) * 1000).toISOString(),
    timestampUNIX: now + 7 * DAY,
  },
  trial: {
    claimed: true,
    expires: {
      timestamp: new Date((now + 7 * DAY) * 1000).toISOString(),
      timestampUNIX: now + 7 * DAY,
    },
  },
  cancellation: {
    pending: false,
    date: { timestamp: '1970-01-01T00:00:00.000Z', timestampUNIX: 0 },
  },
};
