# 隱私與安全：折扣與免運試算

購物內容可能顯示消費偏好或私人購買。所有輸入、運算與結果只存本頁記憶體，無帳號、server API、analytics、telemetry、third-party request、remote font、service worker 或任何 browser storage。pagehide/reload 清空。

使用者手動輸入，程式不讀其他分頁、商家網站、cookie、購物車或保存憑證。錯誤只回報 code/field/row，不記錄品名/價格；複製只有使用者直接操作，不保存clipboard內容。

價格/數量上限與 BigInt 避免超界/精度錯誤。使用純文字 DOM，不把品名解作HTML。沒有稅率推論、匯率或店家 API，因此不得暗示涵蓋這些項目。

本工具無法控制瀏覽器擴充、OS clipboard manager、截圖或使用者將資料再貼往何處；隱私說明只限頁面本身可驗證的行為。
