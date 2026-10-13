# 介面、雙語文案與 SEO：折扣與免運試算

狀態：SPEC_ONLY；實際頁面與 SEO 尚未建立。

## Product App 介面

主視圖首先展示問題本身：目前購物籃要付多少？若加一件又要付多少？先輸入購物明細，折扣/運費就在其下，計算後兩情境並排（手機則上下），不要把加購結果只藏在「省了多少」卡片。

桌面：名稱和語言；項目表；百分比/固定券；免運門檻金額 + 達標依據選擇 + 運費；現有實付區；明確可選的加購情境與單件/一組價格；差額。手機單欄排列，輸入在上、基準結果與加購結果相鄰，差額完整可見。320px 無整頁橫向捲動。

明確標示「這是手動試算，商家折扣/免運規則請自行確認」和「未計稅金」。門檻選項旁寫明折前/折後都可能依商家設定而異；預設折後但使用者可改。差額標籤明確寫「已包含加購價格」。不要只用顏色標出省/多付；同時用正負文字和金額。

## 中文搜尋內容

Title：折扣與免運試算：加購後實際多付或少付多少 | GlossQuote
Description：輸入商品、折扣、折價券和運費，再試算加購門檻商品後的最終實付。把商品成本一起算進差額，不只看免運金額；在瀏覽器本機計算。
H1：折扣與免運試算
Intro：先算現在要付多少，再加入一件商品重新計算，確認免運後是否真的划算。

## English search content

Title: Free Shipping Calculator: Check the True Cost of Adding an Item | GlossQuote
Description: Compare your current cart with an add-on after discounts and shipping. See the actual out-of-pocket difference, including the extra item price, using a local browser calculation.
H1: Discount and free-shipping calculator
Intro: Compare the current total with an added item and see whether reaching free shipping changes what you actually pay.

## 可見 FAQ

雙語頁至少回答：門檻折前或折後？視商家規則而定，本工具明確選擇；折價券如何套用？先全籃百分比、再固定券、商品淨額最低零；有包括稅/匯率嗎？沒有；加購後的差額算了商品錢嗎？是，淨差包含加購價格；會連線讀購物車嗎？不會，只算手動輸入且本頁不保存。

## SEO 發布界線

preview noindex,nofollow。production 僅 M2 後使用 https://cart.glossquote.com/index.html 與 /en/index.html，互返 zh-Hant/en hreflang、x-default 繁中、正確 lang、canonical、title、description、OG。可用準確 WebApplication JSON-LD，不杜撰價格、評論、節省或結果排名。實際 robots/sitemap/404/headers 由 docs/RELEASE.md 及 live 驗證決定。
