// FormManager disabled-state snapshot: elements disabled in HTML markup stay
// disabled through every FM state transition. Submit buttons (loading guards)
// are always FM-managed regardless of initial HTML state.
//
// Can't import FormManager (ESM + web-manager dep), so we inline the snapshot
// + _setDisabled logic and test against a real DOM form.

module.exports = {
  layer: 'page',
  description: 'FormManager disabled-state snapshot',
  type: 'group',
  tests: [
    {
      name: 'snapshot captures disabled non-submit elements, ignores submit buttons',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="email">'
          + '<input type="radio" name="plan" value="free">'
          + '<input type="radio" name="plan" value="enterprise" disabled>'
          + '<select name="region" disabled><option>US</option></select>'
          + '<textarea name="notes"></textarea>'
          + '<button type="submit" disabled>Submit</button>'
          + '<button type="button">Cancel</button>';
        document.body.appendChild(form);

        var permanently = new Set();
        form.querySelectorAll('button, input, select, textarea').forEach(function ($el) {
          if ($el.disabled && $el.type !== 'submit') {
            permanently.add($el);
          }
        });

        ctx.expect(permanently.size).toBe(2);
        ctx.expect(permanently.has(form.querySelector('[value="enterprise"]'))).toBe(true);
        ctx.expect(permanently.has(form.querySelector('[name="region"]'))).toBe(true);
        ctx.expect(permanently.has(form.querySelector('[type="submit"]'))).toBe(false);

        form.remove();
      },
    },
    {
      name: 'setDisabled(true) disables everything',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="email">'
          + '<input type="radio" name="plan" value="enterprise" disabled>'
          + '<button type="submit" disabled>Submit</button>';
        document.body.appendChild(form);

        var permanently = new Set();
        form.querySelectorAll('button, input, select, textarea').forEach(function ($el) {
          if ($el.disabled && $el.type !== 'submit') {
            permanently.add($el);
          }
        });

        form.querySelectorAll('button, input, select, textarea').forEach(function ($el) {
          if (permanently.has($el)) { $el.disabled = true; return; }
          $el.disabled = true;
        });

        form.querySelectorAll('button, input, select, textarea').forEach(function ($el) {
          ctx.expect($el.disabled).toBe(true);
        });

        form.remove();
      },
    },
    {
      name: 'setDisabled(false) re-enables managed elements but keeps snapshotted ones disabled',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="email">'
          + '<input type="radio" name="plan" value="free">'
          + '<input type="radio" name="plan" value="pro">'
          + '<input type="radio" name="plan" value="enterprise" disabled>'
          + '<select name="region" disabled><option>US</option></select>'
          + '<textarea name="notes"></textarea>'
          + '<button type="submit" disabled>Submit</button>'
          + '<button type="button">Cancel</button>';
        document.body.appendChild(form);

        var permanently = new Set();
        form.querySelectorAll('button, input, select, textarea').forEach(function ($el) {
          if ($el.disabled && $el.type !== 'submit') {
            permanently.add($el);
          }
        });

        function setDisabled(disabled) {
          form.querySelectorAll('button, input, select, textarea').forEach(function ($el) {
            if (permanently.has($el)) { $el.disabled = true; return; }
            $el.disabled = disabled;
          });
        }

        setDisabled(true);
        setDisabled(false);

        ctx.expect(form.querySelector('[name="email"]').disabled).toBe(false);
        ctx.expect(form.querySelector('[value="free"]').disabled).toBe(false);
        ctx.expect(form.querySelector('[value="pro"]').disabled).toBe(false);
        ctx.expect(form.querySelector('[type="submit"]').disabled).toBe(false);
        ctx.expect(form.querySelector('[type="button"]').disabled).toBe(false);
        ctx.expect(form.querySelector('textarea').disabled).toBe(false);

        ctx.expect(form.querySelector('[value="enterprise"]').disabled).toBe(true);
        ctx.expect(form.querySelector('[name="region"]').disabled).toBe(true);

        form.remove();
      },
    },
    {
      name: 'survives multiple disable/enable cycles',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="email">'
          + '<input type="radio" name="plan" value="enterprise" disabled>'
          + '<select name="region" disabled><option>US</option></select>'
          + '<button type="submit" disabled>Submit</button>';
        document.body.appendChild(form);

        var permanently = new Set();
        form.querySelectorAll('button, input, select, textarea').forEach(function ($el) {
          if ($el.disabled && $el.type !== 'submit') {
            permanently.add($el);
          }
        });

        function setDisabled(disabled) {
          form.querySelectorAll('button, input, select, textarea').forEach(function ($el) {
            if (permanently.has($el)) { $el.disabled = true; return; }
            $el.disabled = disabled;
          });
        }

        for (var i = 0; i < 5; i++) {
          setDisabled(true);
          setDisabled(false);
        }

        ctx.expect(form.querySelector('[name="email"]').disabled).toBe(false);
        ctx.expect(form.querySelector('[type="submit"]').disabled).toBe(false);
        ctx.expect(form.querySelector('[value="enterprise"]').disabled).toBe(true);
        ctx.expect(form.querySelector('[name="region"]').disabled).toBe(true);

        form.remove();
      },
    },
    {
      name: 'onsubmit="return false" blocks native submission before FM loads',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.setAttribute('onsubmit', 'return false');
        form.innerHTML = '<input type="text" name="x"><button type="submit">Go</button>';
        document.body.appendChild(form);

        var navigated = false;
        form.addEventListener('submit', function (e) {
          navigated = !e.defaultPrevented;
        });

        form.querySelector('button').click();
        ctx.expect(navigated).toBe(false);

        form.remove();
      },
    },
  ],
};
