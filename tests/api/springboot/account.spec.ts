// tests/api/springboot/account.spec.ts

import { expectCreated, expectError, expectOk } from '@apis/base-api-client';
import { test } from '@fixtures/springboot-chained.fixture';
import { expect } from '@playwright/test';
import { AccountStatus } from '@schema/constants';

test.describe('Account 帳戶管理', () => {
	test('應該能建立新帳戶', async ({ springbootApi, newAccountData }) => {
		const response = await springbootApi.createAccount(newAccountData);
		const accountId = expectCreated(response, '/account');

		expect(typeof accountId).toBe('number');
		expect(accountId).toBeGreaterThan(0);
	});

	test('應該能查詢帳戶詳細資訊', async ({ springbootApi, existingAccount }) => {
		const response = await springbootApi.getAccount(existingAccount.id);
		const account = expectOk(response);

		expect(account.name).toBe(existingAccount.name);
		expect(account.status).toBe(AccountStatus.Active);
	});

	test('應該能更新帳戶資訊', async ({ springbootApi, existingAccount, updateAccountData }) => {
		const updatePayload = {
			...updateAccountData,
			name: '更新後的帳戶名稱',
		};

		const response = await springbootApi.updateAccount(existingAccount.id, updatePayload);
		expectOk(response);

		// 驗證更新成功
		const getResponse = await springbootApi.getAccount(existingAccount.id);
		const updatedAccount = expectOk(getResponse);
		expect(updatedAccount.name).toBe('更新後的帳戶名稱');
	});

	test('應該能刪除帳戶', async ({ springbootApi, existingAccount }) => {
		const response = await springbootApi.deleteAccount(existingAccount.id);
		expectOk(response);

		// 驗證刪除成功（查詢應該回傳 404）
		const getResponse = await springbootApi.getAccount(existingAccount.id);
		expectError(getResponse, 404);
	});

	test('應該能查詢帳戶列表（預設分頁）', async ({ springbootApi }) => {
		const response = await springbootApi.listAccounts();
		const pageResponse = expectOk(response);

		// 驗證分頁回應結構
		expect(pageResponse).toHaveProperty('content');
		expect(pageResponse).toHaveProperty('page');
		expect(pageResponse).toHaveProperty('size');
		expect(pageResponse).toHaveProperty('totalElements');
		expect(pageResponse).toHaveProperty('totalPages');
		expect(Array.isArray(pageResponse.content)).toBeTruthy();
		expect(pageResponse.content.length).toBeGreaterThan(0);
	});

	test('應該能使用分頁參數查詢帳戶列表', async ({ springbootApi }) => {
		// 使用分頁參數查詢
		const response = await springbootApi.listAccounts({
			page: 0,
			size: 5,
			sort: 'id,desc',
		});
		const pageResponse = expectOk(response);

		// 驗證分頁參數生效
		expect(pageResponse.size).toBe(5);
		expect(pageResponse.page).toBe(0);
		expect(pageResponse.content.length).toBeLessThanOrEqual(5);

		// 驗證排序（ID 降冪）
		if (pageResponse.content.length > 1) {
			const ids = pageResponse.content.map((account) => account.id);
			for (let i = 0; i < ids.length - 1; i++) {
				expect(ids[i]).toBeGreaterThanOrEqual(ids[i + 1] ?? 0);
			}
		}
	});

	test('當帳戶有關聯訂單時，無法刪除', async ({ springbootApi, existingAccountWithOrders }) => {
		const response = await springbootApi.deleteAccount(existingAccountWithOrders.id);
		const errorBody = expectError(response, 400, 'ACCOUNT_STILL_HAS_ORDER_CAN_NOT_BE_DELETED');

		expect(errorBody.detail).toContain('has associated orders');
	});

	test('當帳戶有關聯訂單時，無法將狀態改為停用', async ({
		springbootApi,
		existingAccountWithOrders,
		updateAccountData,
	}) => {
		const response = await springbootApi.updateAccount(existingAccountWithOrders.id, {
			...updateAccountData,
			status: AccountStatus.Inactive,
		});

		const errorBody = expectError(response, 400, 'ACCOUNT_STILL_HAS_ORDER_CAN_NOT_BE_DELETED');
		expect(errorBody.detail).toContain('has associated orders');
	});

	test('啟用中的帳戶應具下單資格', async ({ springbootApi, existingAccount }) => {
		const response = await springbootApi.getAccountOrderEligibility(existingAccount.id);
		expectOk(response);

		// 具資格是以 204 表達，沒有 body
		expect(response.status).toBe(204);
	});

	test('已有關聯訂單的啟用帳戶仍具下單資格', async ({
		springbootApi,
		existingAccountWithOrders,
	}) => {
		const response = await springbootApi.getAccountOrderEligibility(existingAccountWithOrders.id);
		expectOk(response);

		expect(response.status).toBe(204);
	});

	test('當帳戶已被刪除時，不具下單資格', async ({ springbootApi, existingAccount }) => {
		const deleteResponse = await springbootApi.deleteAccount(existingAccount.id);
		expectOk(deleteResponse);

		// 已軟刪除的帳戶查詢即不可見，故回 404 而非 400
		const response = await springbootApi.getAccountOrderEligibility(existingAccount.id);
		const errorBody = expectError(response, 404, 'RESOURCE_NOT_FOUND');
		expect(errorBody.detail).toBe(`Account not found with id: ${existingAccount.id}`);
	});

	test('當帳戶狀態為停用時，不具下單資格', async ({
		springbootApi,
		existingAccount,
		updateAccountData,
	}) => {
		const updateResponse = await springbootApi.updateAccount(existingAccount.id, {
			...updateAccountData,
			status: AccountStatus.Inactive,
		});
		expectOk(updateResponse);

		// 停用帳戶同樣因 SQLRestriction 而不可見，回 404
		const response = await springbootApi.getAccountOrderEligibility(existingAccount.id);
		const errorBody = expectError(response, 404, 'RESOURCE_NOT_FOUND');
		expect(errorBody.detail).toBe(`Account not found with id: ${existingAccount.id}`);
	});
});
