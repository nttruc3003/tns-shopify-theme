(function () {
  'use strict';

  document.querySelectorAll('[data-cf-block]:not([data-cf-initialized])').forEach(initBlock);

  function initBlock(root) {
    root.setAttribute('data-cf-initialized', '1');

    const configEl = root.querySelector('[data-cf-config]');
    if (!configEl) return;
    let config;
    try { config = JSON.parse(configEl.textContent); }
    catch (e) { return; }
    if (!config.storefrontToken || !config.collectionHandle || !config.shopDomain) return;

    const PAGE = config.pageSize || 20;
    const els = {
      grid: root.querySelector('[data-cf-grid]'),
      input: root.querySelector('[data-cf-input]'),
      clear: root.querySelector('[data-cf-clear]'),
      count: root.querySelector('[data-cf-count]'),
      total: root.querySelector('[data-cf-total]'),
      totalFoot: root.querySelector('[data-cf-total-foot]'),
      range: root.querySelector('[data-cf-range]'),
      pagination: root.querySelector('[data-cf-pagination]'),
      footer: root.querySelector('[data-cf-footer]'),
      toolbar: root.querySelector('[data-cf-toolbar]'),
      hideOOS: root.querySelector('[data-cf-hide-oos]'),
      oosCount: root.querySelector('[data-cf-oos-count]'),
      activeCart: root.querySelector('[data-cf-active-cart]'),
      activeCartQty: root.querySelector('[data-cf-active-cart-qty]'),
      inCartSummary: root.querySelector('[data-cf-in-cart-summary]')
    };

    const state = {
      query: '',
      page: 0,
      total: Number(config.familyTotal) || 0,
      items: [],
      loading: true,
      hideOOS: readPref('hideOOS') === '1',
      cart: {},
      familyHasOOS: false,
      pageCursors: { 0: null }
    };

    if (state.hideOOS && els.hideOOS) els.hideOOS.checked = true;

    const cache = sessionStoreFor(config.collectionHandle);
    const endpoint = `https://${config.shopDomain}/api/${config.apiVersion}/graphql.json`;

    const QUERY = `query Family($handle: String!, $first: Int!, $after: String, $q: String) {
      collection(handle: $handle) {
        products(first: $first, after: $after, query: $q, sortKey: TITLE) {
          pageInfo { hasNextPage endCursor }
          edges { cursor node {
            id handle title availableForSale totalInventory
            featuredImage { url altText }
            variants(first: 1) { edges { node { id quantityAvailable } } }
          }}
        }
      }
    }`;

    function buildQueryString(q, hideOOS) {
      const parts = [];
      if (q && q.trim()) {
        const safe = q.trim().replace(/[*"\\]/g, '');
        parts.push(`title:*${safe}*`);
      }
      if (hideOOS) parts.push('available_for_sale:true');
      return parts.join(' AND ') || null;
    }

    async function fetchPage(page, query, hideOOS) {
      const cacheKey = `${page}::${query}::${hideOOS ? 1 : 0}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      let after = state.pageCursors[page];
      if (after === undefined && page > 0) {
        for (let p = 0; p < page; p++) {
          if (state.pageCursors[p + 1] !== undefined) continue;
          const prev = await fetchPage(p, query, hideOOS);
          state.pageCursors[p + 1] = prev.endCursor;
        }
        after = state.pageCursors[page];
      }

      const variables = {
        handle: config.collectionHandle,
        first: PAGE,
        after: after || null,
        q: buildQueryString(query, hideOOS)
      };

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': config.storefrontToken
        },
        body: JSON.stringify({ query: QUERY, variables })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
      const coll = json.data && json.data.collection;
      if (!coll) throw new Error('Collection not found');

      const result = {
        items: coll.products.edges.map(e => normalize(e.node)),
        endCursor: coll.products.pageInfo.endCursor,
        hasNext: coll.products.pageInfo.hasNextPage
      };
      cache.set(cacheKey, result);
      state.pageCursors[page + 1] = result.endCursor;
      return result;
    }

    function normalize(node) {
      const gidNum = id => String(id).split('/').pop();
      const variant = node.variants.edges[0] && node.variants.edges[0].node;
      const productId = gidNum(node.id);
      const numMatch = node.title.match(/#\s*([A-Za-z0-9]+)/);
      const number = numMatch ? numMatch[1] : '';
      return {
        id: productId,
        variantId: variant ? gidNum(variant.id) : null,
        handle: node.handle,
        title: node.title,
        number,
        image: node.featuredImage && node.featuredImage.url,
        alt: node.featuredImage && node.featuredImage.altText,
        inStock: !!node.availableForSale,
        stock: variant && typeof variant.quantityAvailable === 'number' ? variant.quantityAvailable : null
      };
    }

    async function refreshCart() {
      try {
        const r = await fetch('/cart.js', { credentials: 'same-origin' });
        if (!r.ok) return;
        const cart = await r.json();
        const map = {};
        (cart.items || []).forEach(it => {
          const pid = String(it.product_id);
          map[pid] = (map[pid] || 0) + it.quantity;
        });
        state.cart = map;
        if (!state.loading) repaintCartBadges();
        renderActiveCart();
        renderHeaderInCart();
      } catch (e) { /* ignore */ }
    }

    const debouncedCartRefresh = debounce(refreshCart, 250);
    ['focus', 'pageshow'].forEach(ev => window.addEventListener(ev, debouncedCartRefresh));

    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      const p = origFetch.apply(this, arguments);
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (/\/cart\/(add|change|update|clear)/.test(url)) {
        p.then(() => debouncedCartRefresh()).catch(() => {});
      }
      return p;
    };

    function render() {
      renderGrid();
      renderCount();
      renderFooter();
      renderActiveCart();
      renderHeaderInCart();
    }

    function renderGrid() {
      els.grid.setAttribute('aria-busy', state.loading ? 'true' : 'false');
      if (state.loading) return;

      if (!state.items.length) {
        const q = state.query ? escapeHTML(state.query) : '';
        els.grid.innerHTML =
          '<li class="color-family-switcher__empty">' +
          (q
            ? 'No shades match &ldquo;' + q + '&rdquo; in ' + escapeHTML(config.familyName) + '.'
            : 'No shades in ' + escapeHTML(config.familyName) + '.') +
          '<br><a href="' + escapeAttr(config.familyUrl) + '">Browse all</a></li>';
        return;
      }

      els.grid.innerHTML = state.items.map(renderItem).join('');
    }

    function renderItem(item) {
      const isCurrent = String(item.id) === String(config.currentProductId);
      const cartQty = state.cart[item.id] || 0;
      const inCart = cartQty > 0;
      const oos = !item.inStock;
      const lowStock = !oos && item.stock != null && item.stock > 0 && item.stock <= 6;
      const cls = ['item-custom'];
      if (isCurrent) cls.push('current-item');
      if (oos) cls.push('out-of-stock');
      if (inCart) cls.push('in-cart');

      const img = item.image
        ? '<img class="item-custom--img" src="' + escapeAttr(addImgWidth(item.image, 160)) + '" alt="' + escapeAttr(item.alt || item.title) + '" loading="lazy" decoding="async" width="50" height="50">'
        : '';

      return (
        '<li class="' + cls.join(' ') + '">' +
        '<a class="item-custom--image" href="/products/' + encodeURIComponent(item.handle) + '" title="' + escapeAttr(item.title + (oos ? ' · Sold out' : '')) + '">' +
          '<span class="item-custom--inner">' +
            img +
            (oos ? '<span class="cf-oos-slash" aria-hidden="true"></span>' : '') +
            (inCart ? cartBadge(cartQty) : '') +
            (!inCart && lowStock ? '<span class="cf-low-dot" title="Low stock"></span>' : '') +
          '</span>' +
          '<span class="item-custom--label">' + (item.number ? '#' + escapeHTML(item.number) : escapeHTML(item.title)) + '</span>' +
          (oos ? '<span class="item-custom--oos">SOLD OUT</span>' : '') +
        '</a>' +
        '</li>'
      );
    }

    function cartBadge(qty) {
      return '<span class="cf-cart-badge" aria-label="' + qty + ' in cart">' +
        '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>' +
        qty + '</span>';
    }

    function repaintCartBadges() {
      if (!state.items.length) return;
      els.grid.innerHTML = state.items.map(renderItem).join('');
    }

    function renderActiveCart() {
      if (!els.activeCart) return;
      const qty = state.cart[String(config.currentProductId)] || 0;
      if (qty > 0) {
        els.activeCart.hidden = false;
        if (els.activeCartQty) els.activeCartQty.textContent = qty;
      } else {
        els.activeCart.hidden = true;
      }
    }

    function renderHeaderInCart() {
      if (!els.inCartSummary) return;
      const seen = new Set();
      cache.forEachItem(item => seen.add(String(item.id)));
      state.items.forEach(item => seen.add(String(item.id)));
      let n = 0;
      Object.keys(state.cart).forEach(id => {
        if (seen.has(id) && state.cart[id] > 0) n++;
      });
      if (n > 0) {
        els.inCartSummary.hidden = false;
        els.inCartSummary.textContent = ' · ' + n + ' in your cart';
      } else {
        els.inCartSummary.hidden = true;
        els.inCartSummary.textContent = '';
      }
    }

    function renderCount() {
      if (!els.count) return;
      if (state.loading) {
        els.count.textContent = 'Searching…';
        els.count.style.color = '#a48a73';
        return;
      }
      els.count.style.color = '';
      const total = state.total;
      els.count.textContent = total.toLocaleString() + ' ' + (total === 1 ? 'match' : 'matches');
    }

    function renderFooter() {
      if (!els.footer) return;
      if (state.loading || state.total <= PAGE) {
        els.footer.hidden = true;
        return;
      }
      els.footer.hidden = false;
      const start = state.page * PAGE + 1;
      const end = Math.min(state.total, (state.page + 1) * PAGE);
      if (els.range) els.range.textContent = start + '–' + end;
      if (els.totalFoot) els.totalFoot.textContent = state.total.toLocaleString();

      const totalPages = Math.max(1, Math.ceil(state.total / PAGE));
      const buttons = pageButtons(state.page, totalPages);

      els.pagination.innerHTML =
        '<button type="button" class="cf-page-btn" data-cf-prev ' + (state.page === 0 ? 'disabled' : '') + ' aria-label="Previous">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
        '</button>' +
        buttons.map(b => b === '…'
          ? '<span class="cf-page-dots">…</span>'
          : '<button type="button" class="cf-page-btn ' + (b === state.page ? 'is-active' : '') + '" data-cf-page="' + b + '">' + (b + 1) + '</button>'
        ).join('') +
        '<button type="button" class="cf-page-btn" data-cf-next ' + (state.page >= totalPages - 1 ? 'disabled' : '') + ' aria-label="Next">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</button>';
    }

    function pageButtons(cur, total) {
      if (total <= 5) return Array.from({ length: total }, (_, i) => i);
      const set = new Set([0, total - 1, cur, cur - 1, cur + 1]);
      const arr = [...set].filter(n => n >= 0 && n < total).sort((a, b) => a - b);
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        if (i > 0 && arr[i] - arr[i - 1] > 1) out.push('…');
        out.push(arr[i]);
      }
      return out;
    }

    let searchTimer = null;
    if (els.input) {
      els.input.addEventListener('input', () => {
        if (els.clear) els.clear.hidden = !els.input.value;
        state.loading = true;
        renderCount();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const q = els.input.value.trim();
          if (q === state.query) { state.loading = false; renderCount(); return; }
          state.query = q;
          state.page = 0;
          state.pageCursors = { 0: null };
          load();
        }, 300);
      });
      els.input.addEventListener('keydown', e => {
        if (e.key === 'Escape' && els.input.value) {
          els.input.value = '';
          if (els.clear) els.clear.hidden = true;
          state.query = '';
          state.page = 0;
          state.pageCursors = { 0: null };
          state.loading = true;
          renderCount();
          load();
        }
      });
    }

    if (els.clear) {
      els.clear.addEventListener('click', () => {
        els.input.value = '';
        els.clear.hidden = true;
        state.query = '';
        state.page = 0;
        state.pageCursors = { 0: null };
        state.loading = true;
        renderCount();
        load();
      });
    }

    if (els.hideOOS) {
      els.hideOOS.addEventListener('change', () => {
        state.hideOOS = els.hideOOS.checked;
        writePref('hideOOS', state.hideOOS ? '1' : '0');
        state.page = 0;
        state.pageCursors = { 0: null };
        state.loading = true;
        renderCount();
        load();
      });
    }

    if (els.pagination) {
      els.pagination.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn || btn.disabled) return;
        let next = state.page;
        if (btn.hasAttribute('data-cf-prev')) next = Math.max(0, state.page - 1);
        else if (btn.hasAttribute('data-cf-next')) next = state.page + 1;
        else if (btn.hasAttribute('data-cf-page')) next = parseInt(btn.getAttribute('data-cf-page'), 10);
        if (next === state.page) return;
        state.page = next;
        state.loading = true;
        renderCount();
        load();
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    async function load() {
      try {
        const result = await fetchPage(state.page, state.query, state.hideOOS);
        state.items = result.items;

        if (state.page === 0 && !state.query && !state.hideOOS) {
          state.total = Number(config.familyTotal) || state.items.length;
        } else {
          const minTotal = state.page * PAGE + state.items.length;
          state.total = result.hasNext ? Math.max(minTotal + 1, state.total) : minTotal;
        }

        if (state.page === 0 && !state.query && !state.hideOOS) {
          state.familyHasOOS = state.items.some(it => !it.inStock);
          if (els.toolbar) els.toolbar.hidden = !state.familyHasOOS;
        }

        if (els.total) els.total.textContent = state.total.toLocaleString();

        state.loading = false;
        render();
      } catch (err) {
        state.loading = false;
        els.grid.innerHTML =
          '<li class="color-family-switcher__empty">' +
          'Couldn\'t load shades. <a href="' + escapeAttr(config.familyUrl) + '">View all</a>.' +
          '</li>';
        renderCount();
      }
    }

    refreshCart().then(load);

    function debounce(fn, ms) {
      let t;
      return function () {
        const args = arguments;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
      };
    }
    function escapeHTML(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function escapeAttr(s) { return escapeHTML(s); }
    function addImgWidth(url, w) {
      if (!url) return '';
      try {
        const u = new URL(url);
        u.searchParams.set('width', w);
        return u.toString();
      } catch (e) {
        return url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
      }
    }

    function sessionStoreFor(handle) {
      const prefix = 'cf:' + handle + ':';
      return {
        get(key) {
          try {
            const v = sessionStorage.getItem(prefix + key);
            return v ? JSON.parse(v) : null;
          } catch (e) { return null; }
        },
        set(key, value) {
          try { sessionStorage.setItem(prefix + key, JSON.stringify(value)); } catch (e) { /* quota */ }
        },
        forEachItem(cb) {
          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const k = sessionStorage.key(i);
              if (!k || k.indexOf(prefix) !== 0) continue;
              const v = JSON.parse(sessionStorage.getItem(k));
              if (v && v.items) v.items.forEach(cb);
            }
          } catch (e) { /* ignore */ }
        }
      };
    }
    function readPref(k) {
      try { return sessionStorage.getItem('cf:pref:' + k); } catch (e) { return null; }
    }
    function writePref(k, v) {
      try { sessionStorage.setItem('cf:pref:' + k, v); } catch (e) { /* ignore */ }
    }
  }
})();
