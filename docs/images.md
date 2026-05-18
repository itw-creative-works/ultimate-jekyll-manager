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
