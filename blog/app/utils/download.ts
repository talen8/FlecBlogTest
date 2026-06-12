/** 通过 fetch 下载远程文件并触发浏览器保存 */
export async function downloadFile(url: string, filename?: string): Promise<void> {
  const blob = await fetch(url).then(r => r.blob());
  const name = filename || url.split('/').pop() || 'download';
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: name,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}
