// Pure pricing calculation -- no side effects, no state mutation

export function calculatePrices({ product, frequency, discountPercent, trialEligible }) {
  if (!product) {
    return { subtotal: 0, discountAmount: 0, trialDiscountAmount: 0, total: 0, recurring: 0 };
  }

  const isSubscription = product.type === 'subscription';
  const hasFreeTrial = isSubscription && trialEligible && (product.trial?.days > 0);

  // Base price directly from API product
  let basePrice;
  if (isSubscription) {
    basePrice = frequency === 'monthly'
      ? (product.prices?.monthly?.amount || 0)
      : (product.prices?.annually?.amount || 0);
  } else {
    // One-time: use amount if available, else fall back to monthly
    basePrice = product.prices?.amount
      || product.prices?.monthly?.amount
      || 0;
  }

  const subtotal = basePrice;
  const discountAmount = (subtotal * discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;

  let trialDiscountAmount = 0;
  let total;

  if (hasFreeTrial) {
    // Free trial = $0 due today, but recurring stays
    trialDiscountAmount = afterDiscount;
    total = 0;
  } else {
    total = afterDiscount;
  }

  return {
    subtotal,
    discountAmount,
    trialDiscountAmount,
    total,
    recurring: afterDiscount,
  };
}
