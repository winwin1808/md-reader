export function parseRawHtmlToHast(html: string): any[] {
  const root = { type: 'root', children: [] as any[] };
  const stack: any[] = [root];
  
  const tagRegex = /<\/?([a-zA-Z0-9\-]+)((?:\s+[a-zA-Z0-9_:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
  let lastIndex = 0;
  let match;
  
  while ((match = tagRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const text = html.substring(lastIndex, match.index);
      if (text) {
        stack[stack.length - 1].children.push({ type: 'text', value: text });
      }
    }
    
    const isClosing = match[0].startsWith('</');
    const tagName = (match[1] || '').toLowerCase();
    const attrsStr = match[2] || '';
    const isSelfClosing = match[3] === '/' || ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tagName);
    
    if (isClosing) {
      let i = stack.length - 1;
      while (i > 0 && stack[i].tagName !== tagName) i--;
      if (i > 0) {
        stack.length = i;
      }
    } else {
      const properties: Record<string, any> = {};
      const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s"'>]+)))?/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
        let attrName = attrMatch[1];
        if (!attrName) continue;
        let attrValue: any = true;
        if (attrMatch[2] !== undefined) attrValue = attrMatch[2];
        else if (attrMatch[3] !== undefined) attrValue = attrMatch[3];
        else if (attrMatch[4] !== undefined) attrValue = attrMatch[4];
        
        if (attrName === 'class') {
          attrName = 'className';
          if (typeof attrValue === 'string') {
            attrValue = attrValue.trim().split(/\s+/).filter(Boolean);
          } else {
            attrValue = [];
          }
        }
        properties[attrName] = attrValue;
      }
      
      const element = {
        type: 'element',
        tagName,
        properties,
        children: []
      };
      
      stack[stack.length - 1].children.push(element);
      
      if (!isSelfClosing) {
        stack.push(element);
      }
    }
    
    lastIndex = tagRegex.lastIndex;
  }
  
  if (lastIndex < html.length) {
    const text = html.substring(lastIndex);
    if (text) {
      stack[stack.length - 1].children.push({ type: 'text', value: text });
    }
  }
  
  return root.children;
}

export function rehypeRawPlugin() {
  return (tree: any) => {
    const traverse = (node: any, index: number | null, parent: any) => {
      if (node.type === 'raw') {
        const parsed = parseRawHtmlToHast(node.value || '');
        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1, ...parsed);
        }
      } else if (node.children && Array.isArray(node.children)) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          traverse(node.children[i], i, node);
        }
      }
    };
    
    traverse(tree, null, null);
  };
}
