// Cancellation requested — merges into real subscription
// Active subscription with cancellation.pending = true (will cancel at period end)
const DAY = 86400;
const now = Math.floor(Date.now() / 1000);

export default {
  status: 'active',
  expires: {
    timestamp: new Date((now + 45 * DAY) * 1000).toISOString(),
    timestampUNIX: now + 45 * DAY,
  },
  trial: {
    claimed: true,
    expires: {
      timestamp: new Date((now - 335 * DAY) * 1000).toISOString(),
      timestampUNIX: now - 335 * DAY,
    },
  },
  cancellation: {
    pending: true,
    date: {
      timestamp: new Date((now + 45 * DAY) * 1000).toISOString(),
      timestampUNIX: now + 45 * DAY,
    },
  },
};
