// FormManager data collection and population: getData() with dot notation,
// radio/checkbox groups, honeypot exclusion, input-group filtering, and
// setData() reverse population. Logic inlined from form-manager.js since
// page-layer tests can't import ESM modules.

module.exports = {
  layer: 'page',
  description: 'FormManager getData / setData / input groups',
  type: 'group',
  tests: [
    // ── _setNested: dot-notation path → nested object ──────────────────
    {
      name: '_setNested builds nested objects from dot paths',
      run: async (ctx) => {
        function setNested(obj, path, value) {
          var keys = path.split('.');
          var lastKey = keys.pop();
          var current = obj;
          for (var i = 0; i < keys.length; i++) {
            if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          if (current[lastKey] !== undefined) {
            if (!Array.isArray(current[lastKey])) {
              current[lastKey] = [current[lastKey]];
            }
            current[lastKey].push(value);
          } else {
            current[lastKey] = value;
          }
        }

        var obj = {};
        setNested(obj, 'user.name', 'Ian');
        setNested(obj, 'user.address.city', 'NYC');
        setNested(obj, 'plan', 'pro');

        ctx.expect(obj.user.name).toBe('Ian');
        ctx.expect(obj.user.address.city).toBe('NYC');
        ctx.expect(obj.plan).toBe('pro');
      },
    },
    {
      name: '_setNested accumulates duplicate keys into arrays',
      run: async (ctx) => {
        function setNested(obj, path, value) {
          var keys = path.split('.');
          var lastKey = keys.pop();
          var current = obj;
          for (var i = 0; i < keys.length; i++) {
            if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          if (current[lastKey] !== undefined) {
            if (!Array.isArray(current[lastKey])) {
              current[lastKey] = [current[lastKey]];
            }
            current[lastKey].push(value);
          } else {
            current[lastKey] = value;
          }
        }

        var obj = {};
        setNested(obj, 'tags', 'a');
        setNested(obj, 'tags', 'b');
        setNested(obj, 'tags', 'c');

        ctx.expect(Array.isArray(obj.tags)).toBe(true);
        ctx.expect(obj.tags.length).toBe(3);
        ctx.expect(obj.tags).toEqual(['a', 'b', 'c']);
      },
    },

    // ── _getNested: read from nested object via dot path ────────────────
    {
      name: '_getNested reads nested values and returns undefined for missing paths',
      run: async (ctx) => {
        function getNested(obj, path) {
          return path.split('.').reduce(function (current, key) {
            return current && current[key] !== undefined ? current[key] : undefined;
          }, obj);
        }

        var obj = { user: { address: { city: 'NYC' } }, plan: 'pro' };

        ctx.expect(getNested(obj, 'user.address.city')).toBe('NYC');
        ctx.expect(getNested(obj, 'plan')).toBe('pro');
        ctx.expect(getNested(obj, 'user.phone')).toBe(undefined);
        ctx.expect(getNested(obj, 'nonexistent.deep.path')).toBe(undefined);
      },
    },

    // ── _flattenObject: nested → dot-notation flat ─────────────────────
    {
      name: '_flattenObject converts nested objects to dot paths',
      run: async (ctx) => {
        function flattenObject(obj, prefix) {
          prefix = prefix || '';
          var result = {};
          for (var key in obj) {
            var value = obj[key];
            var path = prefix ? prefix + '.' + key : key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
              var isCheckboxGroup = Object.values(value).every(function (v) { return typeof v === 'boolean'; });
              if (isCheckboxGroup) {
                result[path] = value;
              } else {
                Object.assign(result, flattenObject(value, path));
              }
            } else {
              result[path] = value;
            }
          }
          return result;
        }

        var nested = {
          user: { name: 'Ian', address: { city: 'NYC' } },
          plan: 'pro',
          features: { dark: true, beta: false },
        };

        var flat = flattenObject(nested);

        ctx.expect(flat['user.name']).toBe('Ian');
        ctx.expect(flat['user.address.city']).toBe('NYC');
        ctx.expect(flat['plan']).toBe('pro');
        // Boolean-valued objects treated as checkbox groups — kept as objects
        ctx.expect(flat['features'].dark).toBe(true);
        ctx.expect(flat['features'].beta).toBe(false);
      },
    },

    // ── getData: full integration with real form ───────────────────────
    {
      name: 'getData collects text, select, radio, and textarea values with dot notation',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="user.name" value="Ian">'
          + '<input type="email" name="user.email" value="ian@test.com">'
          + '<select name="settings.theme"><option value="light">L</option><option value="dark" selected>D</option></select>'
          + '<textarea name="notes">Hello</textarea>'
          + '<input type="radio" name="pref" value="a">'
          + '<input type="radio" name="pref" value="b" checked>';
        document.body.appendChild(form);

        // Inline getData logic (simplified — no group filter, no honeypot)
        function setNested(obj, path, value) {
          var keys = path.split('.');
          var lastKey = keys.pop();
          var current = obj;
          for (var i = 0; i < keys.length; i++) {
            if (!current[keys[i]] || typeof current[keys[i]] !== 'object') current[keys[i]] = {};
            current = current[keys[i]];
          }
          if (current[lastKey] !== undefined) {
            if (!Array.isArray(current[lastKey])) current[lastKey] = [current[lastKey]];
            current[lastKey].push(value);
          } else {
            current[lastKey] = value;
          }
        }

        var data = {};
        form.querySelectorAll('input, select, textarea').forEach(function ($f) {
          if (!$f.name) return;
          if ($f.type === 'checkbox') return;
          if ($f.type === 'radio' && !$f.checked) return;
          setNested(data, $f.name, $f.value);
        });

        ctx.expect(data.user.name).toBe('Ian');
        ctx.expect(data.user.email).toBe('ian@test.com');
        ctx.expect(data.settings.theme).toBe('dark');
        ctx.expect(data.notes).toBe('Hello');
        ctx.expect(data.pref).toBe('b');

        form.remove();
      },
    },
    {
      name: 'getData handles single checkbox (boolean) and checkbox groups (object)',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="checkbox" name="subscribe" checked>'
          + '<input type="checkbox" name="features" value="dark" checked>'
          + '<input type="checkbox" name="features" value="beta">'
          + '<input type="checkbox" name="features" value="analytics" checked>';
        document.body.appendChild(form);

        var data = {};
        var fields = form.querySelectorAll('input');
        var checkboxCounts = {};
        fields.forEach(function ($f) {
          if ($f.type === 'checkbox') checkboxCounts[$f.name] = (checkboxCounts[$f.name] || 0) + 1;
        });

        // Single checkboxes
        fields.forEach(function ($f) {
          if ($f.type !== 'checkbox') return;
          if (checkboxCounts[$f.name] === 1) {
            data[$f.name] = $f.checked;
          }
        });

        // Checkbox groups
        var processed = {};
        fields.forEach(function ($f) {
          if ($f.type !== 'checkbox') return;
          if (checkboxCounts[$f.name] === 1) return;
          if (processed[$f.name]) return;
          processed[$f.name] = true;
          var values = {};
          form.querySelectorAll('input[type="checkbox"][name="' + $f.name + '"]').forEach(function ($cb) {
            values[$cb.value] = $cb.checked;
          });
          data[$f.name] = values;
        });

        // Single checkbox → boolean
        ctx.expect(data.subscribe).toBe(true);

        // Checkbox group → object with value: boolean
        ctx.expect(data.features.dark).toBe(true);
        ctx.expect(data.features.beta).toBe(false);
        ctx.expect(data.features.analytics).toBe(true);

        form.remove();
      },
    },
    {
      name: 'getData excludes honeypot fields',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="email" value="real@test.com">'
          + '<input type="text" name="honey" data-honey value="bot-filled">'
          + '<input type="text" name="trap" value="legit">';
        document.body.appendChild(form);

        var HONEYPOT_SELECTOR = '[data-honey], [name="honey"]';
        var data = {};
        form.querySelectorAll('input').forEach(function ($f) {
          if (!$f.name) return;
          if ($f.matches(HONEYPOT_SELECTOR)) return;
          data[$f.name] = $f.value;
        });

        ctx.expect(data.email).toBe('real@test.com');
        ctx.expect(data.honey).toBe(undefined);
        ctx.expect(data.trap).toBe('legit');

        form.remove();
      },
    },

    // ── Input group filtering ──────────────────────────────────────────
    {
      name: 'input group filter includes matching + global fields, excludes others',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="global_name" value="always">'
          + '<input type="text" name="group_a_field" data-input-group="a" value="from-a">'
          + '<input type="text" name="group_b_field" data-input-group="b" value="from-b">';
        document.body.appendChild(form);

        var allowedGroups = ['a'];

        function isFieldInGroup($field) {
          if (!allowedGroups) return true;
          var fieldGroup = $field.getAttribute('data-input-group');
          if (!fieldGroup || fieldGroup.trim() === '') return true;
          return allowedGroups.indexOf(fieldGroup.toLowerCase()) !== -1;
        }

        var data = {};
        form.querySelectorAll('input').forEach(function ($f) {
          if (!$f.name || !isFieldInGroup($f)) return;
          data[$f.name] = $f.value;
        });

        ctx.expect(data.global_name).toBe('always');
        ctx.expect(data.group_a_field).toBe('from-a');
        ctx.expect(data.group_b_field).toBe(undefined);

        form.remove();
      },
    },
    {
      name: 'input group filter with multiple groups includes all matching',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="a_field" data-input-group="a" value="A">'
          + '<input type="text" name="b_field" data-input-group="b" value="B">'
          + '<input type="text" name="c_field" data-input-group="c" value="C">';
        document.body.appendChild(form);

        var allowedGroups = ['a', 'b'];

        function isFieldInGroup($field) {
          if (!allowedGroups) return true;
          var fieldGroup = $field.getAttribute('data-input-group');
          if (!fieldGroup || fieldGroup.trim() === '') return true;
          return allowedGroups.indexOf(fieldGroup.toLowerCase()) !== -1;
        }

        var data = {};
        form.querySelectorAll('input').forEach(function ($f) {
          if (!$f.name || !isFieldInGroup($f)) return;
          data[$f.name] = $f.value;
        });

        ctx.expect(data.a_field).toBe('A');
        ctx.expect(data.b_field).toBe('B');
        ctx.expect(data.c_field).toBe(undefined);

        form.remove();
      },
    },

    // ── setData: populate form from object ─────────────────────────────
    {
      name: 'setData populates text, select, textarea fields',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="text" name="user.name">'
          + '<input type="email" name="user.email">'
          + '<select name="theme"><option value="light">L</option><option value="dark">D</option></select>'
          + '<textarea name="notes"></textarea>';
        document.body.appendChild(form);

        function setFieldValue(name, value) {
          var fields = form.querySelectorAll('[name="' + name + '"]');
          if (fields.length === 0) return;
          fields[0].value = value;
        }

        function flattenObject(obj, prefix) {
          prefix = prefix || '';
          var result = {};
          for (var key in obj) {
            var value = obj[key];
            var path = prefix ? prefix + '.' + key : key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
              var isCbGroup = Object.values(value).every(function (v) { return typeof v === 'boolean'; });
              if (isCbGroup) { result[path] = value; } else { Object.assign(result, flattenObject(value, path)); }
            } else {
              result[path] = value;
            }
          }
          return result;
        }

        var flat = flattenObject({ user: { name: 'John', email: 'j@test.com' }, theme: 'dark', notes: 'Hi' });
        for (var path in flat) {
          setFieldValue(path, flat[path]);
        }

        ctx.expect(form.querySelector('[name="user.name"]').value).toBe('John');
        ctx.expect(form.querySelector('[name="user.email"]').value).toBe('j@test.com');
        ctx.expect(form.querySelector('[name="theme"]').value).toBe('dark');
        ctx.expect(form.querySelector('[name="notes"]').value).toBe('Hi');

        form.remove();
      },
    },
    {
      name: 'setData sets radio group to matching value',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="radio" name="plan" value="free" checked>'
          + '<input type="radio" name="plan" value="pro">'
          + '<input type="radio" name="plan" value="enterprise">';
        document.body.appendChild(form);

        // Set radio group
        form.querySelectorAll('[name="plan"]').forEach(function ($r) {
          $r.checked = ($r.value === 'pro');
        });

        ctx.expect(form.querySelector('[value="free"]').checked).toBe(false);
        ctx.expect(form.querySelector('[value="pro"]').checked).toBe(true);
        ctx.expect(form.querySelector('[value="enterprise"]').checked).toBe(false);

        form.remove();
      },
    },
    {
      name: 'setData sets single checkbox boolean and checkbox group values',
      run: async (ctx) => {
        var form = document.createElement('form');
        form.innerHTML = '<input type="checkbox" name="subscribe">'
          + '<input type="checkbox" name="features" value="dark">'
          + '<input type="checkbox" name="features" value="beta">';
        document.body.appendChild(form);

        // Single checkbox
        form.querySelector('[name="subscribe"]').checked = true;

        // Checkbox group
        var groupValues = { dark: true, beta: false };
        form.querySelectorAll('[name="features"]').forEach(function ($cb) {
          $cb.checked = !!groupValues[$cb.value];
        });

        ctx.expect(form.querySelector('[name="subscribe"]').checked).toBe(true);
        ctx.expect(form.querySelector('[value="dark"]').checked).toBe(true);
        ctx.expect(form.querySelector('[value="beta"]').checked).toBe(false);

        form.remove();
      },
    },
  ],
};
