# Blog Post Images

## Inline Images with `@post/` Shortcut

Blog posts use standard markdown syntax for inline images. The `@post/` prefix provides a shortcut to reference images in the post's own image directory:

```markdown
![Alt text](@post/my-image.jpg)
```

This resolves at build time to `/assets/images/blog/post-{id}/my-image.jpg`, where `{id}` comes from the post's `post.id` frontmatter value.

**All image types work:**

| Syntax | Result |
|--------|--------|
| `![alt](@post/file.jpg)` | Local post image (shortcut) |
| `![alt](/assets/images/other.jpg)` | Absolute path (any image) |
| `![alt](https://example.com/img.jpg)` | External URL |

**How it works:** The `markdown-images.rb` hook in `jekyll-uj-powertools` intercepts `![alt](url)` patterns during `pre_render`, resolves `@post/` prefixes, then converts each image to a responsive `<picture>` element with WebP sources and lazy loading via `{% uj_image %}`.

**Image directory structure:** Images for post ID `42` live at `src/assets/images/blog/post-42/`.

**Image class customization:** Set via frontmatter:

```yaml
---
theme:
  post:
    image:
      class: "img-fluid rounded-3 shadow my-5"
---
```

## BEM `admin/post` Image Handling

When posts are created via BEM's `POST /admin/post` endpoint:
1. External image URLs in the markdown body (e.g., Unsplash) are downloaded
2. Images are uploaded to `src/assets/images/blog/post-{id}/` on GitHub
3. The body is rewritten to use `@post/{filename}` format
4. Failed downloads are skipped (original external URL preserved)

## Image Processing Pipeline (`imagemin` gulp task)

The `imagemin` task (`src/gulp/tasks/imagemin.js`) processes every file under `src/assets/images/**/*.{jpg,jpeg,png,gif,svg,webp}` into `dist/assets/images/`. For raster formats supported by `gulp-responsive-modern` (`jpg`, `jpeg`, `png`), each source produces **8 outputs**: original + `1024px`, `640px`, `320px` variants, each as the source format **and** WebP.

Outputs are content-addressed and cached on a dedicated branch (`cache-uj-imagemin`). Subsequent builds only reprocess images whose source hash changed.

### Source size matters

The responsive pipeline streams every input through `sharp` to generate variants. Sources with very large dimensions (tens of thousands of pixels) decode into hundreds of MB of raw pixel data per worker. In practice this can stall the underlying stream so quietly that gulp can't see the failure — the build "succeeds" but the affected images never land in `_site/`.

**Recommendation:** Keep source images at sensible dimensions before they land in `src/assets/images/`. A 4096px longest-side cap at the upload step is plenty for blog hero images (the largest responsive variant is 1024px). If you ingest images via an automated pipeline (e.g. BEM's `admin/post` endpoint downloading external URLs), cap them there.

### Cleanup for existing oversized sources: `UJ_IMAGEMIN_REWRITE_SOURCES`

If oversized images already exist in your repo and you can't easily re-upload them, run the imagemin task once with the rewrite flag set:

```bash
UJ_IMAGEMIN_REWRITE_SOURCES=true npm run build
```

When set, the imagemin task — **before** it pipes images into `gulp-responsive-modern` — scans every file scheduled for processing and rewrites in place any whose longest dimension exceeds `4096px`. Rewrites use `sharp` with `fit: 'inside'` (preserves aspect ratio, never enlarges), JPEG quality 80 / `mozjpeg` / progressive, and PNG quality 80. Cache hashes for affected files are updated so the new content is the new cache key.

**Notes:**
- The flag is **opt-in by design** — running it commits real diffs to your source images. Intended for one-off cleanup runs, not for regular builds or CI.
- Only files that the cache layer has decided need processing get checked. Already-cached images are untouched. To force-rewrite cached oversized images, also clear the cache (`npx mgr clean`) or delete the `cache-uj-imagemin` branch entries for the relevant files.
- 4096px is a hardcoded cap (`MAX_SOURCE_DIMENSION` in `src/gulp/tasks/imagemin.js`). Not currently configurable per project — open a PR if you need this.
