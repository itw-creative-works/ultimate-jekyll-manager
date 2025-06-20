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
        textNodes.push({
          node,
          type: 'text',
          attr: null,
          text,
          tagged: `[${i}]${text}[/${i}]`,
          line: el.startIndex || 0, // Add line information
          column: 0 // Column is not directly available, default to 0
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
          textNodes.push({
            node,
            type: 'attr',
            attr: 'content',
            text,
            tagged: `[${i}]${text}[/${i}]`,
            line: el.startIndex || 0, // Add line information
            column: 0 // Column is not directly available, default to 0
          });
        }
      }
      return;
    }

    // Handle regular DOM text nodes
    node.contents().each((_, child) => {
      if (child.type === 'text' && child.data?.trim()) {
        const i = textNodes.length;
        const text = child.data
          .replace(/^\s+/, '')
          .replace(/\s+$/, '')
          .replace(/\s+/g, ' ');

        textNodes.push({
          node,
          type: 'data',
          attr: null,
          reference: child,
          text,
          tagged: `[${i}]${text}[/${i}]`,
          line: el.startIndex || 0, // Add line information
          column: 0 // Column is not directly available, default to 0
        });
      }
    });
  });

  return textNodes;
};

module.exports = collectTextNodes;
