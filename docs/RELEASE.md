# 發布契約：折扣與免運試算

M1 本機版已由主代理獨立驗收。M2 是正式產物與獨立公開來源的準備，不代表 Cloudflare、首頁或外部驗收已通過。預覽保持 noindex/nofollow、僅 loopback；所有 M1 runtime bytes 由 release helper 的固定 SHA-256 gate 保護。

主代理已放行 M2，目標 public repository 為 KYStr/glossquote-labs-cart-check。依最新發布安全指令，create/push 在主代理解除暫停前不得執行。本機候選、固定 local commit ZIP 與乾淨解壓重建可繼續。隔離 staging/CLI state/證據只在孵化器專用 .runs/github-publish/glossquote-labs-cart-check/**，沒有全域／系統 Git config 或 credential 設定操作。

公開副本用 scripts/source-files.mjs 的明列清單；內部對話識別、routing、HANDOFF/project 狀態、.runs、dist、node_modules、secret/購物輸入都不在公開 copy。公開 README 由同一 reviewed helper 生成，說明候選和 live release 的不同。不得自動安裝、改 runtime dependency 或添加未授權 license。

執行 npm test、npm run check、npm run build；預覽 dist 必須等於 M1 runtime。再執行 npm run build:production、npm run check:production。Production 獨立在 dist-production，固定 https://cart.glossquote.com/index.html 和 /en/index.html，正確 lang、title/description、self canonical、互返 zh-Hant/en/x-default、OG、WebApplication JSON-LD、robots 與兩語 sitemap；_headers 僅允許兩個精確 JSON-LD SHA-256，不含 unsafe-inline/eval。JS/CSS/calculation/state/workflow 不變。

wrangler.jsonc 是 assets-only；compatibility_date=2026-10-13、html_handling=none、not_found_handling=404-page；workers.dev/preview_urls/metrics/logs/traces 全部關閉，無 account、binding、vars、route 或新資源。純本機 production server 僅 loopback；未知路徑實際404回雙語錯誤頁、正確 MIME、HEAD/405 與 CSP/security headers。_headers 不作 asset 提供。

Wrangler help/schema 必須先用既有4.147.0核對。scripts/dry-run.mjs 只建立新 task-owned child USERPROFILE/HOME/config/cache/temp/log/project；只繼承明列 OS/tool discovery 值，不讀或傳 credential variables，執行 deploy --dry-run --autoconfig=false。不調用 install、login、resource provisioning 或遠端部署。dry-run 是 packaging 檢查，不能代替 Cloudflare live 證據。

發布解除暫停後：使用 reviewed copy 的 local Git repository，固定 commit 後 git archive ZIP；scripts/source-archive.mjs 檢查 central/local ZIP headers、CRC、path/duplicate/link/cap，再逐 Git blob bytes/hash 比對，解壓至新目錄。乾淨 copy 重跑 npm test、npm run check:production、npm run build:production，建置前後檔案 manifest 都必須匹配。實查 GitHub visibility=PUBLIC、遠端 HEAD=固定 commit。初始候選發布尚未取得此證據，不能稱 published。

M3 僅主代理操作。候選 host 為 cart.glossquote.com。production candidate需通過 SEO雙語、canonical/hreflang、robots/sitemap、headers/CSP/404、精確 build manifest；部署免費 Cloudflare後做真實HTTP與雙語流程驗證，之後才將共享首頁條目改為published並重新部署驗證。

來源發布、正式網站及首頁狀態分列。任何功能交使用者做外部測試時標 awaiting external review。不得自行支出、讀取或新增權限。

設定依據：[Cloudflare HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)、[custom 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)、[static headers](https://developers.cloudflare.com/workers/static-assets/headers/)、[Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)。採用本機4.147.0 schema/help；頁面查核日期2026-10-13。隱私契約的 metrics/observability-off 要求優先於通用 skill 的建議。
