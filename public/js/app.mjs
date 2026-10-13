import { calculateCart } from './core/cart.mjs';
import { formatCents } from './core/format.mjs';
import { messages } from './messages.mjs';
import { createState, copyReport } from './state.mjs';
import { makeReport, differenceText, scenarioEntries } from './report.mjs';

const t = messages[document.documentElement.lang];
const state = createState();
const byId = id => document.getElementById(id);
const form = byId('cart-form'), items = byId('items'), resultArea = byId('results');
const copy = byId('copy'), status = byId('status'), error = byId('form-error');
let rowSequence = 0, report = '';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function clearOutput() {
  report = '';
  resultArea.replaceChildren();
  byId('empty-result').hidden = false;
  byId('copy-fallback').hidden = true;
  byId('report-text').value = '';
  copy.disabled = true;
  copy.textContent = t.copy;
  copy.removeAttribute('aria-busy');
  error.hidden = true;
  error.textContent = '';
  for (const input of form.querySelectorAll('[aria-invalid]')) {
    input.removeAttribute('aria-invalid');
    const ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== 'form-error');
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  }
  for (const line of items.querySelectorAll('[data-line]')) { line.hidden = true; line.textContent = ''; }
}

function invalidate() {
  state.invalidate();
  clearOutput();
  status.textContent = t.edited;
}

function updateRows() {
  const rows = [...items.children];
  byId('item-count').textContent = `${rows.length} / 30`;
  byId('add-item').disabled = rows.length >= 30;
  rows.forEach((row, index) => {
    row.querySelector('legend').textContent = t.row(index + 1);
    row.querySelector('[data-remove]').setAttribute('aria-label', `${t.remove} ${t.row(index + 1)}`);
    row.querySelector('[data-remove]').disabled = rows.length === 1;
  });
}

function addRow(focus = true) {
  if (items.children.length >= 30) { status.textContent = t.limit; return; }
  const row = byId('item-template').content.firstElementChild.cloneNode(true);
  const sequence = ++rowSequence;
  for (const field of ['name', 'price', 'quantity']) {
    const input = row.querySelector(`[data-field="${field}"]`);
    input.id = `item-${sequence}-${field}`;
    const label = row.querySelector(`[data-label="${field}"]`);
    label.htmlFor = input.id;
    label.querySelector('span').textContent = t[field];
  }
  row.querySelector('[data-remove]').textContent = t.remove;
  items.append(row);
  updateRows();
  if (focus) row.querySelector('[data-field="name"]').focus();
}

function draft() {
  return {
    items: [...items.children].map(row => Object.fromEntries(['name', 'price', 'quantity'].map(field => [field, row.querySelector(`[data-field="${field}"]`).value]))),
    percentOff: byId('percentOff').value, fixedCoupon: byId('fixedCoupon').value,
    freeShippingThreshold: byId('freeShippingThreshold').value, thresholdBasis: byId('thresholdBasis').value,
    shipping: byId('shipping').value,
    addOn: byId('addOnEnabled').checked ? { name: byId('addOnName').value, price: byId('addOnPrice').value } : null
  };
}

function showError(problem) {
  const row = problem.row === null ? null : items.children[problem.row - 1];
  let target = row ? row.querySelector(`[data-field="${problem.field}"]`) : byId(problem.field);
  if (problem.field === 'addOn') {
    const name = byId('addOnName').value;
    target = !name.trim() || name.length > 256 || name.trim().length > 80 || /[\u0000-\u001f\u007f-\u009f]/.test(name.trim()) ? byId('addOnName') : byId('addOnPrice');
  }
  target ??= items.querySelector('input');
  error.textContent = `${problem.row === null ? '' : `${t.row(problem.row)}: `}${t.errors[problem.code]} ${t.fix}`;
  error.hidden = false;
  target.setAttribute('aria-invalid', 'true');
  target.setAttribute('aria-describedby', `${target.getAttribute('aria-describedby') || ''} form-error`.trim());
  target.focus();
  status.textContent = '';
}

function renderScenario(value, key, title) {
  const section = element('section', undefined, 'scenario');
  section.dataset.scenario = key;
  section.append(element('h3', title));
  const lines = element('div', undefined, 'result-lines');
  for (const item of value.items) lines.append(element('p', `${item.name} · ${formatCents(item.unitPriceCents)} × ${item.quantity} = ${formatCents(item.lineCents)}`));
  section.append(lines);
  const dl = element('dl');
  for (const [label, amount, id, text] of scenarioEntries(value, t)) {
    const pair = element('div', undefined, `amount-row${text ? ' text-row' : ''}${id === 'total' ? ' final' : ''}`);
    const dd = element('dd', amount);
    dd.dataset.amount = id;
    pair.append(element('dt', label), dd);
    dl.append(pair);
  }
  section.append(dl);
  return section;
}

function render(value) {
  byId('empty-result').hidden = true;
  const scenarios = element('div', undefined, 'scenarios');
  scenarios.append(renderScenario(value.baseline, 'baseline', t.current));
  if (value.addOnScenario) scenarios.append(renderScenario(value.addOnScenario, 'addon', t.added));
  resultArea.append(scenarios);
  if (value.addOnScenario) {
    const difference = element('section', undefined, 'difference');
    const text = element('strong', differenceText(value.summary, t));
    text.id = 'difference-value';
    difference.append(element('h3', t.difference), text, element('p', `${t.addOnCost}: ${formatCents(value.summary.addOnPriceCents)} · ${t.included}`), element('p', t.compareHelp, 'help'));
    resultArea.append(difference);
  }
  [...items.children].forEach((row, index) => {
    const line = row.querySelector('[data-line]');
    line.hidden = false;
    line.textContent = `${t.line}: ${formatCents(value.items[index].lineCents)}`;
  });
  report = makeReport(value, t);
  copy.disabled = false;
  status.textContent = t.ready;
}

function clearAll(announce = true) {
  state.invalidate();
  clearOutput();
  items.replaceChildren();
  addRow(false);
  for (const id of ['percentOff', 'fixedCoupon', 'shipping']) byId(id).value = '0';
  for (const id of ['freeShippingThreshold', 'addOnName', 'addOnPrice']) byId(id).value = '';
  byId('thresholdBasis').value = 'post-discount';
  byId('addOnEnabled').checked = false;
  byId('add-on-fields').hidden = true;
  status.textContent = announce ? t.cleared : '';
}

form.addEventListener('input', invalidate);
form.addEventListener('change', () => {
  invalidate();
  byId('add-on-fields').hidden = !byId('addOnEnabled').checked;
});
form.addEventListener('compositionstart', invalidate);
items.addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button || button.disabled) return;
  invalidate();
  const row = button.closest('.item-row'), next = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  updateRows();
  next.querySelector('[data-field="name"]').focus();
});
byId('add-item').addEventListener('click', () => { invalidate(); addRow(); });
byId('clear').addEventListener('click', () => { clearAll(); items.querySelector('input').focus(); });
form.addEventListener('submit', event => {
  event.preventDefault();
  clearOutput();
  const ticket = state.begin();
  const result = calculateCart(draft());
  if (!state.commit(ticket, result)) return;
  if (result.ok) render(result.value);
  else showError(result.error);
});
copy.addEventListener('click', async () => {
  if (!state.getResult()) return;
  copy.disabled = true;
  copy.setAttribute('aria-busy', 'true');
  copy.textContent = t.copying;
  status.textContent = '';
  await copyReport({ state, text: report,
    write: navigator.clipboard?.writeText ? text => navigator.clipboard.writeText(text) : undefined,
    onSuccess() { copy.disabled = false; copy.removeAttribute('aria-busy'); copy.textContent = t.copy; status.textContent = t.copied; },
    onFallback(text) {
      copy.disabled = false; copy.removeAttribute('aria-busy'); copy.textContent = t.copy;
      status.textContent = t.fallback;
      byId('copy-fallback').hidden = false;
      const fallback = byId('report-text'); fallback.value = text; fallback.focus(); fallback.select();
    }
  });
});
window.addEventListener('pagehide', () => clearAll(false));
window.addEventListener('pageshow', event => { if (event.persisted) clearAll(false); });
clearAll(false);
