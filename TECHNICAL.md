# 技術規格：折扣與免運試算

狀態：SPEC_ONLY。此文件定義所有計算、上限和錯誤。

## 精確金額表示及限制

所有金額皆以非負整數 BigInt cents。沒有幣別選擇器；同一購物籃各數值必須由使用者以同一幣別輸入，畫面輸出固定兩位小數且不暗示特定幣別。單價原始字串最多 16 UTF-16 code units；trim 外側 whitespace 後最多16字元且必須符合 ^[0-9]+(?:\.[0-9]{1,2})?$，解析後範圍 0..999999999 cents（即 9,999,999.99 個貨幣單位）。前導零可；正負號、逗號、科學記號、非 ASCII 數字拒絕。原始字串在上限內但 trim 後為空，回 ROW_INCOMPLETE；超出原始長度、trimmed grammar 不符時回 INVALID_PRICE。

每列 quantity 是 1..1000 正整數字串，原始長度最多4 UTF-16 code units且只含 ASCII 數字，允許前導零，不 trim 空格；空字串回 ROW_INCOMPLETE，超過4或非整數格式回 INVALID_QUANTITY。購物列數 1..30，任何空列不跳過。商品名稱原始最多256 UTF-16 code units，必須先檢查 raw length，超出回 NAME_RAW_TOO_LONG；再 trim 後若為空回 ROW_INCOMPLETE，非空時最多80 UTF-16 code units，拒絕 C0/C1 controls。price 欄原始長度在上限內但 trim 後為空，回 ROW_INCOMPLETE；非空而不符合數字語法才回 INVALID_PRICE。欄位缺 key、錯型別或未知 key 屬於 schema 錯誤，回 INVALID_REQUEST。最大商品小計為 30 × 999999999 × 1000 = 29,999,999,970,000 cents（299,999,999,700.00 個貨幣單位）；所有 additions 使用 BigInt。

所有金額/百分比文字先檢查未 trim 的 raw code-unit 上限，再 trim 外側 whitespace，再驗 trimmed grammar/value；不可先 trim 無界字串。百分比 raw 最多8 code units，trim 後須符合 ^[0-9]+(?:\.[0-9]{1,2})?$，數值0..100。轉為 basis points：整數百分數乘100，小數右補至2位。固定券使用與價格相同的 ASCII decimal grammar、最多18個 raw code units 和最多18個 trimmed code units、最多2位小數；其值範圍 0..29,999,999,970,000 cents，即不得超過最大合法購物籃總額。這是固定券的數值上限，原始字串長度上限則是18，兩者不是同一限制；超字串長度或格式回 INVALID_FIXED_COUPON，超值回 FIXED_COUPON_TOO_LARGE。固定券大於當時折後商品小計可接受，最終商品淨額 floor at zero。

運費原始最多16 code units，trim 後使用相同 ASCII decimal grammar，值 0..9999999 cents（99,999.99 個貨幣單位）。門檻可空；非空時 raw/trim 後最多18 code units，值 0..最大購物籃小計。空門檻表示沒有免運方案，即使購物籃為零仍照常使用運費輸入。超出各自 raw/trim 字串上限或格式回對應 INVALID_SHIPPING/INVALID_THRESHOLD。

可選加購只有一件或一組的單一金額，沿用單價原始/trim 字串限制、精度與數值範圍；名稱原始最多256 UTF-16 code units，trim 後必填、最多80並拒絕 C0/C1 controls。加購價格零合法。加購加入後的總量可比最大基準小計多最多一個單價，不溢位，全部 BigInt。

## Exact request / errors

calculateCart(request) 只接受 prototype 恰為 Object.prototype 或 null 的 plain object。Reflect.ownKeys 必須精確為 items,percentOff,fixedCoupon,freeShippingThreshold,thresholdBasis,shipping,addOn；各欄必須 own enumerable data property，不接受 symbol/non-enumerable unknown key 或 getter/setter。items 必須是 dense Array，prototype 恰為 Array.prototype，Reflect.ownKeys 除 length 外只有連續的0..length-1 enumerable data indices；hole/custom property/symbol/subclass 都回 INVALID_REQUEST。每列為 prototype Object.prototype 或 null 的 plain object，Reflect.ownKeys 精確為 name,price,quantity，值皆為 string，欄位是 enumerable data property。其他金額欄位用 string，空門檻用空字串，thresholdBasis 僅 pre-discount 或 post-discount，addOn 為 null 或精確 plain object {name,price}（prototype Object.prototype 或 null，Reflect.ownKeys/descriptor 同樣精確；兩欄為 own enumerable data property）。拒絕未知欄位、缺欄位、錯型別及非 plain object。

成功為 {ok:true,value:{items,discount,baseline,addOnScenario,summary}}，ok 為 boolean。基準 items 每列精確為 {name,unitPriceCents,quantity,lineCents}；name 是 trim 後字串，quantity 是 1..1000 的整數 Number，所有 cents 為 BigInt。discount 是 {percentOffBasisPoints,fixedCouponRequestedCents}，兩欄都是 BigInt（basis points 0n..10000n，另一欄是 cents）。baseline 精確為 {items,subtotalCents,percentOffBasisPoints,percentageDiscountCents,afterPercentCents,fixedCouponRequestedCents,fixedCouponAppliedCents,merchNetCents,thresholdCents,thresholdBasis,thresholdMeasureCents,qualifiesFreeShipping,shippingInputCents,shippingChargedCents,finalTotalCents}；items 是上述 dense row array，basis points 為 BigInt，cents 欄位為非負 BigInt，thresholdCents/thresholdMeasureCents 為 BigInt 或 null，thresholdBasis 為 pre-discount/post-discount 字串，qualifiesFreeShipping 為 boolean。fixedCouponAppliedCents=min(fixedCouponRequestedCents,afterPercentCents)。無門檻時 thresholdCents 與 thresholdMeasureCents 為 null，qualifiesFreeShipping=false。addOnScenario 是 null 或同樣使用上述型別的精確物件 {items,subtotalCents,percentOffBasisPoints,percentageDiscountCents,afterPercentCents,fixedCouponRequestedCents,fixedCouponAppliedCents,merchNetCents,thresholdCents,thresholdBasis,thresholdMeasureCents,qualifiesFreeShipping,shippingInputCents,shippingChargedCents,finalTotalCents,addOn:{name,priceCents,quantity}}；其中 items 是基準列後追加加購列，addOn.name 為字串、priceCents 為 BigInt、quantity 恰為整數 Number 1。summary 精確為 {baselineFinalTotalCents,addOnFinalTotalCents,addOnPriceCents,differenceCents}；baselineFinalTotalCents 為 BigInt，未啟用 addOn 時後三欄皆 null，啟用時三欄皆 BigInt 且 differenceCents=addOnFinalTotalCents-baselineFinalTotalCents，可負可零可正。失敗為 {ok:false,error:{code,row,field}}，ok 為 boolean false；error.code 為固定錯誤碼字串、row 為購物列 1-based 正整數 Number/null、field 為 items/name/price/quantity/percentOff/fixedCoupon/freeShippingThreshold/thresholdBasis/shipping/addOn 或 null。不得回傳輸入值。固定錯誤碼：INVALID_REQUEST、TOO_FEW_ITEMS、TOO_MANY_ITEMS、ROW_INCOMPLETE、NAME_RAW_TOO_LONG、NAME_TOO_LONG、CONTROL_CHARACTER、INVALID_PRICE、PRICE_TOO_LARGE、INVALID_QUANTITY、INVALID_PERCENT、INVALID_FIXED_COUPON、FIXED_COUPON_TOO_LARGE、INVALID_THRESHOLD、INVALID_SHIPPING、INVALID_ADD_ON。

錯誤次序：request schema、列數、購物列逐列從上到下、percentOff、fixedCoupon、threshold、thresholdBasis、shipping、addOn。購物列每欄依 name、price、quantity。只回報首個錯誤，不能產生部分結果。field/row 非相關錯誤取 null。

## 金額算法

對每列先求 lineCents=unitPriceCents×quantity；subtotalS 是所有 lineCents 的 BigInt 加總。percent basis points b 先表示為 BigInt，範圍 0n..10000n。先計 percentageDiscountP= floor((2×S×b + 10000)/(2×10000))，其中常數亦以 BigInt 表示；即折扣金額以 cents 計算並四捨五入至最近一分、half-up；再令 afterPercent=max(0n,S-P)。不得先算 S×(1−p) 再把折後剩餘金額 round 到分，兩者半分時會不同。fixed coupon requested C 隨後扣除，fixedCouponApplied=min(C,afterPercent)，merchNet=afterPercent-fixedCouponApplied；不會形成負餘額、不退現金。百分比折扣只算商品小計，運費不參與任何折扣。

freeShippingThreshold 空時 qualifies=false。若 thresholdBasis=pre-discount，measure=S；若 post-discount，measure=merchNet（百分比與固定券都扣完）。非空且 measure >= threshold 時有效運費為0，否則為輸入 shipping。finalTotal=merchNet+effectiveShipping。

基準與加購情境獨立呼叫同一 pure calculation。加購情境把一行名稱/價格/數量1附加到 items，重新計算 subtotal、百分比券、固定券和免運。差額為 addOnFinalTotal−baselineFinalTotal。正數顯示「加購後多付」該金額；負數顯示「加購後少付」其絕對值；零顯示實付相同。另始終顯示加購價格。此差額包含加購本身，不得把免運差額單獨稱為節省。

固定例（數值皆為同一未指定幣別）：無折扣 S=900.00、threshold=1,000.00(post)、shipping=80.00，baseline=980.00。addOn=100.00 使 merch=1,000.00、ship=0、final=1,000.00、difference=+20.00；addOn=50.00 使 merch=950.00、ship=80.00、final=1,030.00、difference=+50.00。折前 threshold=1,000.00 時也要按 900.00/1,000.00 分別判斷門檻；不得默認商家必採某一方式。半分例：subtotal=0.05（5 cents）、percent=10.00%，百分比折扣金額為0.5 cent，half-up到1 cent，因此 afterPercent=0.04（4 cents）。不能先 round 0.05×90%=0.045 得0.05。

## 前端狀態、顯示與複製

計算成功後顯示逐列小計、subtotal、percentage discount、fixed coupon、商品淨額、門檻採用金額/是否達標/運費和實付。百分比折扣是先算折扣金額並以 half-up 四捨五入到整分，再扣固定券；例如小計 5 cents × 10% 得到半分折扣，先四捨五入成1 cent，折後剩4 cents。不得把折後餘額 4.5 cents 先四捨五入。加購啟用時顯示上述第二套數字及淨差。金額格式化僅在輸出轉成字串，例如固定兩位分，不使用浮點參與比較。

任何編輯、增加/刪除項目、門檻 basis 或加購開關改變都 revision++，立即清空兩方案及報告並 disable copy。主操作驗證全表；copy callback 需檢查 revision 和 latest request id。剪貼簿缺失/拒絕時提供 readonly text fallback，不自動下載。clear/pagehide/reload 清除所有輸入、輸出和 request；沒有 browser storage。
