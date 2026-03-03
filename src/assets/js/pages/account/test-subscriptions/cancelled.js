// Cancelled subscription — merges into real subscription
// Backend maps Stripe 'canceled' → unified 'cancelled'
const DAY = 86400;
const now = Math.floor(Date.now() / 1000);

export default {
  status: 'cancelled',
  expires: {
    timestamp: new Date((now - 5 * DAY) * 1000).toISOString(),
    timestampUNIX: now - 5 * DAY,
  },
  cancellation: {
    pending: false,
    date: {
      timestamp: new Date((now - 5 * DAY) * 1000).toISOString(),
      timestampUNIX: now - 5 * DAY,
    },
  },
};
