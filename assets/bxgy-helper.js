(() => {
  let busy = false;
  let renderTimer = null;

  const slots = () => Array.from(document.querySelectorAll('[data-bxgy-slot]'));

  async function getCart() {
    const res = await fetch(`${window.Shopify.routes.root}cart.js`, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error('Cannot load cart');
    return res.json();
  }

  function getRules(slot) {
    const jsonEl = slot.querySelector('[data-bxgy-rules-json]');
    if (!jsonEl) return [];

    try {
      const parsed = JSON.parse(jsonEl.textContent.trim() || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('BXGY JSON parse error:', error);
      return [];
    }
  }

  function getQtyByProduct(cart, productId) {
    return cart.items
      .filter(item => Number(item.product_id) === Number(productId))
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  function getState(rule, qty) {
    const buy = Number(rule.buyQty);
    const free = Number(rule.freeQty);
    const cycleTotal = buy + free;

    if (!qty || qty <= 0) return null;

    const claimedCycles = Math.floor(qty / cycleTotal);
    const unlockedCycles = Math.floor((qty + free) / cycleTotal);

    if (unlockedCycles > claimedCycles) {
      const missingToClaim = (unlockedCycles * cycleTotal) - qty;

      return {
        type: 'claim',
        message: `You unlocked ${free} free items.<br>Add ${missingToClaim} more items to claim them.`,
        addQty: missingToClaim,
        freeVariantId: Number(rule.freeVariantId)
      };
    }

    const nextUnlockThreshold = ((claimedCycles + 1) * buy) + (claimedCycles * free);
    const missingToUnlock = nextUnlockThreshold - qty;

    if (claimedCycles === 0) {
      return {
        type: 'progress',
        message: `Add ${missingToUnlock} more items to unlock ${free} free items.`,
        addQty: 0
      };
    }

   return {
  type: 'progress',
  message: `${claimedCycles * free} free items added to cart.<br>Add ${missingToUnlock} more items to unlock another ${free} free items.`,
  addQty: 0
};
  }

  function cardHtml(state) {
    if (!state) return '';

    if (state.type === 'claim') {
      return `
        <div class="bxgy-card">
          <div class="bxgy-card__text">${state.message}</div>
          <button
            type="button"
            class="button bxgy-card__button"
            data-bxgy-add="${state.addQty}"
            data-bxgy-variant="${state.freeVariantId}">
            Claim ${state.addQty} Free Items
          </button>
        </div>
      `;
    }

    return `
      <div class="bxgy-card">
        <div class="bxgy-card__text">${state.message}</div>
      </div>
    `;
  }

  async function renderAll() {
    const allSlots = slots();
    if (!allSlots.length) return;

    try {
      const cart = await getCart();

      allSlots.forEach(slot => {
        const root = slot.querySelector('[data-bxgy-root]');
        if (!root) return;

        const rules = getRules(slot);
        if (!rules.length) {
          root.innerHTML = '';
          root.style.display = 'none';
          return;
        }

        const html = rules
          .map(rule => {
            const qty = getQtyByProduct(cart, rule.productId);
            return cardHtml(getState(rule, qty));
          })
          .filter(Boolean)
          .join('');

        root.innerHTML = html;
        root.style.display = html ? '' : 'none';
      });
    } catch (error) {
      console.error(error);
    }
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderAll, 120);
  }

  async function addItems(variantId, qty) {
    if (busy || !variantId || !qty) return;
    busy = true;

    try {
      const res = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          items: [
            {
              id: Number(variantId),
              quantity: Number(qty)
            }
          ]
        })
      });

      if (!res.ok) throw new Error('Add to cart failed');

      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('Could not add the free items. Please try again.');
    } finally {
      busy = false;
    }
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-bxgy-add]');
    if (!btn) return;

    const qty = Number(btn.dataset.bxgyAdd || 0);
    const variantId = Number(btn.dataset.bxgyVariant || 0);

    addItems(variantId, qty);
  });

  document.addEventListener('DOMContentLoaded', scheduleRender);
  document.addEventListener('cart:updated', scheduleRender);
  document.addEventListener('ajaxProduct:added', scheduleRender);

  const observer = new MutationObserver(() => {
    scheduleRender();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();