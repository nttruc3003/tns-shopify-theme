# Shopify Theme Codebase Summary

## Overview

This repository is a Shopify Online Store 2.0 theme based on **Ella 6.7.0** by HaloThemes.

- Base theme info lives in `config/settings_schema.json`.
- The store-specific implementation is heavily customized on top of Ella.
- There is no frontend build system here. Assets are edited directly as Liquid, CSS, and JS files.
- Runtime behavior is driven by:
  - Liquid templates and snippets
  - Theme Editor JSON templates
  - Global browser variables injected from Liquid
  - Large theme JS files in `assets/`

## Repo Structure

- `layout/`
  - Global page shells.
  - `layout/theme.liquid` is the main storefront entry point.
  - `layout/password.liquid` is the password page shell.

- `templates/`
  - Shopify OS 2.0 JSON templates define which sections render for each page type.
  - Examples:
    - `templates/index.json`
    - `templates/product.json`
    - `templates/collection.json`
    - `templates/page.kol_*.json`

- `sections/`
  - Theme sections used by templates.
  - Includes:
    - page-type sections like `main-product.liquid`, `main-collection-product-grid.liquid`
    - reusable homepage/editor sections like slideshow, featured collection, newsletter, etc.
  - Header/footer groups are JSON-based:
    - `sections/header-group.json`
    - `sections/footer-group.json`

- `snippets/`
  - Reusable Liquid partials.
  - This theme is snippet-heavy; much of the actual product/collection markup lives here.

- `assets/`
  - Raw CSS and JS assets.
  - No bundler or module pipeline detected.

- `config/`
  - `settings_schema.json`: theme settings definition
  - `settings_data.json`: current configured values from the Theme Editor

## Main Entry Flow

### 1. Global page shell

`layout/theme.liquid` is the main entry point.

Key responsibilities:

- Renders shared head content:
  - `meta-tags`
  - `content_for_header`
  - `variable`
  - `global-style`
  - `global-script`
- Computes body classes from theme settings
- Renders:
  - `header-group`
  - `wrapper-header`
  - `content_for_layout`
  - `footer-group`
  - `halo-toolbar-mobile`
  - `halo-popup`
  - `halo-sidebar`
- Loads:
  - `global-script-2`
  - optional `custom.js`
  - `bxgy-helper.js`
- Injects KOL / affiliate cart attribute logic

Important file:

- `layout/theme.liquid`

### 2. Template JSON selects sections

Shopify OS 2.0 templates map each page type to sections.

Examples:

- `templates/product.json`
  - uses `main-product`
- `templates/collection.json`
  - uses `main-collection-banner`
  - uses `main-collection-product-grid`
- `templates/index.json`
  - defines homepage composition and block data

This means page composition is mostly controlled by JSON templates plus section schemas, not by a single hardcoded file.

### 3. Sections select layout variants

Several `main-*` sections do not contain the full page markup themselves. Instead, they choose a layout variant and then render a snippet.

Examples:

- `sections/main-product.liquid`
  - switches based on `settings.product_page_layout`
  - renders one of:
    - `product-page`
    - `product-page-full-width`
    - `product-page-full-width-2`
    - `product-page-gallery`
    - `product-page-left-thumbs`
    - `product-page-right-thumbs`
    - `product-page-left-right-sidebar`
    - `product-page-horizontal-tabs-no-sidebar`

- `sections/main-collection-product-grid.liquid`
  - switches based on `settings.collection_layout`
  - renders one of:
    - `collection-product-grid`
    - `collection-express-order`
    - `collection-full-width`
    - `collection-masonry`
    - `collection-right-sidebar`
    - `collection-banner-adv`

### 4. Snippets render the real UI

Most of the detailed storefront markup is implemented in snippets.

This is especially true for:

- product cards
- product page components
- collection layouts
- quick view / quick shop
- sidebars
- header and footer parts

## Header / Footer Architecture

Header and footer are section groups rather than one fixed Liquid file.

### Header

Configured in:

- `sections/header-group.json`

Current header group contains section/block types such as:

- announcement bar
- main menu
- logo
- header icons
- multiple megamenu styles

### Footer

Configured in:

- `sections/footer-group.json`

Current footer group contains:

- newsletter section
- footer text block
- multiple link list blocks
- footer bottom block

Practical implication:

- Structural header/footer changes may need to happen in the section group JSON or in the relevant section/snippet files, not just one layout file.

## Global JS Runtime Contract

`snippets/global-script.liquid` is a critical file.

It loads shared JS assets:

- `vendor.js`
- `global.js`
- `lazysizes.min.js`
- optional `predictive-search.js`
- optional `animations.js`

It also injects many `window.*` globals used across the theme:

- `window.routes`
- `window.money_format`
- `window.shop_currency`
- `window.show_multiple_currencies`
- `window.quick_view`
- `window.quick_shop`
- `window.quick_cart`
- `window.cartStrings`
- `window.variantStrings`
- `window.quickOrderListStrings`
- `window.inventory_text`
- `window.free_shipping_text`
- `window.notify_me`
- `window.compare`
- `window.wishlist`
- `window.pagination`
- `window.countdown`

Practical implication:

- A lot of the JS assumes global browser state set by Liquid.
- This is not a modern module-based frontend.
- Changes to Liquid config can affect many JS features at once.

## Main Frontend JS Files

### `assets/global.js`

Contains general helpers and Shopify compatibility utilities.

Examples:

- focus trap helpers
- debounce / throttle helpers
- fetch config helper
- Shopify utility methods like:
  - `Shopify.bind`
  - `Shopify.postLink`
  - `Shopify.CountryProvinceSelector`

### `assets/theme.js`

This is one of the main runtime behavior files.

It defines a large `halo` object and initializes most of the theme’s interactive behavior.

Observed responsibilities include:

- quick cart
- quick shop
- quick view
- product tabs
- wishlist / compare wiring
- header behavior
- live chat hooks
- countdowns
- lookbook behavior
- product page init
- cart-related UI handling

This file appears to be central to the theme’s behavior model.

### Other important JS files

- `assets/variants.js`
  - product variant behavior
- `assets/collection-filters-form.js`
  - collection filtering, sidebar state, AJAX refresh
- `assets/cart.js`
  - cart UI behavior
- `assets/predictive-search.js`
  - predictive search UI
- `assets/bxgy-helper.js`
  - BXGY cart/promo logic
- `assets/recently-viewed-product.js`
  - recently viewed product behavior

Many components use custom elements, for example:

- `collection-filters-form`
- `price-range`
- `pickup-availability`
- `predictive-search`
- `customer-addresses`
- `deferred-media`
- `customer-language-currency`

## Product Page Architecture

Primary entry points:

- `templates/product.json`
- `sections/main-product.liquid`

The product page is layout-driven from theme settings, then rendered via large snippets.

The active `templates/product.json` contains many product blocks such as:

- breadcrumb
- title
- short description
- variant picker
- variant description
- meta
- price
- info
- hot stock
- countdown
- quantity selector
- perks
- buy buttons
- customer viewing
- pickup availability
- trust image
- description
- custom tabs

Important theme behavior:

- product UI is highly configurable in JSON and section schema
- product content uses many snippets and metafields
- quick view / variant logic is reused across product-card and PDP contexts

## Collection Page Architecture

Primary entry points:

- `templates/collection.json`
- `sections/main-collection-banner.liquid`
- `sections/main-collection-product-grid.liquid`

The collection area supports multiple layout variants:

- default grid
- express order
- full width
- masonry
- right sidebar
- banner advanced

The active collection template includes:

- banner section
- product grid section
- recently viewed products section

The collection grid section schema includes:

- sidebar enable/disable
- sidebar collapse style
- sticky sidebar
- sidebar layout
- filter behavior
- toolbar options
- sorting
- items per page
- infinite scroll / show more
- inline collection banners
- product spacing controls

This theme supports AJAX collection filtering and stateful UI behavior through JS in `assets/collection-filters-form.js`.

## Homepage Architecture

Primary entry point:

- `templates/index.json`

The homepage is assembled entirely through JSON section and block data.

Observed content types include:

- slideshow / hero content
- image banners
- featured products / collections
- brand/logo content
- newsletter content
- social/Instagram-related blocks

This means homepage changes are often best understood by reading `templates/index.json` plus the corresponding section files.

## Store-Specific Customizations

This repo is not just a stock Ella theme. There are clear custom business-specific additions.

### 1. KOL / subdomain tracking

Custom KOL logic appears in:

- `snippets/kol-tracking.liquid`
- `layout/theme.liquid`

Behavior observed:

- Reads the current subdomain under `teamnailsupply.com`
- Stores KOL identifiers in cookies such as:
  - `kol_first`
  - `kol_last`
  - `kol_ts`
- Syncs cart attributes through `/cart/update.js`
- Also writes attributes like:
  - `kol_id`
  - `kol_first`
  - `kol_last`
  - `kol_host`

### 2. Affiliate mapping by hostname

`layout/theme.liquid` contains an inline `affiliateMap` keyed by subdomain hostnames such as:

- `hoaitam.teamnailsupply.com`
- `rockydinh.teamnailsupply.com`
- `quangdo.teamnailsupply.com`
- `thuannguyen.teamnailsupply.com`
- `nhanly.teamnailsupply.com`
- `khangduong.teamnailsupply.com`
- `cherrybynails.teamnailsupply.com`
- `toannguyen.teamnailsupply.com`
- `yaoyao.teamnailsupply.com`
- `henry.teamnailsupply.com`
- `loinguyen.teamnailsupply.com`

When matched, the theme writes the cart attribute:

- `affiliate`

### 3. Subdomain-specific redirect

`layout/theme.liquid` contains logic that redirects:

- `hoaitam.teamnailsupply.com/`

to:

- `/pages/hoai-tam`

This is important when testing homepage behavior or previewing through Shopify CLI.

### 4. KOL landing page templates

There are multiple page templates dedicated to KOL pages:

- `templates/page.kol_cherrybynails.json`
- `templates/page.kol_henry.json`
- `templates/page.kol_khangduong.json`
- `templates/page.kol_nhanly.json`
- `templates/page.kol_quangdo.json`
- `templates/page.kol_thuannguyen.json`
- `templates/page.kol_toannguyen.json`
- `templates/page.kol_yaoyao.json`

These likely support subdomain- or campaign-specific landing experiences.

## Metafield-Driven Product UI

A lot of product display behavior depends on `product.metafields.custom.*` and `variant.metafields.custom.*`.

Observed uses include:

- `custom_badge`
- `variant_color`
- `variant_image_group`
- `combined_products_listing`
- `combined_products_listing_name_color`
- `combined_products_listing_image`
- `product_variant_custom`
- `positive_vibes_almost_sold_out`
- `positive_vibes_recently_people_gave_review`
- `positive_vibes_top_best_seller`
- BXGY-related metafields

Practical implication:

- Theme rendering may appear broken or incomplete in a local context unless the relevant metafields exist in the Shopify store.

## App Block Presence

This theme is primarily theme-code driven, but there are at least some templates with app sections:

- `templates/product.template-horizontal-tabs.json`
- `templates/product.template-right-thumbs.json`

Those contain `"type": "apps"` blocks.

So app embeds/blocks are not the main architecture, but they are present in some template variants.

## Current Theme Settings Snapshot

From `config/settings_data.json`, current notable characteristics include:

- `layout_body`: `custom_width`
- fonts and typography are heavily customized
- `product_card_layout`: `03`
- `after_add_to_cart`: `quick_cart`
- `enable_layout_rtl`: `true`
- `show_quick_view`: `true`
- `show_quick_cart`: `false`
- `show_cart_shipping`: `true`
- various search, countdown, and recently viewed features enabled

Treat `settings_data.json` as generated state from the Theme Editor. Manual edits can be overwritten by Shopify.

## Known Workflow Notes

The repo already includes a local workflow note:

- `SHOPIFY_THEME_WORKFLOW.md`

It documents:

- store: `r31xps-0n.myshopify.com`
- theme IDs for live, draft, and development themes
- Shopify CLI commands for:
  - `theme list`
  - `theme pull`
  - `theme dev`
  - `theme push`
- notes about the homepage redirect affecting local preview

## Important Risks / Oddities

### 1. Duplicated `content_for_layout` behavior

Inside `layout/theme.liquid`, the `hoaitam` conditional branch appears to output `content_for_layout` multiple times.

That is unusual and should be reviewed carefully before editing redirect or KOL logic.

### 2. Heavy global coupling

This theme relies on:

- large global JS files
- injected `window.*` variables
- many interdependent snippets

So isolated UI changes can have side effects in:

- product cards
- quick view
- quick cart
- collection filters
- wishlist / compare
- product page behaviors

### 3. Theme Editor generated files

Files like:

- `config/settings_data.json`
- `templates/*.json`
- `sections/header-group.json`
- `sections/footer-group.json`

are often admin-generated or admin-updated. Manual edits may be overwritten by theme editor operations.

## Best Starting Points For Future Sessions

If the next session needs to work on a specific area, start here:

### Global shell / sitewide behavior

- `layout/theme.liquid`
- `snippets/global-script.liquid`
- `snippets/global-script-2.liquid`
- `assets/global.js`
- `assets/theme.js`

### Product page

- `templates/product.json`
- `sections/main-product.liquid`
- relevant `snippets/product-page*.liquid`
- `assets/variants.js`

### Collection page / filters

- `templates/collection.json`
- `sections/main-collection-product-grid.liquid`
- collection snippets
- `assets/collection-filters-form.js`
- `assets/toolbar.js`

### Homepage

- `templates/index.json`
- referenced homepage sections in `sections/`

### KOL / affiliate / subdomain logic

- `layout/theme.liquid`
- `snippets/kol-tracking.liquid`
- `templates/page.kol_*.json`

## Short Summary

This codebase is a customized Ella Shopify theme using standard OS 2.0 structure:

- JSON templates choose sections
- sections choose layout variants
- snippets render most HTML
- large raw JS files power interaction
- settings and page composition are strongly controlled by Shopify theme-editor data

The most custom business logic is around:

- KOL / affiliate subdomains
- cart attribute syncing
- metafield-driven product content
- campaign-specific KOL landing pages
