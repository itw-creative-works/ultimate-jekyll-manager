// Pricing calculations for checkout
import { raw } from './state.js';

// Calculate prices and return values for bindings
// Takes raw data and returns formatted values
export function calculatePrices(rawData = raw) {
  // Return default values if product not loaded
  if (!rawData.product) {
    return {
      subtotal: 0,
      discountAmount: 0,
      trialDiscountAmount: 0,
      total: 0,
      recurring: 0,
      displayPrice: '$--'
    };
  }

  let basePrice;
  const isSubscription = rawData.product.is_subscription || false;
  const hasFreeTrial = rawData.product.has_free_trial || false;

  if (isSubscription) {
    basePrice = rawData.billingCycle === 'monthly'
      ? (rawData.product.price_monthly || 0)
      : (rawData.product.price_annually || 0);
  } else {
    basePrice = rawData.product.price || 0;
  }

  // Calculate subtotal
  const subtotal = basePrice;

  // Calculate discount amount
  const discountAmount = (subtotal * rawData.discountPercent) / 100;

  // Calculate total after discount
  const discountedTotal = subtotal - discountAmount;

  // Calculate trial discount amount and final total
  let total;
  let trialDiscountAmount = 0;

  if (hasFreeTrial && isSubscription) {
    // Free trial means $0 due today
    trialDiscountAmount = discountedTotal;
    total = 0;
  } else {
    total = discountedTotal;
  }

  // Calculate recurring amount (after discount but before trial)
  const recurring = discountedTotal;

  // Format display price for product
  let displayPrice;
  if (isSubscription) {
    const period = rawData.billingCycle === 'monthly' ? '/mo' : '/yr';
    displayPrice = `$${discountedTotal.toFixed(2)}${period}`;
  } else {
    displayPrice = `$${discountedTotal.toFixed(2)}`;
  }

  return {
    subtotal,
    discountAmount,
    trialDiscountAmount,
    total,
    recurring,
    displayPrice
  };
}