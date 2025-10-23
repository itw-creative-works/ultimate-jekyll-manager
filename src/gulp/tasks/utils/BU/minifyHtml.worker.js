// Worker thread for HTML minification
const { parentPort, workerData } = require('worker_threads');
const { minify } = require('html-minifier-terser');

// Listen for messages from parent
parentPort.on('message', async (data) => {
  const { htmlContent, options, index } = data;

  try {
    // Extract and temporarily replace JSON-LD scripts
    const jsonLdScripts = [];
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    let processedContent = htmlContent.replace(jsonLdRegex, (match, jsonContent) => {
      // Minify the JSON content
      try {
        const parsed = JSON.parse(jsonContent);
        const minifiedJson = JSON.stringify(parsed);
        jsonLdScripts.push(minifiedJson);
      } catch (e) {
        jsonLdScripts.push(jsonContent);
      }
      return `__JSON_LD_PLACEHOLDER_${jsonLdScripts.length - 1}__`;
    });

    // Extract and temporarily replace IE conditional comments
    const conditionalComments = [];
    const conditionalRegex = /<!--\[if[^>]*\]>([\s\S]*?)<!\[endif\]-->/gi;

    processedContent = processedContent.replace(conditionalRegex, (match, content) => {
      // Minify the content inside the conditional comment
      try {
        const minifiedContent = content
          .replace(/\s+/g, ' ')
          .replace(/>\s+</g, '><')
          .trim();
        conditionalComments.push(match.replace(content, minifiedContent));
      } catch (e) {
        conditionalComments.push(match);
      }
      return `__CONDITIONAL_COMMENT_PLACEHOLDER_${conditionalComments.length - 1}__`;
    });

    // Minify the HTML content
    const minified = await minify(processedContent, options);

    // Restore the JSON-LD scripts and conditional comments
    let finalHtml = minified;
    jsonLdScripts.forEach((jsonContent, idx) => {
      const scriptTag = `<script type=application/ld+json>${jsonContent}</script>`;
      finalHtml = finalHtml.replace(`__JSON_LD_PLACEHOLDER_${idx}__`, scriptTag);
    });

    conditionalComments.forEach((commentContent, idx) => {
      finalHtml = finalHtml.replace(`__CONDITIONAL_COMMENT_PLACEHOLDER_${idx}__`, commentContent);
    });

    // Send result back to parent
    parentPort.postMessage({
      success: true,
      index,
      result: finalHtml
    });
  } catch (err) {
    // Send error back to parent
    parentPort.postMessage({
      success: false,
      index,
      error: err.message
    });
  }
});
