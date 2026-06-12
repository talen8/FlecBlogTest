import type { MusicTrack } from '@@/types/moment';

interface MusicApiResponse {
  name?: string;
  title?: string;
  artist?: string;
  author?: string;
  url: string;
  pic?: string;
  cover?: string;
  lrc?: string;
}

/** 从 Meting API 获取音乐数据 */
export async function fetchMetingMusic(
  apiUrl: string,
  params: { server: string; type: string; id: string }
): Promise<MusicTrack[]> {
  const response = await $fetch<MusicApiResponse[] | MusicApiResponse>(
    `${apiUrl}?server=${params.server}&type=${params.type}&id=${params.id}`
  );
  const list = Array.isArray(response) ? response : [response];
  return list.map(item => ({
    name: item.name || item.title || '未知歌曲',
    artist: item.artist || item.author || '未知艺术家',
    url: item.url,
    cover: item.pic || item.cover || '',
    lrc: item.lrc || '',
  }));
}

/** 获取歌词文本 */
export async function fetchLyricsText(lrcUrl: string): Promise<string> {
  try {
    return await $fetch<string>(lrcUrl, { responseType: 'text' });
  } catch {
    return '';
  }
}
