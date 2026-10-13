# 工程約定：折扣與免運試算

金額唯一內部表示是 BigInt cents；percent 是整數 basis points。百分比折扣的 half-up 到分公式需與 TECHNICAL.md 一致。格式化不回流到運算。滿額門檻和運費只在折扣完成後依選項判斷。

純函式拒絕未知 schema 欄位並回穩定 code/row/field。核心測試以獨立常數 cents 給 expected，不可調用實作算 expected。基準/加購共用同一算法，不重寫另一套分支。

UI 修改輸入同步清除結果及 copy；copy callbacks 用 revision + request id。無持久化。靜態頁 server 僅 localhost，固定 allowlist，正確 MIME、GET/HEAD，404/405真實返回，防 traversal、hardlink/junction/symlink escape 和未知 stale output。

離線 Node.js ESM 24 和內建模組。禁止外部測試/計算服務、npm runtime dependencies、telemetry。
