Core Subscription Statuses

pending
- Initial state after checkout
- Access = false
- Waiting for first payment confirmation
- Becomes active or expired
- Requires additional user action (3D Secure, bank approval)

active
- Subscription is paid and current
- Access = true
- Payment method is valid
- Next billing date is in the future

trialing
- User is in free trial period
- Access = true
- No charges yet
- Will convert to active or cancelled when trial ends

paused
- Temporarily halted by user/admin
- Access = ?
- No charges during pause
- Can be resumed
- Access may be retained or revoked (configurable)
- ??? How do we determine access?

suspended
- One or more payments failed
- Access = false
- Access revoked
- Can be reactivated if payment succeeds
- Not permanently cancelled

cancelled
- User intentionally cancelled
- Access = true
- Will have access until period end
- No future charges
- Transitions to expired at period end

expired
- Subscription period ended after cancellation
- Access = false
- Cannot be reactivated (must create new subscription)
- Terminal state


Stripe → Unified

  {
    'trialing': 'trialing',
    'active': 'active',
    'incomplete': 'incomplete',
    'incomplete_expired': 'expired',
    'past_due': 'past_due',
    'canceled': 'cancelled',
    'unpaid': 'suspended',
    'paused': 'paused'
  }

  PayPal → Unified

  {
    'APPROVAL_PENDING': 'pending',
    'APPROVED': 'pending',
    'ACTIVE': 'active',
    'SUSPENDED': 'suspended',
    'CANCELLED': 'cancelled',
    'EXPIRED': 'expired'
  }

  Chargebee → Unified

  {
    'future': 'pending',
    'in_trial': 'trialing',
    'active': 'active',
    'non_renewing': 'cancelled',
    'paused': 'paused',
    'cancelled': 'expired',
    'transferred': 'expired'
  }

  Status Transition Rules

  const validTransitions = {
    'pending': ['active', 'trialing', 'incomplete', 'expired'],
    'trialing': ['active', 'cancelled', 'suspended'],
    'active': ['cancelled', 'suspended', 'paused'],
    'suspended': ['active', 'cancelled', 'expired'],
    'cancelled': ['expired'], // Can only expire after cancellation
    'paused': ['active', 'cancelled', 'expired'],
    'incomplete': ['active', 'expired'],
    'expired': [] // Terminal state
  };


  function computeAccess(subscription) {
    switch (subscription.status) {
      case 'active':
      case 'trialing':
        return true;

      case 'cancelled':
        // Has access until current period ends
        return subscription.billing.currentPeriodEnd > Date.now();

      case 'paused':
        // Use stored decision from when pause was created
        return subscription.pause?.accessRetained ?? false;

      case 'pending':
      case 'suspended':
      case 'expired':
        return false;

      default:
        return false;
    }
  }
