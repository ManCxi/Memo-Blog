const sanitizeHtml = require('sanitize-html');

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'hr',
    'br',
    'code',
    'pre',
    'span',
    'div',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    code: ['class'],
    span: ['class', 'style'],
    div: ['class', 'style'],
    '*': ['id', 'class', 'style'],
  },
  allowedClasses: {
    '*': ['*'], // Allow all classes for styling
  },
  allowedStyles: {
    '*': {
      // Allow some basic styles that might be used by editors
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i],
      'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i],
      'text-align': [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
      'font-size': [/^\d+(?:px|em|rem|%)$/i],
    },
  },
};

const sanitize = (html) => {
  if (!html) return '';
  return sanitizeHtml(html, sanitizeOptions);
};

module.exports = { sanitize };
