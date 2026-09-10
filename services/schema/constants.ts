/**
 * 帳戶狀態
 */
export enum AccountStatus {
	/** 啟用 */
	Active = 'Y',
	/** 停用 */
	Inactive = 'N',
}

/**
 * 商品銷售狀態
 */
export enum ProductSaleStatus {
	/** 可銷售 */
	Available = 1001,
	/** 停售 */
	Inactive = 1002,
}

/**
 * 訂單狀態
 *
 * 後端只有 1001 與 1003，**1002 是刻意的空號**（理由見 SpringBoot repo 的
 * `com.ibm.demo.enums.OrderStatus` 註解）。這裡曾經宣告 `Completed = 1002`，
 * 而後端當時未驗證值域、會把 1002 原封寫進 DB，測試因此「意外地」通過；
 * 後端補上值域驗證後同一個請求就變成 400。不要再把它加回來。
 */
export enum OrderStatus {
	/** 待處理 */
	Pending = 1001,
	/** 已取消 */
	Cancelled = 1003,
}
