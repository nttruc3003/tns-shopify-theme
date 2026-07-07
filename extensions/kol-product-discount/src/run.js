// @ts-check
import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
 * @typedef {import('../generated/api').CartInput} CartInput
 * @typedef {import('../generated/api').CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeKolId(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizePercent(value) {
  var percent = Number(value);
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) return 0;
  return percent;
}

/**
 * @param {CartInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.discount.discountClasses.includes(DiscountClass.Product)) {
    return { operations: [] };
  }

  var kolId = normalizeKolId(input.cart.attribute?.value);
  if (!kolId) {
    return { operations: [] };
  }

  var candidates = [];

  for (var line of input.cart.lines) {
    if (line.merchandise.__typename !== 'ProductVariant') continue;

    var currentPrice = Number(line.cost.amountPerQuantity.amount);
    var compareAtPrice = Number(line.cost.compareAtAmountPerQuantity?.amount || 0);
    if (compareAtPrice > currentPrice) continue;

    var rules = line.merchandise.product?.metafield?.jsonValue;
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) continue;

    var percent = normalizePercent(rules[kolId]);
    if (!percent) continue;

    candidates.push({
      message: 'KOL discount - ' + kolId,
      targets: [
        {
          cartLine: {
            id: line.id,
          },
        },
      ],
      value: {
        percentage: {
          value: percent,
        },
      },
    });
  }

  if (candidates.length === 0) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}

