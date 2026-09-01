import { type APIRequestContext, type APIResponse, expect } from '@playwright/test';

export interface CreatedResponse {
	id: number;
}

export interface ValidationError {
	field?: string;
	message: string;
}

export interface ApiError {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance: string;
	code: string;
	errors?: ValidationError[];
}

/**
 * 封裝後的 API 回傳結構
 */
export type ApiResult<T> = {
	status: number;
	data: T;
	raw: APIResponse;
};

/**
 * 成功斷言：驗證狀態碼為 2xx 並回傳資料
 */
export function expectOk<T>(res: ApiResult<T>): T {
	expect(res.status, `Expected status 2xx but got ${res.status}`).toBeGreaterThanOrEqual(200);
	expect(res.status, `Expected status 2xx but got ${res.status}`).toBeLessThan(300);
	return res.data;
}

/**
 * 建立成功斷言：驗證 201、Location 與回應中的資源 ID
 */
export function expectCreated(
	res: ApiResult<CreatedResponse>,
	expectedCollectionPath: string,
): number {
	expect(res.status, `Expected status 201 but got ${res.status}`).toBe(201);
	expect(res.data.id).toEqual(expect.any(Number));
	expect(Number.isInteger(res.data.id)).toBe(true);
	expect(res.data.id).toBeGreaterThan(0);
	const location = res.raw.headers().location;
	expect(location).toEqual(expect.any(String));
	expect(new URL(location ?? '', res.raw.url()).pathname).toBe(
		`${expectedCollectionPath}/${res.data.id}`,
	);
	return res.data.id;
}

/**
 * 錯誤斷言：驗證 RFC 9457 錯誤狀態與穩定錯誤碼
 */
export function expectError(
	res: ApiResult<unknown>,
	expectedStatus: number,
	expectedCode?: string,
): ApiError {
	expect(res.status, `Expected status ${expectedStatus} but got ${res.status}`).toBe(
		expectedStatus,
	);

	const errorData = res.data as ApiError;
	expect(errorData.status).toBe(expectedStatus);
	expect(errorData.code).toEqual(expect.any(String));
	expect(errorData.code.length).toBeGreaterThan(0);
	expect(errorData.detail).toEqual(expect.any(String));
	expect(errorData.detail.length).toBeGreaterThan(0);
	if (expectedCode !== undefined) {
		expect(errorData.code).toBe(expectedCode);
	}
	return errorData;
}

/**
 * API 請求執行器 (使用組合而非繼承)
 */
export class ApiRequester {
	constructor(protected readonly request: APIRequestContext) {}

	/**
	 * 封裝底層請求邏輯
	 */
	async sendRequest<T>(
		method: 'get' | 'post' | 'put' | 'delete',
		url: string,
		options?: Parameters<APIRequestContext['get']>[1],
	): Promise<ApiResult<T>> {
		const response = await this.request[method](url, options);

		let data: unknown;
		const contentType = response.headers()['content-type'];

		if (response.status() === 204 || !contentType || contentType.includes('text/plain')) {
			// 處理 204 No Content 或純文字回應
			const textData = await response.text();
			// 嘗試將純文字內容轉成數字
			if (textData.length > 0 && !Number.isNaN(Number(textData))) {
				data = Number(textData);
			} else {
				data = textData;
			}
		} else {
			try {
				data = await response.json();
			} catch {
				// 如果 JSON 解析失敗，回退到純文字
				data = await response.text();
			}
		}

		if (!response.ok()) {
			console.error(`[API ERROR] ${method.toUpperCase()} ${url} - Status: ${response.status()}`);
		}

		return {
			status: response.status(),
			data: data as T,
			raw: response,
		};
	}

	async get<T>(
		url: string,
		options?: Parameters<APIRequestContext['get']>[1],
	): Promise<ApiResult<T>> {
		return this.sendRequest<T>('get', url, options);
	}

	async post<T>(
		url: string,
		options?: Parameters<APIRequestContext['post']>[1],
	): Promise<ApiResult<T>> {
		return this.sendRequest<T>('post', url, options);
	}

	async put<T>(
		url: string,
		options?: Parameters<APIRequestContext['put']>[1],
	): Promise<ApiResult<T>> {
		return this.sendRequest<T>('put', url, options);
	}

	async delete<T>(
		url: string,
		options?: Parameters<APIRequestContext['delete']>[1],
	): Promise<ApiResult<T>> {
		return this.sendRequest<T>('delete', url, options);
	}
}
