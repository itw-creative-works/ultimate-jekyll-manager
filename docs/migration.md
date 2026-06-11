# Migration

Procedures for moving projects between UJ/UJM format versions. Three modes: **full migration** (old UJ → latest UJM base), **quick fix** (normalize `_config.yml` section order), and **revert posts** (back to the OLD pre-migration format).

## Full Migration (old UJ → new UJM)

Three stages: repository migration to the latest UJM base (preserving content in `_legacy/`) → config YML re-mapping → cleanup.

### Stage 1: Repository migration to the new UJM base

1. **Sync latest changes:** `git fetch origin && git pull origin master`
2. **Delete node_modules** before moving to legacy: `rm -rf node_modules`
3. **Move everything to `_legacy/`** for a clean slate:
   ```bash
   mkdir -p _legacy
   find . -maxdepth 1 ! -name '_legacy' ! -name '.' ! -name '.git' -exec mv {} _legacy/ \;
   ```
4. **Download the Ultimate Jekyll template** (https://github.com/itw-creative-works/ultimate-jekyll):
   ```bash
   git clone https://github.com/itw-creative-works/ultimate-jekyll.git /tmp/uj-fresh
   rsync -av --exclude='.git' /tmp/uj-fresh/ ./
   rm -rf /tmp/uj-fresh
   ```
5. **Setup and build:** `npm install && npx mgr setup && npm run build`
6. **Migrate content from legacy.** **DO NOT copy default pages** — UJM provides standard pages through its template system (see `src/defaults/dist/pages` in the UJM package for the full list). Only migrate **content** (posts, images, collections):
   ```bash
   # Blog images
   mkdir -p src/assets/images/blog
   cp -r _legacy/assets/_src/images/blog/posts/* src/assets/images/blog/ 2>/dev/null || true
   cp -r _legacy/assets/images/blog/posts/* src/assets/images/blog/ 2>/dev/null || true

   # Blog posts
   mkdir -p src/_posts
   cp -r _legacy/_posts/* src/_posts/ 2>/dev/null || true

   # Custom collections / images (if any)
   cp -r _legacy/_themes src/_themes 2>/dev/null || true
   cp -r _legacy/assets/images/themes src/assets/images/ 2>/dev/null || true
   cp -r _legacy/assets/images/resources src/assets/images/ 2>/dev/null || true
   ```
   **Custom pages — DO NOT COPY, RECREATE:** reference `_legacy/pages/` for content/text only; rebuild the HTML with the current theme structure ([layouts-and-pages.md](layouts-and-pages.md), [themes.md](themes.md)).
7. **Verify:** `src/_posts/` populated, `src/assets/images/blog/` populated, `_legacy/_config.yml` exists (used in stage 2), NO legacy pages copied.
8. **Rename master → main:**
   ```bash
   git branch -m master main
   git push -u origin main
   gh api repos/OWNER/REPO -X PATCH -f default_branch=main
   git push origin --delete master
   ```

### Stage 2: Config YML re-mapping

1. Read the NEW standard template (`src/defaults/src/_config.yml` in the UJM package) and the OLD config (`_legacy/_config.yml`).
2. Create a migration TODO list.
3. **Map old keys to new format** — use the NEW format as the template (preserve order, comments, structure); map old keys to new (e.g. `contact.email-support` → `brand.contact.email`). **DO NOT import keys that don't exist in the NEW format**; only import deprecated keys when the user explicitly requests them.
4. After initial mapping, tell the user: "Base migration complete. If you need any deprecated keys from `_legacy/_config.yml` imported, let me know which ones."
5. Write the new `src/_config.yml` — NEW structure/order/comments, values filled from the old config where mappings exist.
6. **Required adjustments:** replace hardcoded brand names with `{{ site.brand.name }}` in `meta.title`/`meta.description`; rewrite `brand.description` to 5-8 words max; set default colors for cookieConsent and chatsy (`#237afc` / `#fff`).
7. Verify.

### Stage 3: Cleanup

1. Run `npx mgr migrate`.
2. Tell the user: the `_legacy/` folder holds the original files for reference and can be deleted (`rm -rf _legacy/`) once confirmed.

## Quick Fix (normalize `_config.yml` section order)

Ensure these keys exist in `src/_config.yml` in this order. Insert missing keys with these defaults — do NOT overwrite existing values:

```yaml
# Tracking
tracking:
  google-analytics: null
  meta-pixel: null
  tiktok-pixel: null

# reCAPTCHA
recaptcha:
  site-key: null

# Cloudflare
cloudflare:
  zone: null

# Download
download:
  mac:
    universal: ""
  windows:
    universal: ""
  linux:
    debian: ""
    snap: ""
  ios:
    universal: ""
  android:
    universal: ""

# Extension
extension:
  chrome: ""
  firefox: ""
  opera: ""
  safari: ""
  edge: ""
  brave: ""

# Favicon
favicon:
  path: "https://cdn.itwcreativeworks.com/assets/itw-creative-works/images/favicon"
  safari-pinned-tab: "#5bbad5"
  msapp-tile-color: "#da532c"
  theme-color: "#ffffff"
```

## Revert Posts (back to the OLD format)

For sites that have NOT yet migrated to the new UJ structure. Verify `./src/_posts` exists before starting.

1. **Move posts:** `./src/_posts` → `./_posts` (preserve folder structure)
2. **Move blog images:** everything under `./src/assets/images/blog/` → `./assets/_src/images/blog/posts/` (create destination if needed)
3. **Remove `./src`** after the moves complete
4. **Update front matter** in every `./_posts/**/*.md`:
   - `layout: blueprint/blog/post` → `layout: app/blog/post`
   - rename key `post.description` → `post.excerpt`

## See also

- [directory-structure.md](directory-structure.md) — where everything lives in the new format
- [layouts-and-pages.md](layouts-and-pages.md) — recreating custom pages with blueprints
- [themes.md](themes.md) — the theme structure recreated pages must use
