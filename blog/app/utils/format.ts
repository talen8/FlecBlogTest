/** 数字缩写：≥1万显示 w，≥1千显示 k */
export function formatWords(words: string): string {
  const n = +words;
  if (n >= 1e4) return (n / 1e4).toFixed(1) + 'w';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return words;
}

const ROLE_NAMES: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  user: '普通用户',
};

/** 用户角色显示名称 */
export function getRoleName(role: string): string {
  return ROLE_NAMES[role] || role;
}

const PROVIDER_NAMES: Record<string, string> = {
  github: 'GitHub',
  google: 'Google',
  qq: 'QQ',
  microsoft: 'Microsoft',
  oidc: 'OIDC',
};

/** OAuth 提供商显示名称 */
export function getProviderName(provider: string): string {
  return PROVIDER_NAMES[provider] || provider;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  resolved: '已解决',
  closed: '已关闭',
};

/** 反馈状态显示标签 */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}
