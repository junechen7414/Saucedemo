import { faker } from '@faker-js/faker';
import { test as baseTest } from '@playwright/test';
import type { components } from '@schema/api-types';
import { AccountStatus, OrderStatus, ProductSaleStatus } from '@schema/constants';

type SpringbootDataFixtures = {
	newAccountData: components['schemas']['CreateAccountRequest'];
	updateAccountData: components['schemas']['UpdateAccountRequest'];
	newProductData: components['schemas']['CreateProductRequest'];
	updateProductData: components['schemas']['UpdateProductRequest'];
	newOrderData: (
		accountId: number,
		productId: number,
	) => components['schemas']['CreateOrderRequest'];
	updateOrderData: (productId: number) => components['schemas']['UpdateOrderRequest'];
};

export const springbootTestData = baseTest.extend<SpringbootDataFixtures>({
	// 建立新帳號的資料
	newAccountData: async ({}, use) => {
		await use({
			name: `user_${faker.string.alphanumeric(8)}`,
		});
	},
	// 更新帳號的資料
	updateAccountData: async ({}, use) => {
		await use({
			name: faker.person.fullName(),
			status: AccountStatus.Active,
		});
	},

	// 建立新商品的資料
	newProductData: async ({}, use) => {
		await use({
			name: `Prod_${faker.commerce.productName()}_${faker.string.alphanumeric(4)}`,
			price: faker.number.int({ min: 10, max: 1000 }),
			available: faker.number.int({ min: 1, max: 100 }),
		});
	},
	// 更新商品的資料
	updateProductData: async ({}, use) => {
		await use({
			name: `Updated_Product_${faker.number.int({ min: 1, max: 100 })}`,
			price: faker.number.int({ min: 10, max: 1000 }),
			available: faker.number.int({ min: 1, max: 100 }),
			saleStatus: ProductSaleStatus.Available,
		});
	},

	// 建立新訂單的資料
	newOrderData: async ({}, use) => {
		await use((accountId, productId) => ({
			accountId: accountId,
			items: [{ productId: productId, quantity: 1 }],
		}));
	},

	// 更新訂單的資料 (訂單 ID 走 URL 路徑，不再放在 body)
	updateOrderData: async ({}, use) => {
		await use((productId) => ({
			orderStatus: OrderStatus.Pending,
			items: [{ productId: productId, quantity: 1 }],
		}));
	},
});
