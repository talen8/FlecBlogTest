interface TagData {
  tag: string;
  innerHTML?: string;
  [key: string]: string | undefined;
}

interface HeadPayload {
  meta: Record<string, string>[];
  link: Record<string, string>[];
  script: (Record<string, string> & { innerHTML?: string })[];
  style: (Record<string, string> & { innerHTML?: string })[];
}

export default defineNuxtPlugin({
  name: 'custom-code',
  setup() {
    const { basicConfig } = useSysConfig();

    const parseHtmlTags = (html: string): TagData[] => {
      if (!html) return [];

      const tags: TagData[] = [];
      const tagRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>|<(\w+)([^>]*)\s*\/>/gi;
      let match;

      while ((match = tagRegex.exec(html)) !== null) {
        const tagName = match[1] || match[4];
        if (!tagName) continue;

        const attrsStr = match[2] || match[5];
        const innerHTML = match[3];

        const tagData: TagData = { tag: tagName.toLowerCase() };

        if (attrsStr) {
          const attrRegex = /(\S+)=["']([^"']*)["']/g;
          let attrMatch: RegExpExecArray | null;
          while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
            tagData[attrMatch[1]!] = attrMatch[2];
          }
        }

        if (innerHTML) {
          tagData.innerHTML = innerHTML;
        }

        tags.push(tagData);
      }

      return tags;
    };

    const buildHeadPayload = (headCode: string): HeadPayload | null => {
      if (!headCode) return null;

      const tags = parseHtmlTags(headCode);
      const headPayload: HeadPayload = {
        meta: [],
        link: [],
        script: [],
        style: [],
      };

      tags.forEach(tag => {
        const { tag: tagName, innerHTML, ...attrs } = tag;

        const filteredAttrs = Object.fromEntries(
          Object.entries(attrs).filter(([, v]) => v !== undefined)
        ) as Record<string, string>;

        switch (tagName) {
          case 'meta':
            headPayload.meta.push(filteredAttrs);
            break;
          case 'link':
            headPayload.link.push(filteredAttrs);
            break;
          case 'script':
            headPayload.script.push(innerHTML ? { ...filteredAttrs, innerHTML } : filteredAttrs);
            break;
          case 'style':
            headPayload.style.push(innerHTML ? { ...filteredAttrs, innerHTML } : filteredAttrs);
            break;
        }
      });

      return headPayload;
    };

    useHead(
      computed(() => {
        const customHead = buildHeadPayload(String(basicConfig.value.custom_head || ''));

        return {
          meta: customHead?.meta || [],
          link: customHead?.link || [],
          script: customHead?.script || [],
          style: customHead?.style || [],
        };
      })
    );

    const injectBodyCode = () => {
      const bodyCode = String(basicConfig.value.custom_body || '');

      if (bodyCode && import.meta.client) {
        const oldContainer = document.getElementById('custom-body-inject');
        if (oldContainer) {
          oldContainer.remove();
        }

        const container = document.createElement('div');
        container.id = 'custom-body-inject';
        container.innerHTML = bodyCode;
        document.body.prepend(container);
      }
    };

    watch(basicConfig, injectBodyCode, { immediate: true });
  },
});
