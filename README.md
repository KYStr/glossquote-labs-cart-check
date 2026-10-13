# 折扣與免運試算 / Discount and free-shipping calculator

Compare a manually entered cart with one additional item or bundle. The out-of-pocket difference includes the add-on price, all supported discounts and shipping.

Pure static HTML/CSS/ESM, zero runtime or development dependencies. Inputs and results stay in browser memory: no upload, storage, telemetry, remote fonts or merchant integrations. Use one currency and one store’s assumptions; taxes and exchange rates are excluded.

## Run and verify

Node.js 24.x and npm are required. No npm install is needed.

```sh
npm test
npm run check
npm run build
npm run dev
```

Preview binds only 127.0.0.1:4201 and remains noindex. If the port is occupied it uses an OS-assigned loopback port and prints the actual URL. Existing processes are preserved.

```sh
npm run build:production
npm run check:production
npm run dev:production
```

The separate dist-production candidate fixes bilingual canonical/hreflang/JSON-LD/robots/sitemap to https://cart.glossquote.com. It has hash-based CSP and a real custom 404, without SPA fallback. Local candidate checks and public source publication do not establish a live Cloudflare release; hosting, homepage inclusion and external review are separate milestones.

The original verified runtime is fixed by SHA-256 checks. Percentage discount cents round half-up first, followed by the fixed coupon and then shipping eligibility. Example: a 900.00 basket, 1000.00 threshold and 80.00 shipping costs 980.00; adding 100.00 reaches free shipping but costs 1000.00, so the difference is 20.00 more. Adding 50.00 still costs shipping and totals 1030.00, 50.00 more. A 10% discount on 0.05 rounds the discount to 0.01 and leaves 0.04.

See [PRODUCT](PRODUCT.md), [TECHNICAL](TECHNICAL.md), [ACCEPTANCE](ACCEPTANCE.md), [privacy](docs/PRIVACY-SECURITY.md) and [release](docs/RELEASE.md). Offline tests use fictional data only. Physical-device/IME, actual 200% zoom, full Network/Storage, screen-reader/cross-browser and genuine clipboard-denial checks remain documented manual NOT_RUN; handler stubs are not native browser evidence.
