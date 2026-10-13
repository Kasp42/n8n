import { parseRetryAfterMs } from '@langchain/core/utils/async_caller';

const STATUS_NO_RETRY = [
	400, // Bad Request
	401, // Unauthorized
	402, // Payment Required
	403, // Forbidden
	404, // Not Found
	405, // Method Not Allowed
	406, // Not Acceptable
	407, // Proxy Authentication Required
	409, // Conflict
	413, // Payload Too Large
];

const RETRY_AFTER_MAX_MS = 60_000; // mirrors @langchain/core RETRY_AFTER_AUTO_RETRY_THRESHOLD_MS

/**
 * This function is used as a default handler for failed attempts in all LLMs.
 * It is based on a default handler from the langchain core package.
 * It throws an error when it encounters a known error that should not be retried.
 * The handler does not retry a 429 with the `insufficient_quota` code, or one with a Retry-After over 60 s.
 * It retries other 429s. It copies a Retry-After of up to 60 s to `retryAfterMs`, so the retry loop waits that long.
 * The total wait is at most Max Retries x 60 s.
 * @param error
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const n8nDefaultFailedAttemptHandler = (error: any) => {
	if (
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
		error?.message?.startsWith?.('Cancel') ||
		error?.message?.startsWith?.('AbortError') ||
		error?.name === 'AbortError'
	) {
		throw error;
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (error?.code === 'ECONNABORTED') {
		throw error;
	}

	const status =
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		error?.response?.status ?? error?.status;
	if (status && STATUS_NO_RETRY.includes(+status)) {
		throw error;
	}

	if (+status === 429) {
		if ((error?.code ?? error?.error?.code) === 'insufficient_quota') {
			throw error;
		}
		const retryAfterMs = parseRetryAfterMs(error?.headers?.get?.('retry-after'));
		if (retryAfterMs !== undefined) {
			if (retryAfterMs > RETRY_AFTER_MAX_MS) throw error;
			Object.assign(error, { retryAfterMs });
		}
	}
};
