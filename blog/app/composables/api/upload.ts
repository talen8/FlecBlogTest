import { createApi } from './createApi';

interface UploadApiResponse {
  original_name: string;
  file_url: string;
}

const uploadApi = createApi<UploadApiResponse>('/upload');

/** 上传文件 */
export async function uploadFileApi(formData: FormData): Promise<UploadApiResponse> {
  return uploadApi.post<UploadApiResponse>('', formData);
}
