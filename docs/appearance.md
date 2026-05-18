# Appearance Switching System

Ultimate Jekyll supports dark/light/system theme switching with user preference persistence.

## Supported Modes

- `dark` — Force dark mode
- `light` — Force light mode
- `system` — Auto-detect from OS preference (`prefers-color-scheme`)

## JavaScript API

```javascript
// Get/set preference
webManager.uj().appearance.get();        // Returns 'dark', 'light', 'system', or null
webManager.uj().appearance.set('dark');  // Save and apply preference
webManager.uj().appearance.getResolved(); // Returns actual theme: 'dark' or 'light'

// Utilities
webManager.uj().appearance.toggle();     // Toggle between dark/light
webManager.uj().appearance.cycle();      // Cycle: dark → light → system → dark
webManager.uj().appearance.clear();      // Clear saved preference
```

## HTML Data Attributes

```html
<!-- Buttons to set appearance (auto-gets 'active' class) -->
<button data-appearance-set="light">Light</button>
<button data-appearance-set="dark">Dark</button>
<button data-appearance-set="system">System</button>

<!-- Display current mode as text -->
<span data-appearance-current></span>

<!-- Show/hide icons based on current mode -->
<span data-appearance-icon="light" hidden>☀️</span>
<span data-appearance-icon="dark" hidden>🌙</span>
<span data-appearance-icon="system" hidden>💻</span>
```

## Dropdown Example

```html
<div class="dropdown">
  <button class="btn dropdown-toggle" data-bs-toggle="dropdown">
    <span data-appearance-icon="light" hidden>{% uj_icon "sun", "fa-md me-2" %}</span>
    <span data-appearance-icon="dark" hidden>{% uj_icon "moon-stars", "fa-md me-2" %}</span>
    <span data-appearance-icon="system" hidden>{% uj_icon "circle-half-stroke", "fa-md me-2" %}</span>
    <span data-appearance-current></span>
  </button>
  <ul class="dropdown-menu">
    <li><a class="dropdown-item" href="#" data-appearance-set="light">Light</a></li>
    <li><a class="dropdown-item" href="#" data-appearance-set="dark">Dark</a></li>
    <li><a class="dropdown-item" href="#" data-appearance-set="system">System</a></li>
  </ul>
</div>
```

## Implementation

- **Inline script:** `src/defaults/dist/_includes/core/body.html` — Runs immediately to prevent flash
- **Module:** `src/assets/js/core/appearance.js` — API and UI handling
- **Storage:** Saved under `_manager.appearance.preference` in localStorage
- **Test page:** `/test/libraries/appearance`
