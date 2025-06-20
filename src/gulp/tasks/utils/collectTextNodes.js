const collectTextNodes = ($, options) => {
  const textNodes = [];

  // Fix options
  options = options || {};

  $('*').each((_, el) => {
    const node = $(el);

    // Skip scripts and style tags
    if (
      node.is('script')
      || node.is('style')
      || node.is('noscript') // @TODO: This is not foolproof because there can be text inside <noscript> tags
    ) {
      return;
    }

    // Handle <title>
    if (node.is('title')) {
      const i = textNodes.length;
      const text = node.text().trim();
      if (text) {

        // Push
        textNodes.push({
          node,
          type: 'text',
          attr: null,
          text,
          tagged: `[${i}]${text}[/${i}]`,
        });
      }
      return;
    }

    // Handle meta tags with translatable content
    if (node.is('meta')) {
      const metaSelectors = [
        'description',
        'og:title',
        'og:description',
        'twitter:title',
        'twitter:description'
      ];
      const name = node.attr('name');
      const property = node.attr('property');

      const key = name || property;
      if (metaSelectors.includes(key)) {
        const text = node.attr('content')?.trim();
        if (text) {
          const i = textNodes.length;

          // Push
          textNodes.push({
            node,
            type: 'attr',
            attr: 'content',
            text,
            tagged: `[${i}]${text}[/${i}]`,
          });
        }
      }
      return;
    }

    // Handle attributes like title and placeholder
    const translatableAttributes = ['title', 'placeholder', 'alt', 'aria-label', 'aria-placeholder', 'aria-describedby', 'aria-labelledby', 'value', 'label'];
    translatableAttributes.forEach(attr => {
      const text = node.attr(attr)?.trim();
      if (text) {
        const i = textNodes.length;

        // Push
        textNodes.push({
          node,
          type: 'attr',
          attr,
          text,
          tagged: `[${i}]${text}[/${i}]`,
        });
      }
    });

    // Handle regular DOM text nodes
    node.contents().each((_, child) => {
      if (child.type === 'text' && child.data?.trim()) {
        const i = textNodes.length;
        const text = child.data
          // Preserve a single leading whitespace if it exists
          .replace(/^\s*(\s)\s*/, '$1')
          // Preserve a single trailing whitespace if it exists
          .replace(/\s*(\s)\s*$/, '$1')
          // Normalize internal whitespace
          .replace(/\s+/g, ' ');

        // Push
        textNodes.push({
          node,
          type: 'data',
          attr: null,
          reference: child,
          text,
          tagged: `[${i}]${text}[/${i}]`,
        });
      }
    });
  });

  return textNodes;
};

module.exports = collectTextNodes;


function trimPreserveOneCleanInner(str) {
  const match = str.match(/^(\s*)(.*?)(\s*)$/);
  const leading = match[1] ? match[1][0] || '' : '';
  const content = match[2].replace(/\s+/g, ' ');
  const trailing = match[3] ? match[3][0] || '' : '';
  return leading + content + trailing;
}
