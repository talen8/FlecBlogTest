export interface EmojiItem {
  key: string;
  val: string;
}

export interface EmojiGroup {
  name: string;
  type: 'emoji' | 'image' | 'emoticon';
  items: EmojiItem[];
}
