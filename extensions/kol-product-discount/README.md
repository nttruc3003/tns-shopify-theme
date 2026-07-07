# KOL Product Discount Function

This Shopify Discount Function enforces checkout discounts for KOL product rules stored in the product metafield `custom.kol_discounts`.

Create this product metafield definition in Shopify Admin:

- Namespace and key: `custom.kol_discounts`
- Type: JSON
- Owner: Product
- Validation: KOL IDs as object keys, percentage values from `1` to `100`

Metafield value example:

```json
{
  "kimphuong": 5,
  "rockydinh": 10
}
```

Runtime behavior:

- Reads the cart attribute `kol_id`.
- Reads each cart line product's `custom.kol_discounts` JSON metafield.
- Applies the matching percentage to eligible cart lines.
- Skips lines that already have a compare-at price greater than the current price.
- Returns product discount candidates only, using `ProductDiscountSelectionStrategy.All`.

After deploying this extension in a Shopify app, create an automatic discount for the function with product discount combinability disabled. Leave order and shipping combinability disabled unless the business decides otherwise.
