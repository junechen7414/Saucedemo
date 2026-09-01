// tests/api/springboot/product.spec.ts

import { expectCreated, expectError, expectOk } from '@apis/base-api-client';
import { test } from '@fixtures/springboot-chained.fixture';
import { expect } from '@playwright/test';
import { ProductSaleStatus } from '@schema/constants';

test.describe('Product 商品管理', () => {
	test('應該能建立新商品', async ({ springbootApi, newProductData }) => {
		const response = await springbootApi.createProduct(newProductData);
		const productId = expectCreated(response, '/product');

		expect(typeof productId).toBe('number');
		expect(productId).toBeGreaterThan(0);
	});

	test('應該能查詢商品詳細資訊', async ({ springbootApi, existingProduct }) => {
		const response = await springbootApi.getProduct(existingProduct.id);
		const product = expectOk(response);

		// 驗證與 fixture 的一致性
		expect(product.name).toBe(existingProduct.name);
		expect(product.price).toBe(existingProduct.price);
		expect(product.saleStatus).toBe(ProductSaleStatus.Available);
		expect(product.available).toBe(existingProduct.available);
	});

	test('應該能更新商品資訊', async ({ springbootApi, existingProduct, updateProductData }) => {
		const response = await springbootApi.updateProduct(existingProduct.id, updateProductData);
		expectOk(response);

		// 驗證更新成功
		const getResponse = await springbootApi.getProduct(existingProduct.id);
		const updatedProduct = expectOk(getResponse);
		expect(updatedProduct.name).toBe(updateProductData.name);
		expect(updatedProduct.price).toBe(updateProductData.price);
	});

	test('應該能刪除商品', async ({ springbootApi, existingProduct }) => {
		const response = await springbootApi.deleteProduct(existingProduct.id);
		expectOk(response);

		// 驗證刪除成功（查詢應該回傳 404）
		const getResponse = await springbootApi.getProduct(existingProduct.id);
		expectError(getResponse, 404);
	});

	test('應該能查詢商品列表（預設分頁）', async ({ springbootApi }) => {
		const response = await springbootApi.listProducts();
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

	test('應該能使用分頁參數查詢商品列表', async ({ springbootApi }) => {
		// 使用分頁參數查詢
		const response = await springbootApi.listProducts({
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
			const ids = pageResponse.content.map((product) => product.id);
			for (let i = 0; i < ids.length - 1; i++) {
				expect(ids[i]).toBeGreaterThanOrEqual(ids[i + 1] ?? 0);
			}
		}
	});

	test('當商品名稱重複時，無法建立', async ({ springbootApi, existingProduct }) => {
		// 嘗試建立同名商品
		const response = await springbootApi.createProduct({
			name: existingProduct.name,
			price: 100,
			available: 50,
		});

		const errorBody = expectError(response, 400, 'PRODUCT_ALREADY_EXIST');
		expect(errorBody.detail).toContain('already exists');
	});

	test('當商品名稱重複時，無法更新', async ({
		springbootApi,
		existingMultipleProducts,
		updateProductData,
	}) => {
		// 確保有兩個商品
		expect(existingMultipleProducts.length).toBe(2);
		const firstProduct = existingMultipleProducts[0];
		const secondProduct = existingMultipleProducts[1];

		// 嘗試將第二個商品更新為第一個商品的名稱
		const response = await springbootApi.updateProduct(secondProduct.id, {
			name: firstProduct.name,
			price: updateProductData.price,
			saleStatus: updateProductData.saleStatus,
			available: updateProductData.available,
		});

		const errorBody = expectError(response, 400, 'PRODUCT_ALREADY_EXIST');
		expect(errorBody.detail).toContain('already exists');
	});
});
