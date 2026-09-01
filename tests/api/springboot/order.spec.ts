// tests/api/springboot/order.spec.ts

import { expectCreated, expectError, expectOk } from '@apis/base-api-client';
import { test } from '@fixtures/springboot-chained.fixture';
import { expect } from '@playwright/test';
import { AccountStatus, ProductSaleStatus } from '@schema/constants';

test.describe('Order 訂單管理 (含明細更新)', () => {
	test('應該能建立新訂單', async ({
		springbootApi,
		existingAccount,
		existingProduct,
		newOrderData,
	}) => {
		const response = await springbootApi.createOrder(
			newOrderData(existingAccount.id, existingProduct.id),
		);
		const orderId = expectCreated(response, '/order');

		expect(typeof orderId).toBe('number');
	});

	test('當帳戶狀態為無效時，無法建立新訂單', async ({
		springbootApi,
		existingAccount,
		existingProduct,
		newOrderData,
		updateAccountData,
	}) => {
		// 將帳戶狀態設為無效
		const updateResponse = await springbootApi.updateAccount(existingAccount.id, {
			...updateAccountData,
			status: AccountStatus.Inactive,
		});
		expectOk(updateResponse);

		const response = await springbootApi.createOrder(
			newOrderData(existingAccount.id, existingProduct.id),
		);

		const errorBody = expectError(response, 404, 'RESOURCE_NOT_FOUND');
		expect(errorBody.detail).toBe(`Account not found with id: ${existingAccount.id}`);
	});

	test('當商品狀態為無效時，無法建立新訂單', async ({
		springbootApi,
		existingAccount,
		existingProduct,
		newOrderData,
		updateProductData,
	}) => {
		// 將商品狀態設為無效
		const updateResponse = await springbootApi.updateProduct(existingProduct.id, {
			...updateProductData,
			saleStatus: ProductSaleStatus.Inactive,
		});
		expectOk(updateResponse);

		const response = await springbootApi.createOrder(
			newOrderData(existingAccount.id, existingProduct.id),
		);

		const errorBody = expectError(response, 404, 'RESOURCE_NOT_FOUND');
		expect(errorBody.detail).toBe(`Products not found with IDs: ${existingProduct.id}`);
	});

	test('應該能更新訂單明細數量與狀態', async ({
		springbootApi,
		existingOrder,
		existingProduct,
		updateOrderData,
	}) => {
		const response = await springbootApi.updateOrder(
			existingOrder.id,
			updateOrderData(existingProduct.id),
		);
		expectOk(response);
	});

	test('應該能根據帳號查詢訂單列表', async ({
		springbootApi,
		existingAccountWithMultipleOrders,
	}) => {
		const response = await springbootApi.listOrdersByAccount(existingAccountWithMultipleOrders.id);
		const pageResponse = expectOk(response);

		// 驗證分頁回應結構
		expect(pageResponse).toHaveProperty('content');
		expect(pageResponse).toHaveProperty('totalElements');
		expect(pageResponse).toHaveProperty('totalPages');
		expect(Array.isArray(pageResponse.content)).toBeTruthy();
		expect(pageResponse.content.length).toBeGreaterThan(0);

		// 驗證訂單數量與 fixture 一致
		expect(pageResponse.content.length).toBe(existingAccountWithMultipleOrders.orderIds.length);
	});

	test('應該能使用分頁參數查詢訂單列表', async ({
		springbootApi,
		existingAccountWithMultipleOrders,
	}) => {
		// 使用分頁參數查詢
		const response = await springbootApi.listOrdersByAccount(existingAccountWithMultipleOrders.id, {
			page: 0,
			size: 1,
			sort: 'id,desc',
		});
		const pageResponse = expectOk(response);

		// 驗證分頁參數生效
		expect(pageResponse.size).toBe(1);
		expect(pageResponse.page).toBe(0);
		expect(pageResponse.content.length).toBeLessThanOrEqual(1);
	});

	test('應該能刪除訂單', async ({ springbootApi, existingOrder }) => {
		const response = await springbootApi.deleteOrder(existingOrder.id);
		expectOk(response);

		const getResponse = await springbootApi.getOrder(existingOrder.id);
		expectError(getResponse, 404);
	});

	test('當商品庫存不足時，無法建立新訂單', async ({
		springbootApi,
		existingAccount,
		existingProduct,
	}) => {
		// 直接使用 fixture 資料，無需額外查詢
		const response = await springbootApi.createOrder({
			accountId: existingAccount.id,
			items: [{ productId: existingProduct.id, quantity: existingProduct.available + 1 }],
		});

		const errorBody = expectError(response, 400, 'PRODUCT_STOCK_NOT_ENOUGH');
		expect(errorBody.detail).toBe(`商品 ID ${existingProduct.id} 庫存不足，無法預留`);
	});

	test('當商品庫存不足時，無法更新訂單', async ({
		springbootApi,
		existingOrder,
		existingProduct,
		updateOrderData,
	}) => {
		// 取得原訂單中該商品的數量，因為更新時會先歸還庫存
		const order = await springbootApi.getOrder(existingOrder.id);
		const originalItem = expectOk(order).items?.find((i) => i.productId === existingProduct.id);
		const originalQuantity = originalItem?.quantity ?? 0;

		// 嘗試將訂單更新為數量大於 (目前可用庫存 + 原訂單數量)
		const response = await springbootApi.updateOrder(existingOrder.id, {
			...updateOrderData(existingProduct.id),
			items: [
				{
					productId: existingProduct.id,
					quantity: existingProduct.available + originalQuantity + 1,
				},
			],
		});

		const errorBody = expectError(response, 400, 'PRODUCT_STOCK_NOT_ENOUGH');
		expect(errorBody.detail).toBe(`商品 ID ${existingProduct.id} 庫存不足，無法預留`);
	});
});
