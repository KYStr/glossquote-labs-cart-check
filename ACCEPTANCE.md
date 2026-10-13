# 驗收規格：折扣與免運試算

狀態 SPEC_ONLY；所有案例 NOT_RUN。核心 A 用固定 expected 整數 cents，不能引用被測試函式來算 expected。

## A：核心/金額/狀態案例

1. 一列 10.00×2（同一未指定幣別）→ subtotal 2000 cents。
2. 30列每列合法最高單價與數量1000 → subtotal精確為29,999,999,970,000 cents，不溢位。
3. 第31列 → TOO_MANY_ITEMS；0列 TOO_FEW_ITEMS。
4. 欄位 key 缺漏或型別錯誤 → INVALID_REQUEST；raw 長度在上限內且欄位存在時，name trim 後為空、price trim 後為空、quantity 為空字串 → ROW_INCOMPLETE；raw 長度超限依 TECHNICAL.md 的長度錯誤優先；不跳過空白列。
5. 單價整數、1位及2位小數都依分解析；1.2=1.20。
6. 非空的 1.001、逗號、正負號、科學記號、Unicode數字 → INVALID_PRICE；空 price 由 A4 判為 ROW_INCOMPLETE。
7. 原始輸入字串 `9999999.99` 接受；`10000000.00` → PRICE_TOO_LARGE。帶逗號的原始字串始終 INVALID_PRICE。
8. quantity 1/1000 接受；0、1001、2.0、負數、5位字串拒絕。
9. 商品名稱 80 UTF-16 units接受、81拒絕；control字元拒絕。
10. percent 0.00/100.00接受，100.01/負值/1.001/空值拒絕。
11. 1000 cents×0.05% = 0.5 cent，half-up折扣為1 cent。
12. S=10001 cents，10.00%=1000.1 cents，折扣=1000 cents。
13. S=10005 cents，10.00%=1000.5 cents，折扣=1001 cents；另測 S=5 cents（0.05 個貨幣單位）×10.00%=0.5 cent，折扣 half-up 為1 cent，afterPercent=4 cents（0.04）。
14. 固定券大於 afterPercent → merchNet=0，不成負數；shipping照門檻規則決定。
15. 最大固定券範圍接受；超過最大購物籃上限 → FIXED_COUPON_TOO_LARGE。
16. 全籃折扣順序百分比先、固定券後；結果符合公式，稅與運費未折。
17. threshold空 → 不免運；shipping仍照輸入收取。
18. 明確 threshold=0 合法並按 measure>=0 達標；不能把空白轉成0。
19. 折前threshold：S=90000 cents、afterDiscount=80000、threshold=85000 → 達到，運費=0。
20. 折後threshold：同樣金額與門檻 → 未達，收取輸入運費。
21. 門檻相等時達標（>=），差一分未達。
22. shipping 原始輸入字串 `99999.99` 接受；`100000.00` 拒絕。帶逗號的原始字串始終 INVALID_SHIPPING。
23. shipping不折扣；percent及fixed券只算商品 subtotal。
24. 用固定案例900/1000/80，加購100 → baseline980、after1000、差+20，不得聲稱省80。
25. 同上加購50 → after1030、差+50，門檻仍未達。
26. baseline950、threshold1000、shipping80、addon50 → baseline1030、scenario1000、差-30；差額顯示少付30且仍列加購價格50。
27. addOn加入後重新計算 percentage discount 和固定券，不把基準券額凍結。
28. thresholdBasis enum 只接受 pre-discount/post-discount；未知字串拒絕。
29. request/item/addOn exact schema：缺鍵、多鍵、錯型別、symbol/non-enumerable key、accessor、非 plain prototype → INVALID_REQUEST；輸出成功物件也須符合 TECHNICAL.md 列出的完整 exact schema。
30. sparse items array、非 Array.prototype、額外自訂屬性或 symbol → INVALID_REQUEST，不得跳過 hole。
31. 合法項目後接第2列錯誤 → 首錯指向第2列，不顯示部分計算。
32. baseline 與啟用加購時的 scenario 分別驗算：afterPercentCents − fixedCouponAppliedCents + shippingChargedCents = 該方案 finalTotalCents；不以只含差額的 summary 代替構成金額。
33. 金額輸出固定兩位小數、使用同一幣別假設且不附帶特定符號；例如 1005 cents → 10.05，沒有浮點尾數。
34. 惡意HTML品名以純文字顯示，不執行。
35. 任一輸入、門檻basis、加購資料變化即清空結果/報告並停 copy。
36. copy stale promise 與逆序 request 不得更新新的 revision。
37. clipboard missing/reject 提供可選文字，不觸發下載。
38. clear/pagehide/reload 清除資料，沒有 storage restore。
39. 成功結果精確區分 fixedCouponRequestedCents 與 fixedCouponAppliedCents；baseline/addOnScenario 各自有完整 subtotal、折扣、門檻、運費、finalTotal 欄位；summary 的 baseline/add-on total、add-on price 與 signed difference 皆依 schema 保留，addOn=null 時僅 add-on 相關 summary 欄位為 null。

## B：雙語真瀏覽器流程

- 中文與英文各輸入一個900.00購物籃、運費80、門檻1000、折扣0，加購100；核對實付980→1000及多付20。
- 兩語各用加購50，核對仍收80運費、實付1030、多付50。
- 至少一語選折前threshold，另一語選折後threshold，以同一數據看差異；預設顯示折後。
- 兩語加入百分比券和固定券，檢查折扣順序與商品淨額；shipping不打折。
- 輸入錯誤價格/空行/超量後確認錯誤欄 focus、無舊結果；修正後可重新計算。
- 320px、200% 縮放、鍵盤、中文 IME/貼上、copy success/fallback 都需人工觀察。
- Network 與 Storage 檢查本頁不發網路資料、不保存購物輸入；無法觀察的原生/讀屏/設備項目列 NOT_RUN。
- reload/pagehide後輸入與結果清空；兩語首頁導航 link 的 URL 正確。

## M1 門檻

所有 A、npm test、npm run check、npm run build 通過，且兩語主要 B 流程/320px必要互動通過。正式站、Cloudflare、首頁與外部審查不是 M1，保留 NOT_RUN。主代理獨立驗收後才放行來源發布。
