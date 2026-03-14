/**
 * Calendar Events
 * Event CRUD via FormManager, modal management, and color swatch handling.
 */

import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';

export default class CalendarEvents {
  constructor(core, webManager) {
    this.core = core;
    this.webManager = webManager;
    this.editingEventId = null;
    this.formManager = null;
    this.$modal = null;

    this._init();
  }

  // ============================================
  // Initialization
  // ============================================
  _init() {
    this._initModal();
    this._initForm();
    this._initColorSwatches();
    this._initDeleteButton();
  }

  _initModal() {
    this.$modal = document.getElementById('calendar-event-modal');

    // Reset form when modal closes
    this.$modal.addEventListener('hidden.bs.modal', () => {
      this.editingEventId = null;
      this.formManager.reset();
      this._setColor('#4CAF50');
      this._toggleDeleteButton(false);
      document.getElementById('event-modal-title-text').textContent = 'Create Event';
    });
  }

  _getModal() {
    return bootstrap.Modal.getOrCreateInstance(this.$modal);
  }

  _initForm() {
    this.formManager = new FormManager('#calendar-event-form', {
      autoReady: true,
      allowResubmit: true,
    });

    this.formManager.on('submit', ({ data }) => {
      const eventData = this._extractEventData(data);

      if (this.editingEventId) {
        this.core.updateEvent(this.editingEventId, eventData);
      } else {
        this.core.addEvent(eventData);
      }

      this._getModal().hide();
    });
  }

  _initColorSwatches() {
    document.getElementById('color-swatches').addEventListener('click', (e) => {
      const $swatch = e.target.closest('.color-swatch');
      if (!$swatch) {
        return;
      }

      this._setColor($swatch.dataset.color);
    });
  }

  _initDeleteButton() {
    document.getElementById('btn-delete-event').addEventListener('click', () => {
      if (!this.editingEventId) {
        return;
      }

      this.core.removeEvent(this.editingEventId);
      this._getModal().hide();
    });
  }

  // ============================================
  // Modal Operations
  // ============================================
  openCreateModal(date, time) {
    this.editingEventId = null;
    this.formManager.reset();
    this._toggleDeleteButton(false);
    document.getElementById('event-modal-title-text').textContent = 'Create Event';

    // Pre-fill date and time
    document.getElementById('event-date').value = date || '';
    document.getElementById('event-time').value = time || '09:00';
    document.getElementById('event-duration').value = '60';

    // Reset type to newsletter
    document.getElementById('event-type-newsletter').checked = true;

    // Reset audience
    document.getElementById('audience-all').checked = true;

    // Reset channels
    document.getElementById('channel-push').checked = true;
    document.getElementById('channel-email').checked = false;
    document.getElementById('channel-sms').checked = false;
    document.getElementById('channel-inapp').checked = false;

    // Reset status
    document.getElementById('event-status').value = 'draft';

    // Reset color
    this._setColor('#4CAF50');

    this._getModal().show();
  }

  openEditModal(eventId) {
    const event = this.core.getEvent(eventId);
    if (!event) {
      return;
    }

    this.editingEventId = eventId;
    this._toggleDeleteButton(true);
    document.getElementById('event-modal-title-text').textContent = 'Edit Event';

    // Populate form fields
    document.getElementById('event-title').value = event.title || '';
    document.getElementById('event-body').value = (event.data && event.data.body) || '';
    document.getElementById('event-date').value = event.date || '';
    document.getElementById('event-time').value = event.time || '09:00';
    document.getElementById('event-duration').value = event.duration || 60;

    // Type
    const typeRadio = document.getElementById(`event-type-${event.type}`);
    if (typeRadio) {
      typeRadio.checked = true;
    }

    // Audience
    const audienceType = (event.data && event.data.audience && event.data.audience.type) || 'all';
    const audienceRadio = document.getElementById(`audience-${audienceType}`);
    if (audienceRadio) {
      audienceRadio.checked = true;
    }

    // Channels
    const channels = (event.data && event.data.channels) || {};
    document.getElementById('channel-push').checked = !!channels.push;
    document.getElementById('channel-email').checked = !!channels.email;
    document.getElementById('channel-sms').checked = !!channels.sms;
    document.getElementById('channel-inapp').checked = !!channels.inapp;

    // Status
    document.getElementById('event-status').value = event.status || 'draft';

    // Color
    this._setColor(event.color || '#4CAF50');

    this._getModal().show();
  }

  // ============================================
  // Data Extraction
  // ============================================
  _extractEventData(data) {
    const event = data.event || {};
    const eventData = event.data || {};

    return {
      title: event.title || 'Untitled',
      type: event.type || 'newsletter',
      date: event.date || '',
      time: event.time || '09:00',
      duration: parseInt(event.duration, 10) || 60,
      status: event.status || 'draft',
      color: event.color || '#4CAF50',
      data: {
        body: eventData.body || '',
        audience: {
          type: (eventData.audience && eventData.audience.type) || 'all',
        },
        channels: {
          push: !!(eventData.channels && eventData.channels.push),
          email: !!(eventData.channels && eventData.channels.email),
          sms: !!(eventData.channels && eventData.channels.sms),
          inapp: !!(eventData.channels && eventData.channels.inapp),
        },
      },
    };
  }

  // ============================================
  // UI Helpers
  // ============================================
  _setColor(color) {
    document.getElementById('event-color').value = color;

    document.querySelectorAll('.color-swatch').forEach(($swatch) => {
      $swatch.classList.toggle('active', $swatch.dataset.color === color);
    });
  }

  _toggleDeleteButton(show) {
    document.getElementById('btn-delete-event').classList.toggle('d-none', !show);
  }
}
