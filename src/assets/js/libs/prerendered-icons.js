/**
 * Prerendered Icons Library
 * Retrieves pre-rendered icon HTML from the frontmatter icon system
 */

/**
 * Get pre-rendered icon by name from frontmatter icon system
 * @param {string} iconName - Name of the icon to retrieve (matches data-icon attribute)
 * @returns {string} Icon HTML or empty string if not found
 *
 * @example
 * import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
 *
 * // Get an icon
 * const appleIcon = getPrerenderedIcon('apple');
 */
export function getPrerenderedIcon(iconName) {
  // Query the global prerendered icons container
  const $iconTemplate = document.querySelector(`#prerendered-icons [data-icon="${iconName}"]`);

  if ($iconTemplate) {
    return $iconTemplate.innerHTML;
  }

  // Return empty string if not found
  return '';
}