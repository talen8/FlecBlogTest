import type { Comment, CommentTargetType, FlatComment, GuestInfo } from '@@/types/comment';

export function flattenComments(commentList: Comment[], depth = 0): FlatComment[] {
  const result: FlatComment[] = [];

  commentList.forEach(comment => {
    result.push({ comment, depth });
    if (comment.replies && comment.replies.length > 0) {
      result.push(...flattenComments(comment.replies, depth + 1));
    }
  });

  return result;
}

/** 将扁平评论列表按顶级评论分组 */
export function groupFlatComments(
  flatComments: FlatComment[]
): Array<{ parent: FlatComment; replies: FlatComment[] }> {
  const groups: Array<{ parent: FlatComment; replies: FlatComment[] }> = [];
  let currentGroup: { parent: FlatComment; replies: FlatComment[] } | null = null;

  flatComments.forEach(item => {
    if (item.depth === 0) {
      currentGroup = { parent: item, replies: [] };
      groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.replies.push(item);
    }
  });

  return groups;
}

/** 递归计算嵌套评论总数（含回复） */
export function countComments(list: Comment[]): number {
  return list.reduce(
    (total, c) => total + 1 + (c.replies?.length ? countComments(c.replies) : 0),
    0
  );
}

export interface CommentContext {
  targetType: Ref<CommentTargetType>;
  targetKey: Ref<string | number>;
  addComment: (content: string, guestInfo?: GuestInfo) => Promise<void>;
  addReply: (commentId: number, content: string, guestInfo?: GuestInfo) => Promise<void>;
  deleteComment: (commentId: number) => Promise<void>;
  showLogin: () => void;
  replyState: {
    replyingToId: Ref<number | null>;
    replyingToNickname: Ref<string>;
    startReply: (commentId: number, nickname: string) => void;
    cancelReply: () => void;
  };
}

const CommentContextKey: InjectionKey<CommentContext> = Symbol('CommentContext');

export function provideCommentContext(context: CommentContext) {
  provide(CommentContextKey, context);
}

export function useCommentContext() {
  const context = inject(CommentContextKey);
  if (!context) {
    throw new Error('useCommentContext must be used within a comment provider');
  }
  return context;
}

export async function fillComment(content: string) {
  const wrapper = document.querySelector('.comment-input');
  const textarea = wrapper?.querySelector('textarea') as HTMLTextAreaElement | null;

  if (!wrapper || !textarea) return;

  textarea.value = content;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  await new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  scrollToElement('.comment-input');
  textarea.focus();
}

// ============================================================
// 评论本地存储
// ============================================================

const GUEST_INFO_KEY = 'guest_info';
const COMMENT_DRAFT_KEY = 'comment_draft';

/** 加载游客信息（客户端） */
export function loadGuestInfo(): GuestInfo {
  if (import.meta.server) return { nickname: '', email: '', website: '' };
  try {
    const stored = localStorage.getItem(GUEST_INFO_KEY);
    if (stored) {
      const saved = JSON.parse(stored);
      return {
        nickname: saved.nickname || '',
        email: saved.email || '',
        website: saved.website || '',
      };
    }
  } catch {
    // localStorage 数据可能损坏，回退到默认值
  }
  return { nickname: '', email: '', website: '' };
}

/** 保存游客信息（客户端） */
export function saveGuestInfo(info: GuestInfo): void {
  if (import.meta.client) {
    localStorage.setItem(GUEST_INFO_KEY, JSON.stringify(info));
  }
}

/** 加载评论草稿（客户端） */
export function loadCommentDraft(): string {
  if (import.meta.server) return '';
  return localStorage.getItem(COMMENT_DRAFT_KEY) || '';
}

/** 保存评论草稿（客户端） */
export function saveCommentDraft(content: string): void {
  if (!import.meta.client) return;
  if (content) {
    localStorage.setItem(COMMENT_DRAFT_KEY, content);
  } else {
    localStorage.removeItem(COMMENT_DRAFT_KEY);
  }
}

/** 清除评论草稿（客户端） */
export function clearCommentDraft(): void {
  if (import.meta.client) {
    localStorage.removeItem(COMMENT_DRAFT_KEY);
  }
}
