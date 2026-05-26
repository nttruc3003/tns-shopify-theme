(function () {
  'use strict';

  const MAX_FETCH = 250;
  const MAX_RESULTS = 60;
  const DEBOUNCE_MS = 250;

  document.querySelectorAll('[data-cfc-block]:not([data-cfc-initialized])').forEach(initBlock);

  function initBlock(root) {
    root.setAttribute('data-cfc-initialized', '1');

    const configEl = root.querySelector('[data-cfc-config]');
    if (!configEl) return;
    let config;
    try { config = JSON.parse(configEl.textContent); }
    catch (e) { console.warn('[cfc] invalid config JSON', e); return; }
    if (config.storefrontToken && typeof config.storefrontToken === 'object') {
      config.storefrontToken = config.storefrontToken.value || '';
    }
    if (!config.storefrontToken || !config.collectionHandle || !config.shopDomain) {
      console.warn('[cfc] missing required config');
      return;
    }

    const els = {
      trigger: root.querySelector('[data-cfc-trigger]'),
      triggerBody: root.querySelector('[data-cfc-trigger-body]'),
      triggerTitle: root.querySelector('[data-cfc-trigger-title]'),
      triggerTotal: root.querySelector('[data-cfc-trigger-total]'),
      inputWrap: root.querySelector('[data-cfc-input-wrap]'),
      input: root.querySelector('[data-cfc-input]'),
      clear: root.querySelector('[data-cfc-clear]'),
      inputs: root.querySelectorAll('[data-cfc-input]'),
      clears: root.querySelectorAll('[data-cfc-clear]'),
      panel: root.querySelector('[data-cfc-panel]'),
      sheetClose: root.querySelector('[data-cfc-close]'),
      sheetTotal: root.querySelector('[data-cfc-sheet-total]'),
      strip: root.querySelector('[data-cfc-strip]'),
      count: root.querySelector('[data-cfc-count]'),
      countNum: root.querySelector('[data-cfc-count-num]'),
      hideOOSWrap: root.querySelector('[data-cfc-hide-oos-wrap]'),
      hideOOS: root.querySelector('[data-cfc-hide-oos]'),
      oosCount: root.querySelector('[data-cfc-oos-count]'),
      listbox: root.querySelector('[data-cfc-listbox]'),
      footer: root.querySelector('[data-cfc-footer]'),
      footerText: root.querySelector('[data-cfc-footer-text]')
    };

    const panelOriginalParent = els.panel.parentNode;

    const state = {
      open: false,
      loaded: false,
      loading: false,
      query: '',
      debouncedQuery: '',
      hideOOS: false,
      highlight: -1,
      items: [],
      filtered: [],
      cart: {}
    };

    const endpoint = 'https://' + config.shopDomain + '/api/' + config.apiVersion + '/graphql.json';

    const COLL_QUERY =
      'query Family($handle: String!, $first: Int!, $after: String) {' +
        'collection(handle: $handle) {' +
          'products(first: $first, after: $after, sortKey: TITLE) {' +
            'pageInfo { hasNextPage endCursor }' +
            'edges { node {' +
              'id handle title availableForSale totalInventory onlineStoreUrl ' +
              'priceRange { minVariantPrice { amount currencyCode } } ' +
              'featuredImage { url altText } ' +
              'variants(first: 1) { edges { node { id quantityAvailable } } }' +
            '}}' +
          '}' +
        '}' +
      '}';

    function positionPanel() {
      if (window.innerWidth <= 768) {
        els.panel.style.top = '';
        els.panel.style.left = '';
        els.panel.style.width = '';
        els.panel.style.display = '';
        return;
      }
      const rect = els.trigger.getBoundingClientRect();
      els.panel.style.top = rect.bottom + 'px';
      els.panel.style.left = rect.left + 'px';
      els.panel.style.width = rect.width + 'px';
      els.panel.style.display = 'block';
    }

    function onResize() { positionPanel(); }
    function onScroll() { if (!isMobile()) positionPanel(); }

    function isMobile() { return window.innerWidth <= 768; }

    function open() {
      if (state.open) return;
      state.open = true;
      root.classList.add('is-open');
      els.trigger.setAttribute('aria-expanded', 'true');
      document.body.appendChild(els.panel);
      els.panel.classList.add('is-active');
      els.panel.hidden = false;
      if (!isMobile()) {
        els.triggerBody.hidden = true;
        els.inputWrap.hidden = false;
      } else {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      }
      requestAnimationFrame(positionPanel);
      setTimeout(() => {
        const visible = Array.from(els.inputs).find((i) => i.offsetParent !== null);
        if (visible) visible.focus();
      }, 50);
      if (!state.loaded && !state.loading) loadAll();
      document.addEventListener('mousedown', onOutside);
      document.addEventListener('keydown', onEsc);
      window.addEventListener('resize', onResize);
      window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    }

    function close() {
      if (!state.open) return;
      state.open = false;
      root.classList.remove('is-open');
      els.trigger.setAttribute('aria-expanded', 'false');
      els.panel.hidden = true;
      els.triggerBody.hidden = false;
      els.inputWrap.hidden = true;
      els.inputs.forEach((i) => { i.value = ''; });
      els.clears.forEach((c) => { c.hidden = true; });
      state.query = '';
      state.debouncedQuery = '';
      state.highlight = -1;
      els.panel.style.top = '';
      els.panel.style.left = '';
      els.panel.style.width = '';
      els.panel.style.display = '';
      els.panel.classList.remove('is-active');
      if (panelOriginalParent) panelOriginalParent.appendChild(els.panel);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, { capture: true });
    }

    function onOutside(e) {
      if (isMobile()) return;
      if (root.contains(e.target) || els.panel.contains(e.target)) return;
      close();
    }
    function onEsc(e) {
      if (e.key === 'Escape' && !isMobile()) close();
    }

    els.trigger.addEventListener('click', (e) => {
      if (e.target.closest('[data-cfc-clear]')) return;
      if (e.target.closest('[data-cfc-chev]')) {
        if (state.open) { close(); } else { open(); }
        return;
      }
      if (!state.open) open();
    });
    els.trigger.addEventListener('keydown', (e) => {
      if (state.open) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    if (els.sheetClose) els.sheetClose.addEventListener('click', close);

    let debTimer = null;
    els.inputs.forEach((input) => {
      input.addEventListener('input', () => {
        state.query = input.value;
        els.inputs.forEach((i) => { if (i !== input) i.value = state.query; });
        els.clears.forEach((c) => { c.hidden = !state.query; });
        clearTimeout(debTimer);
        debTimer = setTimeout(() => {
          state.debouncedQuery = state.query.trim();
          state.highlight = state.debouncedQuery ? 0 : -1;
          render();
        }, DEBOUNCE_MS);
      });
      input.addEventListener('keydown', onKeyDown);
    });

    els.clears.forEach((clear) => {
      clear.addEventListener('click', (e) => {
        e.stopPropagation();
        els.inputs.forEach((i) => { i.value = ''; });
        state.query = '';
        state.debouncedQuery = '';
        state.highlight = -1;
        els.clears.forEach((c) => { c.hidden = true; });
        render();
        const visible = Array.from(els.inputs).find((i) => i.offsetParent !== null);
        if (visible) visible.focus();
      });
    });

    if (els.hideOOS) {
      els.hideOOS.addEventListener('change', () => {
        state.hideOOS = els.hideOOS.checked;
        state.highlight = -1;
        render();
      });
    }

    function onKeyDown(e) {
      const max = state.filtered.length - 1;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.highlight = Math.min(max, state.highlight + 1);
        renderRows();
        scrollHighlightedIntoView();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.highlight = Math.max(0, state.highlight - 1);
        renderRows();
        scrollHighlightedIntoView();
      } else if (e.key === 'Enter') {
        const pick = state.filtered[state.highlight];
        if (pick && pick.inStock) {
          window.location.href = pick.url;
        }
      }
    }

    function scrollHighlightedIntoView() {
      const row = els.listbox.querySelector('.cfc__row.is-highlight');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }

    async function loadAll() {
      state.loading = true;
      try {
        const items = [];
        let after = null;
        let hasNext = true;
        while (hasNext) {
          const r = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': config.storefrontToken
            },
            body: JSON.stringify({
              query: COLL_QUERY,
              variables: { handle: config.collectionHandle, first: MAX_FETCH, after }
            })
          });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const json = await r.json();
          if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
          const conn = json.data && json.data.collection && json.data.collection.products;
          if (!conn) throw new Error('No data');
          conn.edges.forEach((e) => items.push(normalize(e.node)));
          hasNext = conn.pageInfo.hasNextPage;
          after = conn.pageInfo.endCursor;
        }
        state.items = items;
        state.loaded = true;
        const oos = items.filter((i) => !i.inStock).length;
        if (oos > 0 && els.hideOOSWrap) {
          els.hideOOSWrap.hidden = false;
          if (els.oosCount) els.oosCount.textContent = oos;
        }
        refreshCart();
        render();
      } catch (err) {
        console.error('[cfc] load failed', err);
        els.listbox.innerHTML =
          '<li class="cfc__row cfc__row--empty">Could not load shades. <a href="' +
          escapeAttr(config.familyUrl) + '">Browse the family →</a></li>';
        els.listbox.setAttribute('aria-busy', 'false');
      } finally {
        state.loading = false;
      }
    }

    function normalize(node) {
      const gidNum = (id) => String(id).split('/').pop();
      const variant = node.variants.edges[0] && node.variants.edges[0].node;
      const numMatch = node.title.match(/#\s*([A-Za-z0-9]+)/);
      const number = numMatch ? numMatch[1] : '';
      let name = node.title;
      if (numMatch) {
        name = node.title.replace(numMatch[0], '').trim();
      }
      const price = node.priceRange && node.priceRange.minVariantPrice
        ? parseFloat(node.priceRange.minVariantPrice.amount)
        : null;
      return {
        id: gidNum(node.id),
        variantId: variant ? gidNum(variant.id) : null,
        handle: node.handle,
        url: '/products/' + node.handle,
        title: node.title,
        number,
        name,
        image: node.featuredImage && node.featuredImage.url,
        alt: (node.featuredImage && node.featuredImage.altText) || node.title,
        inStock: !!node.availableForSale,
        stock: variant && typeof variant.quantityAvailable === 'number' ? variant.quantityAvailable : null,
        price,
        currency: node.priceRange && node.priceRange.minVariantPrice
          ? node.priceRange.minVariantPrice.currencyCode : 'USD'
      };
    }

    function filterAndRank() {
      const q = state.debouncedQuery.toLowerCase();
      let arr = state.items;
      if (state.hideOOS) arr = arr.filter((i) => i.inStock);
      if (!q) return arr;
      const scored = [];
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        const num = (it.number || '').toLowerCase();
        const name = (it.name || '').toLowerCase();
        let score = 99;
        if (num && num.indexOf(q) === 0) score = 0;
        else if (num && num.indexOf(q) > -1) score = 1;
        else if (name.indexOf(q) === 0) score = 2;
        else if (name.indexOf(q) > -1) score = 3;
        if (score < 99) scored.push({ it, score });
      }
      scored.sort((a, b) => a.score - b.score);
      return scored.map((x) => x.it);
    }

    async function refreshCart() {
      try {
        const r = await fetch('/cart.js', { credentials: 'same-origin' });
        if (!r.ok) return;
        const cart = await r.json();
        const map = {};
        (cart.items || []).forEach((it) => {
          const pid = String(it.product_id);
          map[pid] = (map[pid] || 0) + it.quantity;
        });
        state.cart = map;
        if (state.loaded) renderRows();
      } catch (e) { /* ignore */ }
    }

    const debouncedCartRefresh = debounce(refreshCart, 250);
    ['focus', 'pageshow'].forEach((ev) => window.addEventListener(ev, debouncedCartRefresh));
    const origFetch = window.fetch;
    window.fetch = function (input) {
      const p = origFetch.apply(this, arguments);
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (/\/cart\/(add|change|update|clear)/.test(url)) {
        p.then(() => debouncedCartRefresh()).catch(() => {});
      }
      return p;
    };

    function render() {
      state.filtered = filterAndRank();
      renderCount();
      renderRows();
      renderFooter();
    }

    function renderCount() {
      if (!els.count) return;
      const total = state.filtered.length;
      if (state.debouncedQuery) {
        els.count.innerHTML = '<strong>' + total + '</strong> match' +
          (total === 1 ? '' : 'es') + ' for ' +
          '<span class="cfc__strip-query">"' + escapeHTML(state.debouncedQuery) + '"</span>';
      } else {
        els.count.innerHTML = 'Browsing all <strong>' + total.toLocaleString() + '</strong> shades';
      }
    }

    function renderRows() {
      els.listbox.setAttribute('aria-busy', state.loading ? 'true' : 'false');
      if (state.loading) return;

      if (!state.filtered.length) {
        els.listbox.innerHTML =
          '<li class="cfc__row cfc__row--empty">' +
            'No shades match <strong>"' + escapeHTML(state.debouncedQuery) + '"</strong>.' +
            '<button type="button" class="cfc__empty-clear" data-cfc-empty-clear>' +
              'Clear and browse all ' + state.items.length +
            '</button>' +
          '</li>';
        const btn = els.listbox.querySelector('[data-cfc-empty-clear]');
        if (btn) btn.addEventListener('click', () => {
          els.inputs.forEach((i) => { i.value = ''; });
          state.query = '';
          state.debouncedQuery = '';
          state.highlight = -1;
          els.clears.forEach((c) => { c.hidden = true; });
          render();
          const visible = Array.from(els.inputs).find((i) => i.offsetParent !== null);
          if (visible) visible.focus();
        });
        return;
      }

      const slice = state.filtered.slice(0, MAX_RESULTS);
      els.listbox.innerHTML = slice.map((it, i) => renderRow(it, i)).join('');
    }

    function renderRow(item, idx) {
      const isCurrent = String(item.id) === String(config.currentProductId);
      const isHighlight = idx === state.highlight;
      const cartQty = state.cart[item.id] || 0;
      const inCart = cartQty > 0;
      const oos = !item.inStock;
      const low = !oos && typeof item.stock === 'number' && item.stock > 0 && item.stock <= 6;

      const cls = ['cfc__row'];
      if (isCurrent) cls.push('is-current');
      if (isHighlight) cls.push('is-highlight');
      if (oos) cls.push('is-oos');

      const img = item.image
        ? '<img src="' + escapeAttr(addImgWidth(item.image, 96)) + '" alt="' + escapeAttr(item.alt) + '" loading="lazy" decoding="async" width="28" height="28">'
        : '';

      const numberHtml = item.number
        ? '<span class="cfc__row-number">' + highlight('#' + item.number, state.debouncedQuery) + '</span>'
        : '';
      const nameHtml = '<span class="cfc__row-name">' + highlight(item.name, state.debouncedQuery) + '</span>';

      let stockHtml;
      if (oos) {
        stockHtml = '<span class="cfc__row-stock is-sale">Sold out</span>';
      } else if (low) {
        stockHtml = '<span class="cfc__row-stock is-warn">Only ' + item.stock + ' left</span>';
      } else if (typeof item.stock === 'number') {
        stockHtml = '<span class="cfc__row-stock">' + item.stock + ' in stock</span>';
      } else {
        stockHtml = '<span class="cfc__row-stock">In stock</span>';
      }

      const priceHtml = item.price != null
        ? ' <span class="cfc__row-dot"></span> $' + item.price.toFixed(2)
        : '';

      const cartPill = inCart
        ? '<span class="cfc__row-pill" title="' + cartQty + ' in cart">' +
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/>' +
            '</svg>' + cartQty + ' in cart</span>'
        : '';
      const checkMark = isCurrent
        ? '<span class="cfc__row-check" aria-label="Current">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 5 5L20 6"/></svg>' +
          '</span>'
        : '';

      const href = oos ? 'javascript:void(0)' : item.url;
      const tag = oos ? 'div' : 'a';
      const hrefAttr = oos ? '' : ' href="' + escapeAttr(href) + '"';

      return (
        '<li class="' + cls.join(' ') + '" role="option" aria-selected="' + (isCurrent ? 'true' : 'false') + '"' +
            (oos ? ' aria-disabled="true"' : '') + ' data-cfc-row="' + idx + '">' +
          '<' + tag + hrefAttr + ' class="cfc__row-link">' +
            '<span class="cfc__row-swatch">' +
              img +
              (oos ? '<span class="cfc__row-slash" aria-hidden="true"></span>' : '') +
            '</span>' +
            '<span class="cfc__row-text">' +
              '<span class="cfc__row-top">' + numberHtml + nameHtml + '</span>' +
              '<span class="cfc__row-bottom">' + stockHtml + priceHtml + '</span>' +
            '</span>' +
            '<span class="cfc__row-right">' + cartPill + checkMark + '</span>' +
          '</' + tag + '>' +
        '</li>'
      );
    }

    els.listbox.addEventListener('mouseover', (e) => {
      const row = e.target.closest('[data-cfc-row]');
      if (!row) return;
      const idx = parseInt(row.getAttribute('data-cfc-row'), 10);
      if (idx === state.highlight) return;
      state.highlight = idx;
      els.listbox.querySelectorAll('.is-highlight').forEach((r) => r.classList.remove('is-highlight'));
      row.classList.add('is-highlight');
    });

    function renderFooter() {
      if (!els.footer) return;
      const total = state.filtered.length;
      if (total > MAX_RESULTS) {
        els.footer.hidden = false;
        els.footerText.textContent = 'Showing ' + MAX_RESULTS + ' of ' + total + '. Refine your search to see more.';
      } else {
        els.footer.hidden = true;
      }
    }

    function highlight(text, q) {
      if (!q) return escapeHTML(text);
      const lower = text.toLowerCase();
      const i = lower.indexOf(q.toLowerCase());
      if (i === -1) return escapeHTML(text);
      return escapeHTML(text.slice(0, i)) +
        '<mark>' + escapeHTML(text.slice(i, i + q.length)) + '</mark>' +
        escapeHTML(text.slice(i + q.length));
    }

    function debounce(fn, ms) {
      let t;
      return function () {
        const args = arguments;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
      };
    }
    function escapeHTML(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }
    function escapeAttr(s) { return escapeHTML(s); }
    function addImgWidth(url, w) {
      if (!url) return '';
      try { const u = new URL(url); u.searchParams.set('width', w); return u.toString(); }
      catch (e) { return url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + w; }
    }
  }
})();
