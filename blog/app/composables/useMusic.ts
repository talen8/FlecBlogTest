import type { MusicTrack, LyricLine } from '@@/types/moment';
import { fetchMetingMusic, fetchLyricsText } from '@/composables/api/music';

export function useMusic() {
  const fetchTracks = async (
    apiUrl: string,
    params: { server: string; type: string; id: string }
  ): Promise<MusicTrack[]> => {
    return fetchMetingMusic(apiUrl, params);
  };

  const fetchLyrics = async (lrcUrl: string): Promise<string> => {
    return fetchLyricsText(lrcUrl);
  };

  const parseLyrics = (lrcText: string): LyricLine[] => {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const lyricLines: LyricLine[] = [];

    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
      if (match && match[1] && match[2] && match[4]) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
        const text = match[4].trim();
        if (text) {
          lyricLines.push({ time: minutes * 60 + seconds + milliseconds / 1000, text });
        }
      }
    }
    return lyricLines.sort((a, b) => a.time - b.time);
  };

  return { fetchTracks, fetchLyrics, parseLyrics };
}
