# 發布契約：折扣與免運試算

M1 本機版已由主代理獨立驗收。M2 是正式產物與獨立公開來源的準備，不代表 Cloudflare、首頁或外部驗收已通過。預覽保持 noindex/nofollow、僅 loopback；所有 M1 runtime bytes 由 release helper 的固定 SHA-256 gate 保護。

主代理已放行 M2，[KYStr/glossquote-labs-cart-check](https://github.com/KYStr/glossquote-labs-cart-check) 已實查為 **PUBLIC**、isPrivate=false，main來源已推送並核對遠端HEAD。發布限制已解除，並非目前仍暫停或未驗；先前暫停屬下述歷史事件。此文件所在版本的固定commit由Git metadata標識，對應ZIP／逐blob／乾淨重建與remote HEAD證據保存在獨立交接紀錄，避免把自我參照commit hash寫回source。M3 hosting／首頁與外部驗收尚未執行，PUBLIC來源不等於正式網站已部署。

已驗的來源沿革：初次來源73d9767bb1d02f4c1c0c48d9ecf7c8625fd29829公開；主代理發現缺網域綁定後，bca9623c8085d3406e0f914fd58039545bc7bbc7補唯一cart custom domain，PUBLIC remote HEAD、42 Git blob-byte ZIP、安全解壓和55/55＋全部gates已實查通過。這兩個commit是保留的歷史基準；後續本文件的一致性修正沿同一歷史fast-forward，不重寫已發布commit或M1 runtime。最新固定source依本repo Git metadata和交接證據核對。

發布安全歷史：其他owner誤設helper時，主代理曾要求暫停create/push；使用者授權主代理只移除四個已確認assignment後解除，不能稱恢復未知pre-state。本工具未執行setup-git/login/refresh或global/system writes。各publication block都先capture、後verify已知Git config指紋，Windows完整Environment也相同；需要helper時只有單次git -c。隔離staging/CLI state／證據只在孵化器專用 .runs/github-publish/glossquote-labs-cart-check/**，不讀token或credential store。

公開副本用 scripts/source-files.mjs 的明列清單；內部對話識別、routing、HANDOFF/project 狀態、.runs、dist、node_modules、secret/購物輸入都不在公開 copy。公開 README 由同一 reviewed helper 生成，說明候選和 live release 的不同。不得自動安裝、改 runtime dependency 或添加未授權 license。

執行 npm test、npm run check、npm run build；預覽 dist 必須等於 M1 runtime。再執行 npm run build:production、npm run check:production。Production 獨立在 dist-production，固定 https://cart.glossquote.com/index.html 和 /en/index.html，正確 lang、title/description、self canonical、互返 zh-Hant/en/x-default、OG、WebApplication JSON-LD、robots 與兩語 sitemap；_headers 僅允許兩個精確 JSON-LD SHA-256，不含 unsafe-inline/eval。JS/CSS/calculation/state/workflow 不變。

wrangler.jsonc 是 assets-only；compatibility_date=2026-10-13、html_handling=none、not_found_handling=404-page；workers.dev/preview_urls/metrics/logs/traces 全部關閉，無 account、binding 或 vars。唯一 route 必須精確為 `{pattern:'cart.glossquote.com',custom_domain:true}`；M3由主代理按既有授權執行此配置，沒有未定義的route注入流程。M2只驗配置與dry-run，不執行deploy/DNS；缺route、錯域名、非custom domain或額外route全部拒絕。純本機 production server 僅 loopback；未知路徑實際404回雙語錯誤頁、正確 MIME、HEAD/405 與 CSP/security headers。_headers 不作 asset 提供。

Wrangler help/schema 必須先用既有4.147.0核對。scripts/dry-run.mjs 只建立新 task-owned child USERPROFILE/HOME/config/cache/temp/log/project；只繼承明列 OS/tool discovery 值，不讀或傳 credential variables，執行 deploy --dry-run --autoconfig=false。不調用 install、login、resource provisioning 或遠端部署。dry-run 是 packaging 檢查，不能代替 Cloudflare live 證據。

已執行的固定來源驗證：使用reviewed copy的獨立local Git repository，固定commit後git archive ZIP；scripts/source-archive.mjs檢查central/local ZIP headers、CRC、path/duplicate/link/cap，再逐Git blob bytes/hash比對並解壓到新目錄。乾淨copy的npm test、check、build、build:production、check:production全部exit0，source bytes未變且13個production檔逐一與候選相同。GitHub visibility=PUBLIC、remote HEAD=固定source commit已驗。後續任何source修正仍須重新固定ZIP并驗其scope；已驗且未受影響的runtime/browser證據保留，不能把來源PASS擴稱hosting／外驗PASS。

M3 僅主代理操作。候選 host 為 cart.glossquote.com。production candidate需通過 SEO雙語、canonical/hreflang、robots/sitemap、headers/CSP/404、精確 build manifest；部署免費 Cloudflare後做真實HTTP與雙語流程驗證，之後才將共享首頁條目改為published並重新部署驗證。

來源發布、正式網站及首頁狀態分列。任何功能交使用者做外部測試時標 awaiting external review。不得自行支出、讀取或新增權限。

設定依據：[Cloudflare HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)、[custom 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)、[static headers](https://developers.cloudflare.com/workers/static-assets/headers/)、[Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)。採用本機4.147.0 schema/help；頁面查核日期2026-10-13。隱私契約的 metrics/observability-off 要求優先於通用 skill 的建議。
