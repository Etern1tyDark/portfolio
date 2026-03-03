function normalizeBase(base) {
  if (!base || base === '/') return '';
  return `/${String(base).replace(/^\/+|\/+$/g, '')}`;
}

function prefixRootRelativeUrl(url, basePath) {
  if (!basePath) return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  if (url === basePath || url.startsWith(`${basePath}/`)) return url;
  return `${basePath}${url}`;
}

export default function rehypePrefixBase(options = {}) {
  const basePath = normalizeBase(options.base ?? '/');
  const targetAttributes = new Set(['href', 'src']);

  function rewriteProperties(properties) {
    for (const attr of targetAttributes) {
      const value = properties?.[attr];
      if (typeof value === 'string') {
        properties[attr] = prefixRootRelativeUrl(value, basePath);
      }
    }
  }

  function rewriteMdxAttributes(attributes) {
    if (!Array.isArray(attributes)) return;

    for (const attribute of attributes) {
      if (!attribute || attribute.type !== 'mdxJsxAttribute') continue;
      if (!targetAttributes.has(attribute.name)) continue;
      if (typeof attribute.value === 'string') {
        attribute.value = prefixRootRelativeUrl(attribute.value, basePath);
      }
    }
  }

  function rewriteRawHtml(value) {
    if (typeof value !== 'string' || !value) return value;
    return value.replace(/\b(href|src)=("([^"]*)"|'([^']*)')/g, (match, attr, wrapped, doubleQuoted, singleQuoted) => {
      const original = doubleQuoted ?? singleQuoted;
      if (typeof original !== 'string') return match;
      const rewritten = prefixRootRelativeUrl(original, basePath);
      if (rewritten === original) return match;
      const quote = doubleQuoted !== undefined ? '"' : "'";
      return `${attr}=${quote}${rewritten}${quote}`;
    });
  }

  return function transform(tree) {
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'element') {
        rewriteProperties(node.properties);
      }

      if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        rewriteMdxAttributes(node.attributes);
      }

      if (node.type === 'raw' && typeof node.value === 'string') {
        node.value = rewriteRawHtml(node.value);
      }

      if (Array.isArray(node.children)) {
        node.children.forEach(walk);
      }
    };

    walk(tree);
  };
}
