import {
  submitFeedback as submitFeedbackApi,
  getFeedbackByTicketNo as getFeedbackApi,
} from '@/composables/api/feedback';
import type { SubmitFeedbackParams, Feedback } from '@@/types/feedback';

export function useFeedback() {
  const loading = ref(false);
  const error = ref<Error | null>(null);

  async function submitFeedback(params: SubmitFeedbackParams): Promise<Feedback> {
    loading.value = true;
    error.value = null;
    try {
      return await submitFeedbackApi(params);
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function getFeedbackByTicketNo(ticketNo: string): Promise<Feedback> {
    loading.value = true;
    error.value = null;
    try {
      return await getFeedbackApi(ticketNo);
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return { submitFeedback, getFeedbackByTicketNo, loading, error };
}
