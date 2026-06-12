/** 目录项 */
export interface TocItem {
  id: string;
  level: number;
  text: string;
  children?: TocItem[];
}
