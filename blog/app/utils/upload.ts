import { uploadFileApi } from '@/composables/api/upload';
import type { UploadResponse } from '@@/types/upload';

export function getMaxFileSizeMB(): number {
  try {
    const { uploadConfig } = useSysConfig();
    const configValue = uploadConfig.value['max_file_size'] || '5';
    const parsed = parseInt(configValue, 10);
    return isNaN(parsed) || parsed <= 0 ? 5 : parsed;
  } catch {
    return 5;
  }
}

export function validateFile(file: File, allowedTypes?: string[]): string | null {
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    return `不支持的文件类型`;
  }

  const maxSizeMB = getMaxFileSizeMB();
  const maxSize = maxSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    return `文件大小不能超过 ${maxSizeMB}MB`;
  }

  return null;
}

export async function uploadFiles(
  files: File[],
  type: string,
  allowedTypes?: string[]
): Promise<string[]> {
  if (files.length === 0) return [];
  const results = await Promise.all(files.map(file => uploadFile(file, type, allowedTypes)));
  return results.map(r => r.file_url);
}

export async function uploadFile(
  file: File,
  type: string,
  allowedTypes?: string[]
): Promise<UploadResponse> {
  const validationError = validateFile(file, allowedTypes);
  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  return uploadFileApi(formData).catch((error: unknown) => {
    const err = error as { data?: { message?: string }; message?: string };
    throw new Error(err?.data?.message || err?.message || '文件上传失败');
  });
}
