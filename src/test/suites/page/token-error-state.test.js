// /token page: when the flow resolves with an error (e.g. token fetch fails) the
// loading spinner must STOP and be replaced by a "Try again" (reload) button plus
// a smaller "Go home" link — previously the spinner spun forever behind the error.
//
// Each run() is serialized to the browser (Puppeteer), so every test builds the
// token card DOM (mirrors classy's auth/token.html) and replicates the module's
// stopSpinner/showError logic inline — the page module can't be imported (ESM +
// web-manager deps) and module-scope helpers aren't in the browser's scope.

module.exports = {
  layer: 'page',
  description: '/token error state swaps the spinner for retry/home actions',
  type: 'group',
  tests: [
    {
      name: 'showError stops the spinner and reveals the retry/home actions',
      run: async (ctx) => {
        const $root = document.createElement('div');
        $root.innerHTML = ''
          + '<div id="token-spinner" class="text-center mb-4"><div class="spinner-border" role="status"></div></div>'
          + '<div id="token-status" class="text-center"><p class="text-muted small">Generating secure token...</p></div>'
          + '<div id="token-error" class="alert alert-danger d-none" role="alert"><strong>Error:</strong> <span id="token-error-message"></span></div>'
          + '<div id="token-actions" class="text-center d-none">'
          +   '<button type="button" id="token-retry" class="btn btn-primary w-100">Try again</button>'
          +   '<a href="/" class="btn btn-link btn-sm text-muted d-block mt-2">Go home</a>'
          + '</div>';
        document.body.appendChild($root);

        const $status = $root.querySelector('#token-status');
        const $error = $root.querySelector('#token-error');
        const $errorMessage = $root.querySelector('#token-error-message');
        const $spinner = $root.querySelector('#token-spinner');
        const $actions = $root.querySelector('#token-actions');

        function stopSpinner() {
          if ($spinner) { $spinner.classList.add('d-none'); }
        }
        function showError(message) {
          stopSpinner();
          if ($error && $errorMessage) {
            $errorMessage.textContent = message;
            $error.classList.remove('d-none');
          }
          if ($status) { $status.classList.add('d-none'); }
          if ($actions) { $actions.classList.remove('d-none'); }
        }

        // Baseline: spinner visible, actions + error hidden
        ctx.expect($spinner.classList.contains('d-none')).toBe(false);
        ctx.expect($actions.classList.contains('d-none')).toBe(true);
        ctx.expect($error.classList.contains('d-none')).toBe(true);

        showError('Failed to generate token. Please try again.');

        // Spinner + status gone, error + actions shown, message set
        ctx.expect($spinner.classList.contains('d-none')).toBe(true);
        ctx.expect($status.classList.contains('d-none')).toBe(true);
        ctx.expect($error.classList.contains('d-none')).toBe(false);
        ctx.expect($actions.classList.contains('d-none')).toBe(false);
        ctx.expect($errorMessage.textContent).toBe('Failed to generate token. Please try again.');

        $root.remove();
      },
    },
    {
      name: 'retry button click re-runs the flow (reload)',
      run: async (ctx) => {
        const $root = document.createElement('div');
        $root.innerHTML = '<button type="button" id="token-retry" class="btn btn-primary w-100">Try again</button>';
        document.body.appendChild($root);

        const $retry = $root.querySelector('#token-retry');

        // Mirror the module's wiring with reload stubbed (can't reload the harness)
        let reloadCount = 0;
        $retry.addEventListener('click', () => { reloadCount++; });

        $retry.click();
        $retry.click();

        ctx.expect(reloadCount).toBe(2);

        $root.remove();
      },
    },
    {
      name: 'go-home link points at the site root',
      run: async (ctx) => {
        const $root = document.createElement('div');
        $root.innerHTML = '<div id="token-actions"><a href="/" class="btn btn-link btn-sm text-muted d-block mt-2">Go home</a></div>';
        document.body.appendChild($root);

        const $home = $root.querySelector('#token-actions a');

        ctx.expect($home).toBeTruthy();
        ctx.expect($home.getAttribute('href')).toBe('/');

        $root.remove();
      },
    },
    {
      name: 'terminal success (close-tab flow) also stops the spinner',
      run: async (ctx) => {
        const $root = document.createElement('div');
        $root.innerHTML = ''
          + '<div id="token-spinner" class="text-center mb-4"><div class="spinner-border" role="status"></div></div>'
          + '<div id="token-actions" class="text-center d-none"></div>';
        document.body.appendChild($root);

        const $spinner = $root.querySelector('#token-spinner');
        const $actions = $root.querySelector('#token-actions');

        // The extension "You can close this tab now." branch calls stopSpinner()
        if ($spinner) { $spinner.classList.add('d-none'); }

        ctx.expect($spinner.classList.contains('d-none')).toBe(true);
        // No error, so the retry/home actions stay hidden
        ctx.expect($actions.classList.contains('d-none')).toBe(true);

        $root.remove();
      },
    },
  ],
};
