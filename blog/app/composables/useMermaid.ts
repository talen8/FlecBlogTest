import mermaid from 'mermaid';

let initialized = false;

export function useMermaid() {
  const init = () => {
    if (initialized) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });
    initialized = true;
  };

  const renderDiagrams = async () => {
    const elements = document.querySelectorAll('.mermaid:not(:has(svg))');

    for (const element of elements) {
      try {
        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, element.textContent || '');
        element.innerHTML = svg;
      } catch (error) {
        console.error('Mermaid 渲染失败:', error);
      }
    }
  };

  return { init, renderDiagrams };
}
