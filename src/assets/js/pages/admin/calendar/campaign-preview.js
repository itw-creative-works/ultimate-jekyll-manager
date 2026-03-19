/**
 * Campaign Preview
 * Renders email (markdown) and push (mobile frame) previews
 * for the campaign editor modal.
 */

import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
import { escapeHtml } from '__main_assets__/js/libs/admin-helpers.js';

// Lazy-loaded markdown-it instance
let md = null;

/**
 * Render email campaign preview HTML.
 * Lazy-loads markdown-it on first call.
 */
async function renderEmailPreview(formData) {
  const campaign = formData.campaign || {};
  const subject = campaign.subject || '';
  const preheader = campaign.preheader || '';
  const content = campaign.content || '';

  // Lazy-load markdown-it
  if (!md) {
    const MarkdownIt = (await import('markdown-it')).default;
    md = new MarkdownIt({ html: true, breaks: true, linkify: true });
  }

  const renderedContent = content ? md.render(content) : '<p class="text-muted">No content yet</p>';

  return `
    <div class="email-preview">
      <div class="email-preview-header">
        <div class="email-preview-subject">${escapeHtml(subject) || '<span class="text-muted">No subject</span>'}</div>
        ${preheader ? `<div class="email-preview-preheader">${escapeHtml(preheader)}</div>` : ''}
      </div>
      <div class="email-preview-body">${renderedContent}</div>
      <div class="email-preview-disclaimer text-muted small mt-3">
        ${getPrerenderedIcon('triangle-exclamation', 'fa-xs me-1')}
        Preview shows formatted content. Final email may vary by template.
      </div>
    </div>
  `;
}

/**
 * Render push notification preview HTML (mobile device frame).
 */
function renderPushPreview(formData) {
  const campaign = formData.campaign || {};
  const name = campaign.name || 'Notification Title';
  const subject = campaign.subject || 'Notification body text...';
  const icon = campaign.icon || '';

  const iconSrc = icon && icon.match(/^https?:\/\/.+/)
    ? escapeHtml(icon)
    : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50"%3E%3Crect width="50" height="50" fill="%236c757d" rx="8"/%3E%3C/svg%3E';

  const clickAction = campaign.clickAction || '';

  return `
    <div class="push-preview-frame">
      <div class="push-preview-screen">
        <div class="push-preview-status-bar">
          <span>9:41 AM</span>
          <span>
            ${getPrerenderedIcon('wifi', 'fa-sm me-1')}
            ${getPrerenderedIcon('battery-full', 'fa-sm')}
          </span>
        </div>
        <div class="push-preview-notification"
             ${clickAction ? `role="button" title="Click to test: ${escapeHtml(clickAction)}"` : ''}
             data-click-action="${escapeHtml(clickAction)}">
          <div class="d-flex align-items-start">
            <img src="${iconSrc}"
                 class="rounded me-2"
                 width="50"
                 height="50"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Crect width=%2250%22 height=%2250%22 fill=%22%236c757d%22 rx=%228%22/%3E%3C/svg%3E'">
            <div class="flex-fill">
              <div class="fw-semibold small">${escapeHtml(name)}</div>
              <div class="small text-muted mt-1">${escapeHtml(subject)}</div>
              <div class="small text-muted mt-1">
                ${getPrerenderedIcon('clock', 'fa-xs me-1')}
                Now
              </div>
            </div>
          </div>
        </div>
        <div class="mt-2 opacity-50">
          <div class="bg-body-secondary rounded p-2 small">
            <div class="text-muted">Earlier notifications...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export { renderEmailPreview, renderPushPreview };
