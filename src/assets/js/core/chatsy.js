// Module
module.exports = (Manager, options) => {
  // Shortcuts
  const { webManager } = Manager;

  // Get auth policy
  const chatsy = webManager.config.chatsy;

  // Quit if chatsy is not enabled
  if (!chatsy?.enabled) {
    console.warn('Chatsy is not enabled in the configuration.');
    return;
  }

  // Listen for dom ready
  webManager.dom().ready()
  .then(async () => {
    const scriptUrl = `https://app.chatsy.ai/resources/script.js`;

    await webManager.dom().loadScript({
      src: scriptUrl,
      async: true,
      defer: true,
      timeout: 30000,
      retries: 2,
      crossorigin: 'anonymous',
      attributes: [
        { name: 'data-account-id', value: chatsy.config.accountId },
        { name: 'data-chat-id', value: chatsy.config.chatId },
        { name: 'data-settings', value: JSON.stringify(chatsy.config.settings) },
      ]
    });
  })
}
