// Minimal fixture bundle. Real UJM bundles initialize a Manager + webManager;
// for boot tests we only need a script that loads without throwing so the
// fixture site can assert "no console errors".
(function () {
  window.__ujmFixtureLoaded = true;
})();
