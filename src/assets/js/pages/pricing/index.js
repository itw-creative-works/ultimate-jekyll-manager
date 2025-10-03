// Libraries
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    setupBillingToggle();
    setupPlanButtons();

    // Setup promo countdown
    setTimeout(() => {
      setupPromoCountdown();
    }, 1000);

    // Resolve after initialization
    return resolve();
  });
};

// Configuration
const config = {
  selectors: {
    billingRadios: 'input[name="billing"]',
    amountElements: '.amount',
    billingInfoElements: '.billing-info',
    pricePerUnitElements: '.price-per-unit',
    planButtons: '.btn-primary',
    cardTitle: '.card-title'
  }
};

// Setup billing toggle functionality
function setupBillingToggle() {
  const $billingRadios = document.querySelectorAll(config.selectors.billingRadios);
  const $amountElements = document.querySelectorAll(config.selectors.amountElements);
  const $billingInfoElements = document.querySelectorAll(config.selectors.billingInfoElements);
  const $pricePerUnitElements = document.querySelectorAll(config.selectors.pricePerUnitElements);

  // Debug log to check if elements are found
  console.log('Amount elements found:', $amountElements.length);
  console.log('Billing info elements found:', $billingInfoElements.length);
  console.log('Price per unit elements found:', $pricePerUnitElements.length);

  $billingRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      const billingType = this.dataset.billing;
      console.log('Billing type changed to:', billingType);

      // Update button styling for toggle buttons
      updateToggleButtons(this);

      trackPricingToggle(billingType);
      updatePricing(billingType, $amountElements, $billingInfoElements, $pricePerUnitElements);
    });
  });

  // Initialize toggle button styling on page load
  const $checkedRadio = document.querySelector(`${config.selectors.billingRadios}:checked`);
  if ($checkedRadio) {
    updateToggleButtons($checkedRadio);
  }
}

// Update toggle button styling
function updateToggleButtons(activeRadio) {
  // Find all toggle buttons (labels for the radio inputs)
  const toggleGroup = activeRadio.closest('.btn-group, .btn-group-toggle');
  if (!toggleGroup) return;

  const allButtons = toggleGroup.querySelectorAll('label.btn');

  console.log('Toggle group found:', toggleGroup);
  console.log('All buttons found:', allButtons.length);
  console.log('Active radio:', activeRadio);

  allButtons.forEach(button => {
    // Remove all button classes first
    button.classList.remove('btn-primary', 'btn-outline-adaptive');

    // Check if this button's for attribute matches the active radio's id
    const forAttribute = button.getAttribute('for');
    const isActive = forAttribute && forAttribute === activeRadio.id;

    console.log('Button for:', forAttribute, 'Radio id:', activeRadio.id, 'Is active:', isActive);

    if (isActive) {
      // Active button - make it outline primary
      button.classList.add('btn-primary');
    } else {
      // Inactive button - make it outline adaptive
      button.classList.add('btn-outline-adaptive');
    }
  });
}

// Update pricing display based on billing type
function updatePricing(billingType, amountElements, billingInfoElements, pricePerUnitElements) {
  // Update prices
  amountElements.forEach(amount => {
    const newPrice = billingType === 'monthly'
      ? amount.dataset.monthly
      : amount.dataset.annually;

    console.log(`Updating price from ${amount.textContent} to ${newPrice} (${billingType})`);
    console.log('Monthly value:', amount.dataset.monthly, 'Annual value:', amount.dataset.annually);

    // Update the text content with the new price
    amount.textContent = newPrice;
  });

  // Update billing info
  billingInfoElements.forEach(info => {
    const newText = billingType === 'monthly'
      ? info.dataset.monthly
      : info.dataset.annually;

    info.textContent = newText;
  });

  // Update price per unit
  pricePerUnitElements.forEach(pricePerUnit => {
    const newPricePerUnit = billingType === 'monthly'
      ? pricePerUnit.dataset.monthly
      : pricePerUnit.dataset.annually;

    pricePerUnit.textContent = newPricePerUnit;
  });
}

// Setup plan button click handlers
function setupPlanButtons() {
  // Select all buttons with data-plan-id attribute
  const $planButtons = document.querySelectorAll('button[data-plan-id]');

  $planButtons.forEach(button => {
    button.addEventListener('click', function() {
      handlePlanSelection(this);
    });
  });
}

// Handle plan selection
function handlePlanSelection(button) {
  const planId = button.dataset.planId;
  const billingType = document.querySelector(`${config.selectors.billingRadios}:checked`)?.dataset.billing || 'monthly';

  if (!planId) {
    webManager.sentry().captureException(new Error('Plan ID missing from button'));
    return;
  }

  // Get plan name and price for analytics
  const card = button.closest('.card');
  const planNameElement = card?.querySelector('.h3, .h2, .card-title');
  const planName = planNameElement?.textContent || planId;
  const priceElement = card?.querySelector('.amount');
  const price = priceElement ? parseFloat(priceElement.textContent) : 0;

  // Track add to cart event
  trackAddToCart(planId, planName, price, billingType);

  // Log for debugging
  console.log(`Added to cart: ${planId} (${billingType} frequency) - $${price}`);

  // Special handling for enterprise plan
  if (planId === 'enterprise') {
    trackEnterpriseContact();
    window.location.href = '/contact';
    return;
  }

  // Build URL going directly to checkout (skip cart page)
  const url = new URL('/payment/checkout', window.location.origin);
  url.searchParams.set('product', planId);

  // Add frequency parameter for non-basic plans
  if (planId !== 'basic') {
    url.searchParams.set('frequency', billingType);
  }

  // Redirect directly to checkout
  window.location.href = url.toString();
}

// Tracking functions
function trackPricingToggle(billingType) {
  gtag('event', 'pricing_toggle', {
    billing_type: billingType
  });
  fbq('track', 'ViewContent', {
    content_name: 'Pricing',
    content_category: billingType
  });
  ttq.track('ViewContent', {
    content_name: 'Pricing Toggle',
    content_type: billingType
  });
}

function trackAddToCart(planId, planName, price, billingType) {
  const items = [{
    item_id: planId,
    item_name: planName,
    item_category: 'subscription',
    item_variant: billingType,
    price: price,
    quantity: 1
  }];

  // Google Analytics 4
  gtag('event', 'add_to_cart', {
    currency: 'USD',
    value: price,
    items: items
  });

  // Facebook Pixel
  fbq('track', 'AddToCart', {
    content_ids: [planId],
    content_name: planName,
    content_type: 'product',
    currency: 'USD',
    value: price
  });

  // TikTok Pixel
  ttq.track('AddToCart', {
    content_id: planId,
    content_type: 'product',
    content_name: planName,
    price: price,
    quantity: 1,
    currency: 'USD',
    value: price
  });
}

function trackEnterpriseContact() {
  gtag('event', 'contact_enterprise', {
    from_page: 'pricing'
  });
  fbq('track', 'Contact', {
    content_name: 'Enterprise Plan'
  });
  ttq.track('Contact', {
    content_name: 'Enterprise Plan'
  });
}

function setupPromoCountdown() {
  const $countdownEl = document.getElementById('pricing-promo-countdown');
  const $promoTextEl = document.getElementById('pricing-promo-text');

  if (!$countdownEl || !$promoTextEl) {
    return;
  }

  const now = new Date();
  const month = now.getMonth();

  const seasons = [
    { name: 'Winter', months: [11, 0, 1], endMonth: 1, endDay: 28 },
    { name: 'Spring', months: [2, 3, 4], endMonth: 4, endDay: 31 },
    { name: 'Summer', months: [5, 6, 7], endMonth: 7, endDay: 31 },
    { name: 'Fall', months: [8, 9, 10], endMonth: 10, endDay: 30 }
  ];

  const currentSeason = seasons.find(s => s.months.includes(month));

  if (!currentSeason) {
    return;
  }

  const seasonStartDate = new Date(now.getFullYear(), currentSeason.months[0], 1);
  const seasonEndDate = new Date(now.getFullYear(), currentSeason.endMonth, currentSeason.endDay, 23, 59, 59);
  const seasonDuration = seasonEndDate - seasonStartDate;
  const seasonProgress = (now - seasonStartDate) / seasonDuration;

  const isEndOfSeason = seasonProgress >= 0.7;
  const saleName = isEndOfSeason ? `End of ${currentSeason.name} Sale` : `${currentSeason.name} Sale`;

  $promoTextEl.textContent = saleName;

  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
  const cycleStart = Math.floor(now.getTime() / twoDaysInMs) * twoDaysInMs;
  const cycleEnd = cycleStart + twoDaysInMs;

  function updateCountdown() {
    const now = new Date();
    const diff = cycleEnd - now.getTime();

    if (diff <= 0) {
      $countdownEl.textContent = '0d : 00h : 00m : 00s';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = String(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0');
    const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');

    $countdownEl.textContent = `${days}d : ${hours}h : ${minutes}m : ${seconds}s`;
  }

  // Initial call and interval setup
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Adjust navbar offset to account for banner height
  adjustNavbarOffset();
}

function adjustNavbarOffset() {
  const $promoBanner = document.getElementById('pricing-promo-banner');
  const $navbarWrapper = document.querySelector('.navbar-wrapper');

  if (!$promoBanner || !$navbarWrapper) {
    return;
  }

  // Remove hidden attribute
  $promoBanner.removeAttribute('hidden');

  const bannerHeight = $promoBanner.offsetHeight;
  $navbarWrapper.style.marginTop = `${bannerHeight - 10}px`;
}
