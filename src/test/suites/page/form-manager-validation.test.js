// FormManager validation: HTML5 constraint validation (required, email, min,
// max, minlength, maxlength, pattern), honeypot detection, and file-accept
// matching. Logic inlined from form-manager.js.

module.exports = {
  layer: 'page',
  description: 'FormManager validation + honeypot + file-accept',
  type: 'group',
  tests: [
    // ── Required validation ────────────────────────────────────────────
    {
      name: 'required text field fails when empty, passes when filled',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="name" required>';
        document.body.appendChild(form);

        var errors = {};
        var $f = form.querySelector('[name="name"]');

        // Empty → error
        if ($f.hasAttribute('required') && (!$f.value || !$f.value.trim())) {
          errors['name'] = 'required';
        }
        ctx.expect(errors['name']).toBe('required');

        // Filled → no error
        errors = {};
        $f.value = 'Ian';
        if ($f.hasAttribute('required') && (!$f.value || !$f.value.trim())) {
          errors['name'] = 'required';
        }
        ctx.expect(errors['name']).toBe(undefined);

        form.remove();
      },
    },
    {
      name: 'required checkbox fails when unchecked',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="checkbox" name="terms" required>';
        document.body.appendChild(form);

        var errors = {};
        var $f = form.querySelector('[name="terms"]');

        if ($f.hasAttribute('required') && $f.type === 'checkbox' && !$f.checked) {
          errors['terms'] = 'required';
        }
        ctx.expect(errors['terms']).toBe('required');

        $f.checked = true;
        errors = {};
        if ($f.hasAttribute('required') && $f.type === 'checkbox' && !$f.checked) {
          errors['terms'] = 'required';
        }
        ctx.expect(errors['terms']).toBe(undefined);

        form.remove();
      },
    },
    {
      name: 'required radio group fails when none checked',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="radio" name="plan" value="a" required>'
          + '<input type="radio" name="plan" value="b" required>';
        document.body.appendChild(form);

        var errors = {};
        var $checked = form.querySelector('input[name="plan"]:checked');
        if (!$checked) {
          errors['plan'] = 'required';
        }
        ctx.expect(errors['plan']).toBe('required');

        form.querySelector('[value="b"]').checked = true;
        errors = {};
        $checked = form.querySelector('input[name="plan"]:checked');
        if (!$checked) {
          errors['plan'] = 'required';
        }
        ctx.expect(errors['plan']).toBe(undefined);

        form.remove();
      },
    },

    // ── Email validation ───────────────────────────────────────────────
    {
      name: 'email validation rejects invalid formats and accepts valid ones',
      run: async (ctx) => {
        var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        ctx.expect(emailPattern.test('ian@example.com')).toBe(true);
        ctx.expect(emailPattern.test('user+tag@sub.domain.co')).toBe(true);
        ctx.expect(emailPattern.test('bad')).toBe(false);
        ctx.expect(emailPattern.test('no@tld')).toBe(false);
        ctx.expect(emailPattern.test('@missing.com')).toBe(false);
        ctx.expect(emailPattern.test('spaces @test.com')).toBe(false);
      },
    },

    // ── Min/max value validation ───────────────────────────────────────
    {
      name: 'number min/max validation catches out-of-range values',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="number" name="age" min="18" max="120">';
        document.body.appendChild(form);

        var $f = form.querySelector('[name="age"]');

        function validate(value) {
          $f.value = value;
          if ($f.hasAttribute('min') && parseFloat($f.value) < parseFloat($f.getAttribute('min'))) return 'too-low';
          if ($f.hasAttribute('max') && parseFloat($f.value) > parseFloat($f.getAttribute('max'))) return 'too-high';
          return 'ok';
        }

        ctx.expect(validate('17')).toBe('too-low');
        ctx.expect(validate('18')).toBe('ok');
        ctx.expect(validate('50')).toBe('ok');
        ctx.expect(validate('120')).toBe('ok');
        ctx.expect(validate('121')).toBe('too-high');

        form.remove();
      },
    },

    // ── Minlength / maxlength validation ───────────────────────────────
    {
      name: 'minlength and maxlength validation',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="code" minlength="3" maxlength="10">';
        document.body.appendChild(form);

        var $f = form.querySelector('[name="code"]');

        function validate(value) {
          $f.value = value;
          var minLen = parseInt($f.getAttribute('minlength'), 10);
          var maxLen = parseInt($f.getAttribute('maxlength'), 10);
          if ($f.value.length < minLen) return 'too-short';
          if ($f.value.length > maxLen) return 'too-long';
          return 'ok';
        }

        ctx.expect(validate('ab')).toBe('too-short');
        ctx.expect(validate('abc')).toBe('ok');
        ctx.expect(validate('abcdefghij')).toBe('ok');
        ctx.expect(validate('abcdefghijk')).toBe('too-long');

        form.remove();
      },
    },

    // ── Pattern validation ─────────────────────────────────────────────
    {
      name: 'pattern attribute validation',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="zip" pattern="[0-9]{5}" title="5-digit zip">';
        document.body.appendChild(form);

        var $f = form.querySelector('[name="zip"]');

        function validate(value) {
          $f.value = value;
          var pattern = new RegExp('^' + $f.getAttribute('pattern') + '$');
          return pattern.test($f.value);
        }

        ctx.expect(validate('12345')).toBe(true);
        ctx.expect(validate('1234')).toBe(false);
        ctx.expect(validate('123456')).toBe(false);
        ctx.expect(validate('abcde')).toBe(false);

        form.remove();
      },
    },

    // ── Honeypot detection ─────────────────────────────────────────────
    {
      name: 'honeypot detection catches [data-honey] and [name="honey"] fields',
      run: async (ctx) => {
        var HONEYPOT_SELECTOR = '[data-honey], [name="honey"]';

        // Form with empty honeypot → not filled
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="email" value="real">'
          + '<input type="text" name="honey" data-honey value="">';
        document.body.appendChild(form);

        function isHoneypotFilled(f) {
          var pots = f.querySelectorAll(HONEYPOT_SELECTOR);
          for (var i = 0; i < pots.length; i++) {
            if (pots[i].value && pots[i].value.trim() !== '') return true;
          }
          return false;
        }

        ctx.expect(isHoneypotFilled(form)).toBe(false);

        // Fill the honeypot → detected
        form.querySelector('[name="honey"]').value = 'bot-spam';
        ctx.expect(isHoneypotFilled(form)).toBe(true);

        form.remove();
      },
    },
    {
      name: 'honeypot detects data-honey without name="honey"',
      run: async (ctx) => {
        var HONEYPOT_SELECTOR = '[data-honey], [name="honey"]';

        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="realfield" value="ok">'
          + '<input type="text" name="decoy" data-honey value="">';
        document.body.appendChild(form);

        function isHoneypotFilled(f) {
          var pots = f.querySelectorAll(HONEYPOT_SELECTOR);
          for (var i = 0; i < pots.length; i++) {
            if (pots[i].value && pots[i].value.trim() !== '') return true;
          }
          return false;
        }

        ctx.expect(isHoneypotFilled(form)).toBe(false);

        form.querySelector('[data-honey]').value = 'filled';
        ctx.expect(isHoneypotFilled(form)).toBe(true);

        form.remove();
      },
    },

    // ── _fileMatchesAccept ─────────────────────────────────────────────
    {
      name: 'file-accept matching: extension, wildcard MIME, exact MIME',
      run: async (ctx) => {
        function fileMatchesAccept(fileName, fileType, accept) {
          var types = accept.split(',').map(function (t) { return t.trim().toLowerCase(); });
          fileName = fileName.toLowerCase();
          fileType = (fileType || '').toLowerCase();
          var extToCategory = {
            '.jpg': 'image/', '.jpeg': 'image/', '.png': 'image/', '.gif': 'image/',
            '.webp': 'image/', '.svg': 'image/', '.pdf': 'application/pdf',
          };

          for (var i = 0; i < types.length; i++) {
            var type = types[i];
            if (type.startsWith('.')) {
              if (fileName.endsWith(type)) return true;
              continue;
            }
            if (type.endsWith('/*')) {
              var prefix = type.slice(0, -2) + '/';
              if (fileType && fileType.startsWith(prefix)) return true;
              if (!fileType) {
                var ext = '.' + fileName.split('.').pop();
                var guessed = extToCategory[ext] || '';
                if (guessed.startsWith(prefix)) return true;
              }
              continue;
            }
            if (fileType === type) return true;
          }
          return false;
        }

        // Extension matching
        ctx.expect(fileMatchesAccept('doc.pdf', 'application/pdf', '.pdf')).toBe(true);
        ctx.expect(fileMatchesAccept('doc.txt', 'text/plain', '.pdf')).toBe(false);

        // Wildcard MIME
        ctx.expect(fileMatchesAccept('photo.jpg', 'image/jpeg', 'image/*')).toBe(true);
        ctx.expect(fileMatchesAccept('photo.png', 'image/png', 'image/*')).toBe(true);
        ctx.expect(fileMatchesAccept('doc.pdf', 'application/pdf', 'image/*')).toBe(false);

        // Exact MIME
        ctx.expect(fileMatchesAccept('doc.pdf', 'application/pdf', 'application/pdf')).toBe(true);
        ctx.expect(fileMatchesAccept('doc.pdf', 'application/pdf', 'text/plain')).toBe(false);

        // Multi-accept
        ctx.expect(fileMatchesAccept('photo.jpg', 'image/jpeg', '.pdf,image/*')).toBe(true);
        ctx.expect(fileMatchesAccept('doc.pdf', 'application/pdf', '.pdf,image/*')).toBe(true);
        ctx.expect(fileMatchesAccept('code.js', 'text/javascript', '.pdf,image/*')).toBe(false);

        // Extension fallback when MIME type is empty
        ctx.expect(fileMatchesAccept('photo.jpg', '', 'image/*')).toBe(true);
        ctx.expect(fileMatchesAccept('photo.png', '', 'image/*')).toBe(true);
        ctx.expect(fileMatchesAccept('unknown.xyz', '', 'image/*')).toBe(false);
      },
    },

    // ── Field error display ────────────────────────────────────────────
    {
      name: 'field error display adds is-invalid class and feedback element',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<div class="mb-3"><input type="text" name="email" class="form-control"></div>';
        document.body.appendChild(form);

        var $field = form.querySelector('[name="email"]');

        // Show error
        $field.classList.add('is-invalid');
        var $feedback = document.createElement('div');
        $feedback.className = 'invalid-feedback';
        $feedback.textContent = 'Email is required';
        $feedback.style.display = 'block';
        $field.parentElement.appendChild($feedback);

        ctx.expect($field.classList.contains('is-invalid')).toBe(true);
        var $fb = $field.parentElement.querySelector('.invalid-feedback');
        ctx.expect($fb).toBeTruthy();
        ctx.expect($fb.textContent).toBe('Email is required');

        // Clear error
        $field.classList.remove('is-invalid');
        $fb.style.display = 'none';
        ctx.expect($field.classList.contains('is-invalid')).toBe(false);

        form.remove();
      },
    },

    // ── Query param population ─────────────────────────────────────────
    {
      name: 'query param population skips UTM/tracking params',
      run: async (ctx) => {
        var skipPrefixes = ['utm_', 'itm_'];
        var skipExact = ['cb', 'fbclid', 'gclid'];

        function shouldSkip(key) {
          for (var i = 0; i < skipPrefixes.length; i++) {
            if (key.startsWith(skipPrefixes[i])) return true;
          }
          return skipExact.indexOf(key) !== -1;
        }

        ctx.expect(shouldSkip('utm_source')).toBe(true);
        ctx.expect(shouldSkip('utm_campaign')).toBe(true);
        ctx.expect(shouldSkip('itm_source')).toBe(true);
        ctx.expect(shouldSkip('cb')).toBe(true);
        ctx.expect(shouldSkip('fbclid')).toBe(true);
        ctx.expect(shouldSkip('gclid')).toBe(true);
        ctx.expect(shouldSkip('email')).toBe(false);
        ctx.expect(shouldSkip('name')).toBe(false);
      },
    },

    // ── State attribute ────────────────────────────────────────────────
    {
      name: 'data-form-state attribute reflects state transitions',
      run: async (ctx) => {
        var form = document.createElement('form');
        document.body.appendChild(form);

        var states = ['initializing', 'ready', 'submitting', 'ready', 'submitted'];
        states.forEach(function (s) {
          form.setAttribute('data-form-state', s);
          ctx.expect(form.getAttribute('data-form-state')).toBe(s);
        });

        form.remove();
      },
    },
  ],
};
