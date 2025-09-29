// Chatsy Module
export default function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Get chatsy config
  const config = webManager.config.chatsy.config;

  // Listen for dom ready
  webManager.dom().ready()
  .then(async () => {
    try {
      const scriptUrl = `https://app.chatsy.ai/resources/script.js`;

      await webManager.dom().loadScript({
        src: scriptUrl,
        async: true,
        defer: true,
        timeout: 30000,
        retries: 2,
        crossorigin: 'anonymous',
        attributes: {
          'data-account-id': config.accountId,
          'data-chat-id': config.chatId,
          'data-settings': JSON.stringify(config.settings),
        }
      });

      // Track Chatsy initialization
      // gtag('event', 'chat_loaded', {
      //   chat_provider: 'chatsy'
      // });

      // chatsy.on('status', (event) => {
      //   console.log('Chatsy status changed:', event);
      // });

      // @TODO: ENABLE THIS UP LATER WHEN WE ADD THIS EVENT TO CHATSY
      // Set up event listener for chat open events
      // chatsy.on('open', (event) => {
      //   gtag('event', 'chat_opened', {
      //     chat_provider: 'chatsy'
      //   });
      //   fbq('trackCustom', 'ChatOpened', {
      //     content_name: 'Chat Widget'
      //   });
      //   ttq.track('ViewContent', {
      //     content_name: 'Chat Widget',
      //     content_type: 'support'
      //   });
      // });

      // @TODO: ENABLE THIS UP LATER WHEN WE ADD THIS EVENT TO CHATSY
      // Set up event listener for chat message events
      // chatsy.on('message:sent', (event) => {
      //   gtag('event', 'chat_message_sent', {
      //     chat_provider: 'chatsy'
      //   });
      //   fbq('track', 'Lead', {
      //     content_name: 'Chat Message Sent'
      //   });
      //   ttq.track('SubmitForm', {
      //     content_name: 'Chat Message'
      //   });
      // });
    } catch (error) {
      webManager.sentry().captureException(new Error('Failed to load Chatsy', { cause: error }));
    }
  })
}
