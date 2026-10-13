import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { messages } from '../public/js/messages.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export function page(locale) {
  const t = messages[locale], en = locale === 'en';
  const field = (id, label, max, value = '', described = '') => `<label for="${id}">${escape(label)}<input id="${id}" name="${id}" type="text"${id === 'addOnName' ? '' : ' inputmode="decimal"'} value="${value}"${described ? ` aria-describedby="${described}"` : ''}></label>`;
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escape(t.title)}</title>
  <meta name="description" content="${escape(t.description)}">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/styles/app.css">
  <script type="module" src="/js/app.mjs"></script>
</head>
<body>
  <a class="skip" href="#cart-form">${en ? 'Skip to calculator' : '跳至試算器'}</a>
  <header class="topbar"><a class="brand" href="https://glossquote.com/${en ? 'en/' : ''}index.html" rel="noreferrer">Gloss Tools <span>by GlossQuote</span></a><nav aria-label="${en ? 'Navigation' : '導覽'}"><a id="home-link" href="https://glossquote.com/${en ? 'en/' : ''}index.html" rel="noreferrer">${t.home}</a><a href="${en ? '/index.html' : '/en/index.html'}" lang="${en ? 'zh-Hant' : 'en'}" hreflang="${en ? 'zh-Hant' : 'en'}">${t.language}</a></nav></header>
  <main>
    <div class="intro"><h1>${t.h1}</h1><p>${t.intro}</p></div>
    <noscript>${en ? 'Enable JavaScript to calculate locally on this page.' : '請啟用 JavaScript，以便在本頁本機試算。'}</noscript>
    <div class="workspace">
      <form id="cart-form" novalidate autocomplete="off">
        <section aria-labelledby="cart-heading"><div class="section-head"><h2 id="cart-heading">${t.cart}</h2><span id="item-count" class="muted">1 / 30</span></div><p id="item-help" class="help">${t.itemHelp}</p>
          <div id="items"></div><button id="add-item" type="button" class="secondary">${t.addRow}</button>
        </section>
        <section aria-labelledby="rules-heading"><h2 id="rules-heading">${t.rules}</h2><div class="fields two">${field('percentOff', t.percent, 8, '0', 'discount-help')}${field('fixedCoupon', t.coupon, 18, '0', 'discount-help')}</div><p id="discount-help" class="help">${t.discountHelp}</p>
          <div class="fields two">${field('shipping', t.shipping, 16, '0')}${field('freeShippingThreshold', t.threshold, 18, '', 'threshold-help')}</div>
          <label for="thresholdBasis">${t.basis}</label><select id="thresholdBasis" name="thresholdBasis" aria-describedby="threshold-help"><option value="post-discount">${t.post}</option><option value="pre-discount">${t.pre}</option></select><p id="threshold-help" class="help">${t.thresholdHelp}</p>
        </section>
        <section class="add-on-section" aria-label="${t.addOnToggle}"><label class="toggle" for="addOnEnabled"><input id="addOnEnabled" type="checkbox">${t.addOnToggle}</label><div id="add-on-fields" hidden><div class="fields two">${field('addOnName', t.addOnName, 256)}${field('addOnPrice', t.addOnPrice, 16)}</div><p class="help">${t.addOnHelp}</p></div></section>
        <p id="form-error" class="error" role="alert" hidden></p>
        <div class="actions"><button id="calculate" class="primary" type="submit">${t.calculate}</button><button id="clear" type="button" class="quiet">${t.clear}</button></div>
        <p class="help privacy">${t.privacy}</p><p class="help">${t.caution}</p>
      </form>
      <section id="comparison" class="comparison" aria-labelledby="results-heading"><h2 id="results-heading">${t.results}</h2><p id="empty-result" class="empty">${t.empty}</p><div id="results"></div>
        <div class="copy-actions"><button id="copy" type="button" class="secondary" disabled>${t.copy}</button><p id="status" role="status" aria-live="polite"></p></div>
        <div id="copy-fallback" hidden><label for="report-text">${t.fallbackLabel}</label><textarea id="report-text" readonly rows="12"></textarea></div>
      </section>
    </div>
    <section class="faq" aria-labelledby="faq-heading"><h2 id="faq-heading">${t.faqTitle}</h2>${t.faqs.map(([question, answer]) => `<details><summary>${escape(question)}</summary><p>${escape(answer)}</p></details>`).join('\n')}</section>
  </main>
  <footer>Gloss Tools by GlossQuote · ${en ? 'Local manual calculation' : '本機手動試算'}</footer>
  <template id="item-template"><fieldset class="item-row"><legend></legend><div class="item-fields"><label data-label="name"><span></span><input data-field="name" type="text" aria-describedby="item-help"></label><label data-label="price"><span></span><input data-field="price" type="text" inputmode="decimal" aria-describedby="item-help"></label><label data-label="quantity"><span></span><input data-field="quantity" type="text" inputmode="numeric" value="1" aria-describedby="item-help"></label><button type="button" data-remove class="quiet"></button></div><p data-line class="row-line" hidden></p></fieldset></template>
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(`${root}/en`, { recursive: true });
  await writeFile(`${root}/index.html`, page('zh-Hant'));
  await writeFile(`${root}/en/index.html`, page('en'));
  console.log('Wrote both static preview pages.');
}
