// utils/sanitizeHtml.ts
// Centralized HTML sanitization for rich-text content (announcements, etc.).
// Used on BOTH save (defense-in-depth) and render (primary defense).

import DOMPurify from 'dompurify';

// Allowlist for announcement content. Intentionally strict.
// No <img>, <script>, <iframe>, <style>, no inline event handlers, no data:/javascript: URIs.
const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'pre', 'code',
  'a',
];

// Quill emits classes like ql-align-center, ql-indent-1, ql-syntax for alignment / indent / code blocks.
// We allow `class` but the hook below restricts to a known prefix set so admins can't inject arbitrary CSS classes.
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];

// Quill inline color/background come through as inline style. Allow only safe color properties.
const ALLOWED_STYLE_PROPS = ['color', 'background-color', 'text-align'];

const ALLOWED_CLASS_PREFIXES = ['ql-align-', 'ql-indent-', 'ql-syntax', 'ql-code-block'];

// Configure DOMPurify hooks once.
let configured = false;
const configureOnce = () => {
  if (configured) return;
  configured = true;

  // Force every link to open safely.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      const a = node as HTMLAnchorElement;
      const href = a.getAttribute('href') || '';
      // Block javascript:, data:, vbscript:, file: URIs.
      if (/^\s*(javascript|data|vbscript|file):/i.test(href)) {
        a.removeAttribute('href');
      } else {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // Filter `class` attribute to known Quill prefixes only.
    if (node.hasAttribute && node.hasAttribute('class')) {
      const classes = (node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      const safe = classes.filter((c) =>
        ALLOWED_CLASS_PREFIXES.some((p) => (p.endsWith('-') ? c.startsWith(p) : c === p))
      );
      if (safe.length > 0) {
        node.setAttribute('class', safe.join(' '));
      } else {
        node.removeAttribute('class');
      }
    }

    // Filter `style` attribute to a tiny allowlist of properties.
    if (node.hasAttribute && node.hasAttribute('style')) {
      const styleStr = node.getAttribute('style') || '';
      const safeDecls: string[] = [];
      styleStr.split(';').forEach((decl) => {
        const [propRaw, ...valParts] = decl.split(':');
        if (!propRaw || valParts.length === 0) return;
        const prop = propRaw.trim().toLowerCase();
        const val = valParts.join(':').trim();
        if (!ALLOWED_STYLE_PROPS.includes(prop)) return;
        // Block url(), expression(), and any non-printable nasties.
        if (/url\s*\(|expression\s*\(|javascript:/i.test(val)) return;
        // Hard cap value length.
        if (val.length > 80) return;
        safeDecls.push(`${prop}: ${val}`);
      });
      if (safeDecls.length > 0) {
        node.setAttribute('style', safeDecls.join('; '));
      } else {
        node.removeAttribute('style');
      }
    }
  });
};

/**
 * Sanitize rich-text HTML for safe storage and rendering.
 */
export const sanitizeRichText = (html: string): string => {
  if (!html) return '';
  configureOnce();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'img'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'srcset', 'src'],
  });
};

/**
 * Decide if content is legacy plain text (no HTML tags).
 * Old announcements are stored as raw text with newlines.
 */
export const isLikelyPlainText = (content: string): boolean => {
  if (!content) return true;
  // No angle brackets at all => plain text.
  return !/<[a-z][\s\S]*>/i.test(content);
};

/**
 * Render-ready HTML for an announcement.
 * - If legacy plain text: escape and convert newlines to <br>.
 * - Otherwise: sanitize the rich-text HTML.
 */
export const renderAnnouncementHtml = (content: string): string => {
  if (!content) return '';
  if (isLikelyPlainText(content)) {
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    return escaped.replace(/\n/g, '<br/>');
  }
  return sanitizeRichText(content);
};

/**
 * Strip HTML to plain text (for previews, search, length checks).
 */
export const htmlToPlainText = (html: string): string => {
  if (!html) return '';
  const clean = sanitizeRichText(html);
  const tmp = document.createElement('div');
  tmp.innerHTML = clean;
  return (tmp.textContent || tmp.innerText || '').trim();
};
