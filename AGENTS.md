# AGENTS.md — ZUHA'S E-commerce Platform

This file is the source of truth for the project. Read it fully before every task. If anything in a request conflicts with this file, point out the conflict and ask which should take priority. Do not silently pick one.

---

## 1. Project Overview

ZUHA'S is a full-stack e-commerce clothing website with a customer storefront and an admin dashboard.

**Tech stack (do not deviate without asking):** Next.js, TypeScript, React, Tailwind CSS, Framer Motion, Supabase (Database + Storage + Auth).

---

## 2. Working Rules (MANDATORY)

- Build incrementally: one phase / one feature at a time, fully working and responsive, before moving to the next.
- Every page and component must be fully responsive on mobile, tablet, and desktop. This is mandatory, not optional.
- Follow the exact UI/UX behavior in this file (popup vs new page, hover behavior, animations, slider mechanics). Do not simplify or change it without asking.
- Do not invent extra features, pages, or fields that are not described here. Ask first.
- If a request is ambiguous, briefly confirm understanding instead of guessing.
- Keep the admin dashboard simple, clean, and easy to understand.
- Keep code clean and organized (clear folder structure, reusable components, typed with TypeScript).
- OpenCode is CLI-only. Verify work with `npm run build`, lint, and type-check. Do not ask for screenshots.
- NEVER push to GitHub, deploy, or run destructive database operations without explicit confirmation each time.

### Database & Environment Workflow

- **Migrations:** Write SQL migration files into `supabase/migrations/` with numbered names (e.g. `001_init_schema.sql`). After creating one, tell the user the exact file name. The user runs the SQL manually in the Supabase SQL Editor. Never run SQL against the database yourself.
- **service_role needs explicit grants:** RLS bypass does not bypass GRANT, and Supabase's "automatically expose new tables" default is off — so every new public table must be granted `select, insert, update, delete` to `service_role` (and `usage, select` on any new sequence) in its own migration, or admin writes fail with `permission denied for table ...`. Never widen `anon` / `authenticated` grants while doing so. See `008_service_role_table_grants.sql`.
- **`.env.local`:** Create it yourself with these variables and placeholder values, and tell the user which to fill in. Also create `.env.example`, and make sure `.env.local` is in `.gitignore`.
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never exposed to the client)
- Create Supabase Storage buckets via a migration or documented SQL as well, and give the user the file name.

---

## 3. Design System

- Base: white background, black text wherever text sits on white.
- Accent (wine-plum):
  - `--color-plum`: `#4a2040` (primary)
  - `--color-plum-dark`: `#3a1833` (hover / darker)
  - `--color-plum-light`: `#7a3570` (lighter)
- **Add to Cart** button: solid plum background, white text.
- **Buy It Now** button: white background, plum border and plum text by default. On hover it animates to a plum fill (like Add to Cart), and reverts to white on hover-out.
- Footer wordmark "Z U H A ' S": **on mobile (below `md`) it leads the footer at the top, centred, with a gap before the centred accordion; from `md` up it sits at the bottom**, centred directly above the copyright line, **black** (not plum), styled exactly like the navbar logo — same Playfair semibold, same wide letter spacing, ~1.3x the navbar size (36 / 44 / 50 / 57px against 28 / 34 / 38 / 44px) — and still a link to the homepage. It and the navbar logo are one definition in `src/lib/logo.ts` (`FOOTER_LOGO_CLASS` / `LOGO_CLASS`); do not give the footer its own style. The "Contact Us" and "Team Members" buttons sit in the footer's right-hand (newsletter) column, directly under the email signup box, as two equal-width buttons in one row (~12px apart, ~20-24px below the box), same width for both.
- Header logo (the navbar "Z U H A ' S", distinct from the footer wordmark): Playfair Display at **semibold** (weight built into the loaded variable font), with the same wide letter spacing, sized 28px mobile → 34px ≥640 → 38px ≥768 → 44px ≥1024 (~1.4x the old sizes). The navbar/header row is compact: 48px mobile, 59px tablet/desktop. In normal flow below the announcement bar (`h-10`), that puts the ticker-text-centre-to-logo-centre gap at ~43.2px mobile / ~49.6px desktop CSS pixels (the ~54px / ~62px figures in `docs/fix.txt` are device px). Do not change these heights — logo size and row height are tuned together.
- Storefront images: every `next/image` and `getImageProps` on storefront (customer-facing) code passes `quality` from `src/lib/images.ts` — `IMAGE_QUALITY` (95) everywhere, `IMAGE_QUALITY_MAX` (100) only for the full-screen viewer's zoomed picture. `next.config.ts` declares `images.qualities: [75, 95, 100]`; without a quality in every component, and every allowed value in that list, the optimizer silently serves 75. Admin screens keep their default quality.
- Fonts: **Playfair Display** (headings) + **Inter** (body), consistent across the whole site (editorial / clean fashion feel). **Quicksand 400** (light, thin, rounded geometric sans — normal weight, no uppercase, normal letter spacing, ~14px desktop / ~13px mobile) is loaded with `next/font/google` and used for the announcement ticker text **only**; no other text may use it.
- Plum may be used elsewhere in the UI where it fits, at discretion.

---

## 4. Storefront (Customer-Facing)

### 4.1 Homepage
- Top: announcement bar. Text only, single-line scrolling ticker, no background color, Quicksand 400 as above. Multiple announcements come from admin. The same ticker also sits above the navbar on **every storefront page** (all `(site)` pages plus the homepage): white background, black text, in normal flow so it never overlaps the navbar or the content, and it renders nothing (no empty gap) when there are no announcements. It is never shown in `/admin`.
- **Adaptive header color (homepage only, over the full-screen slider):** the announcement bar text, hamburger, "Z U H A ' S" logo and search/login/cart icons all share ONE color that changes with the active slide's image. The rule lives in `src/lib/header-tone.ts` and nowhere else: `HEADER_TONE_ON_LIGHT_IMAGE = "white"` and `HEADER_TONE_ON_DARK_IMAGE = "black"` — a **light** image gets a **white** header, a dark image gets a black one (relative luminance > 0.5 counts as light). The client measures the image actually displayed for the current viewport (desktop image on desktop/tablet, mobile image on phones with the existing fallback) with `crossOrigin="anonymous"`, draws it on a small offscreen canvas using the slide's "cover" crop, averages the top 160px strip, and caches one result per image URL. Failures (CORS, load errors) fall back to white. White until the first measurement lands; the switch is color-only with a ~300ms transition. On the footer slide the navbar hides and the announcement bar hides with it.
- Below it: navbar with no background. Left = hamburger icon, center = "Z U H A ' S" logo, right = search, login, cart icons. The bar and the navbar centres sit ~44px apart on mobile and ~49.5px on desktop CSS pixels (bar `h-10`, navbar `h-12` / `h-[59px]` — see the header-logo note in §3); logo and icons stay centered in the navbar row. **On mobile (below `md`) the login icon is not shown at all** (`display: none`, so it is not focusable): the row is a three-column grid with equal side columns — hamburger left, logo exactly centered, search and cart right — and the login icon appears only from `md` up, where the row is the original flex layout. Account stays reachable on every width through the hamburger menu, which is unchanged (Women's, Men's, Kid's, Bag's, Jewellery, Account, Wishlist). The navbar's inner container is `CONTENT_CONTAINER` in `src/lib/content-container.ts` — the same max width and horizontal padding as the listing/breadcrumb/grid container — so the hamburger, logo and cart edges line up with the page content on every `(site)` page and breakpoint, including the homepage overlay header. The cart and search panels hang off the same container.
- **No hero section.** Directly below the navbar is a full-screen category slider (stacked / cover-scroll animation, full-bleed images, no overlay text, right-side dot rail). It must be smooth on desktop wheel and keyboard and on mobile touch swipe. One swipe or gesture = one slide, with a clean landing every time.
- **Cover mechanics & dots:** the stack is a true cover — the next slide rises from below over the one that is showing, and going back up the showing slide slides back down to reveal the one already in place beneath it; the footer is the last slide in the same stack. A dot click **jumps straight to the target slide** as one cover animation (it does not step through the slides in between). All of this lives in `src/components/home/CategorySlider.tsx`.
- **Mobile slider performance (do not regress):** the header tone is measured once per image on a tiny (32px-wide) offscreen sample and **prefetched on idle after first paint**, so changing slides only reads a cached value instead of decoding an image and reading canvas pixels mid-transition (`src/lib/header-tone.ts` + `HomeExperience`). `will-change: transform` is set **only while a slide is animating** (never permanently on every full-screen layer); the subtle depth zoom on the covered slide is **disabled on coarse pointers** (`useCoarsePointer`); the current image plus its immediate neighbours are `decode()`d ahead of the next transition; every slide is `visibility: hidden` unless it is the active one or the one being covered; the slide components and the slider itself are memoised, so a slide change re-renders only the two slides the cover touches; and `next.config.ts` declares extra `deviceSizes` (including 1024/1440) so a large phone's `100vw` slide resolves below 1920px.
- **Dot rail:** same positions and sizes as always (right side, vertical), styled like the Sana Safinaz collection dots — **inactive dots white, active dot black**, static colors that deliberately do NOT follow the adaptive header color. Click/scroll behavior unchanged.
- Initial top-level categories: Women's, Men's, Kid's, Bag's, Jewellery. These are dynamic: admin can add or remove categories, and slides and dots update automatically.
- Each top-level category has TWO images: a Desktop Image and a Mobile Image (optional). Desktop and tablet screens show the Desktop image. Mobile screens show the Mobile image, and fall back to the Desktop image if no mobile image is set.
- After the last category slide, the **footer is the final slide** in the same stack (same full-screen cover-scroll treatment).
- The navbar stays visible/fixed on the homepage and all category slides, but hides on the footer slide.
- Clicking a category slide goes to that category's page: the sub-category page for Women's / Men's / Kid's, or straight to the product listing for Bag's / Jewellery.

### 4.2 Sub-Category Page (Women's / Men's / Kid's only)
- NOT a full-screen slide design. It is a horizontal side-scrolling row of circular cards.
- Desktop: multiple cards visible. Tablet: fewer. Mobile: 1 card at a time.
- Left/right arrow buttons on desktop and mobile.
- Each card: circular image + name underneath, nothing else.
- Clicking a sub-category (e.g. Casual) opens that sub-category's product listing.
- Bag's and Jewellery skip this page entirely.

### 4.3 Product Listing Page
Reference look: the Sana Safinaz collection page. Clean editorial layout, full-width grid, no permanent filter sidebar.

Top to bottom:
- **Breadcrumb row:** "HOME > WOMEN'S > CASUAL" (uppercase, small, ">" separators). HOME links to "/", the category links to `/category/[slug]`, the last crumb is plain text. Bag's/Jewellery stop at "HOME > BAG'S". There is **no** big page heading.
- **Toolbar row:** LEFT = a "Filter" button with a funnel icon (plus a count of active filters when any are applied). RIGHT = "N Items |" followed by a bordered dropdown (Newest, Price: Low to High, Price: High to Low; default Newest). There is deliberately **no visible "Sort By:" label** — the dropdown carries `aria-label="Sort by"`.
- **Grid:** full container width — the `CONTENT_CONTAINER` from `src/lib/content-container.ts` (max 1600px, side padding 16px mobile → ~96px desktop), shared with the navbar. Desktop 4 per row, tablet 3, mobile 2. Comfortable gaps (~24-38px desktop, 12-16px mobile).
- **Cards:** tall 2:3 portrait image (object-cover) with **square edges only** - no rounded corners, no border, no shadow anywhere on the card, image or badge. Content below the image is only the product name and the price. No sizes line.
- Discount: if a product has a discount price, show the original price with strikethrough next to the discounted price, plus an auto-calculated plum "X% OFF" badge on the image corner (square, white text).
- Desktop hover on a card reveals: wishlist (heart) icon, quick-view (eye) icon, and an "Add to Cart" option over the bottom of the image. Square styling, hidden on touch/mobile.
- **Filter panel:** the "Filter" button opens a slide-in drawer from the left (white, dimmed backdrop, close button, closes on backdrop click and Escape, page scroll locked while open; full-width on mobile, ~380px tablet/desktop). Inside: Price (min/max), Size chips, Color chips (unique values parsed from the listing), "Clear all" and "Apply". Edits are a draft - only "Apply" changes the grid.
- Spacing: the gap under the navbar is `main`'s `pt-6 md:pt-9` — it and the navbar row height are what put the logo-centre-to-breadcrumb-centre gap at ~74px CSS from tablet up (~93 device px). Do not widen `main`'s top padding to the old 48/64/80px. ~24px between breadcrumb and toolbar (the listing's `mt-6 lg:mt-8`), 32px between toolbar and grid. Touch targets at least 44px.

### 4.4 Quick View & Product Detail
- Eye icon opens a popup/modal on the same page: all product images, name, description, quantity selector, Add to Cart, Buy It Now.
- Below lg, on both the product detail page and the Quick View popup, the wishlist heart sits beside the product name in the same row (right-aligned, vertically aligned with the first line of the name), not at the bottom after Buy It Now.
- Clicking the card itself (not the eye) opens a separate full product detail page with the exact same content/layout as the quick-view popup (no differences).
- **Buy It Now** skips the cart and goes straight to checkout for that product.

### 4.5 Wishlist, Cart, Search
- Wishlist: heart icon saves a product. Reachable via "Wishlist" in the hamburger menu. The wishlist page uses the exact same layout as the product listing grid.
- Cart: Add to Cart increments a count badge on the navbar cart icon. Clicking the cart icon opens a popup/dropdown below the navbar (NOT a new page) showing items + a Checkout button.
- Search: clicking the search icon opens a popup/dropdown directly below the navbar (NOT a new page). Typing a product name shows matching products (image, name, price). Typing a category name shows matching categories.
- Hamburger menu contains exactly: Women's, Men's, Kid's, Bag's, Jewellery, Account, Wishlist. Women's / Men's / Kid's have their sub-categories nested underneath, dynamically reflecting admin changes.

### 4.6 Checkout, Orders, Account
- Checkout page (via the cart's Checkout button or Buy It Now): **Cash on Delivery only**, no online payment.
- Required fields: Name, Address, Phone number (the order cannot be placed without them), plus Email and City.
- Order summary: product image, name, price, quantity, total.
- After placing an order: confirmation page with an order number and a thank-you message.
- Login/signup is **optional**. The entire checkout/order flow works without logging in.
- Near the Place Order button, a small line reads "By placing your order you agree to our Terms of Service, Refund Policy, Shipping Policy and Privacy Policy." with each name linking to its policy page in a new tab (`target="_blank"`, `rel="noopener noreferrer"`) so the shopper never loses checkout data. No checkbox, no blocking logic.
- **Auth:** clicking Login offers **"Continue with Google"** (direct login) and **email/password signup/login**. Built on Supabase Auth.
- The account/login link lives in the hamburger menu. Logged-in users get an Account area with "My Orders" tracking, and each user sees only their own orders.

### 4.6a How login state works
- **The client hook is the single source of truth in the browser:** `useCurrentUser()` (`src/components/auth/useCurrentUser.ts`) creates the browser Supabase client in an effect, validates the stored session with `getUser()`, and keeps the answer fresh with `onAuthStateChange`. The navbar icon and the hamburger's Account link read it, so signing in or out flips them without a reload.
- **Storefront pages stay identical for everyone.** All `(site)` pages and the homepage render statically — no `cookies()`, no session reads. What an anonymous and a signed-in shopper see differs only on the few server-side dynamic routes (`/account`, the checkout/confirmation pages, the admin tree). Do not add server session reads to a static page or the `(site)` layout; that silently turns them dynamic.
- **Where a session is actually read:** the browser reads its own cookie via the client hook; `/account`, `/checkout`, the confirmation page and the admin tree read it server-side via `createClient()` (`src/lib/supabase/server.ts`), which is also what makes them `ƒ`.
- **Google sign-in round-trips through `/auth/callback`.** "Continue with Google" sends the shopper to Google with `redirectTo` = `<origin>/auth/callback?next=<destination>` — `<destination>` being the `?next=` return path that brought them to `/login` (e.g. `/admin`), or `/account`. `/auth/callback` (`src/app/auth/callback/route.ts`, always dynamic) exchanges the returned `?code` for a session server-side with `exchangeCodeForSession`, so the code is consumed before any page like `/account` can redirect a not-yet-signed-in request away and lose it. It then validates `next` (same-origin relative path starting with a single `/`, otherwise `/account`) and redirects on. A missing or failed exchange redirects to `/login?error=auth`, which shows one short friendly message.
- **Email/password login is unchanged:** the browser client signs in and the page calls `router.refresh()` then `router.replace(destination)`.
- **Logout is a hard navigation.** `SignOutButton` calls `supabase.auth.signOut()` to clear the browser session and then `window.location.assign(redirectTo)` — a full page load, so the Next.js router cache cannot serve a cached logged-in copy of the previous page. The storefront lands on `/`, the admin on `/login`.
- **Already signed in?** `/login` redirects immediately to the destination. `/account` (server-side) redirects a guest to `/login`.
- **Mobile:** the login icon is hidden below `md` (`display: none`, not focusable), so Account is reached through the hamburger menu on phones — the menu's Account link points at `/login` when signed out and `/account` when signed in.

### 4.7 Footer & Team Page
- Footer: standard content first — the Shop / Contact / Follow / Policies / newsletter columns, with the "Contact Us" and "Team Members" buttons side by side directly under the email signup box in the right-hand column — then the "Z U H A ' S" wordmark (**black**, styled like the navbar logo). From `md` up it sits at the very bottom, centred directly above the copyright line; **on mobile (below `md`) it leads the footer at the top, centred, with a gap before the accordion** (the same `order-first md:order-none` swap in `SiteFooterContent`). The Contact link appears only in the footer (not in the hamburger menu).
- Footer typography/layout: the headings — SHOP / CONTACT / FOLLOW / POLICIES and the mobile accordion labels — use the **sans** font (the column headings beat the global serif `h1-h6` rule with an inline `fontFamily: var(--font-sans)`), and the link/contact text is **13px** uppercase. Everything sits in the shared `CONTENT_CONTAINER` (`src/lib/content-container.ts`) — the same container as the navbar and the listing grid. Below `md` the sections are a **centred accordion** (one section open at a time, 44px tap targets, `+`→`−`), with the newsletter block beneath it; the desktop columns are `md:hidden`-inverse (`hidden md:grid`).
- The POLICIES column sits beside SHOP / CONTACT / FOLLOW in the same style: a vertical list linking to `/policies/privacy-policy`, `/policies/refund-policy`, `/policies/terms-of-service` and `/policies/shipping-policy` (Privacy Policy, Refund Policy, Terms of Service, Shipping Policy). It appears in both the normal footer and the full-screen homepage footer slide, and the five columns keep enough gutter and `minmax(0, …)` tracks that nothing overlaps; below `md` the columns give way to the accordion, `md`–`lg` shows two columns, and `lg` up shows the five tracks.
- `/policies/[slug]` renders those four pages: a breadcrumb (HOME > PRIVACY POLICY etc.), the page title, then the body as **plain text** (never `dangerouslySetInnerHTML`) — split on blank lines into paragraphs with single line breaks preserved — in the shared content container with a normal (non-full-screen) footer. Any other slug is a `notFound()`; a page with no body shows "This page has not been updated yet." The routes are static/ISR with `generateStaticParams` for the four slugs, and the body is read through `getStorePolicy` (`src/lib/policy-data.ts`, `unstable_cache` + the `store-policies` tag).
- The FOLLOW column is a **vertical list of icon + platform name rows** (not a horizontal icon row): each row is one link — the round icon (~36px, same thin border and hover as before) followed by INSTAGRAM / FACEBOOK / TIKTOK / WHATSAPP in the same uppercase font, size, tracking and colour as the SHOP and CONTACT links, with the same `space-y-3` row rhythm. Only platforms with a link set appear; a platform with no link is not rendered. The `/contact` page's Social row stays the horizontal icon-only row.
- All non-homepage pages use a normal (not full-screen) footer with the same content as the homepage footer. On the homepage the footer stays the final full-screen slide. In the `(site)` layout, `main` gets a minimum height of one viewport minus the header (`--site-content-min-h` / `--site-content-min-h-md`, computed from the announcement-bar and navbar heights in `src/lib/header-tone.ts`), so header + content always fill the first screen and the normal footer starts **below** the fold on short pages — it never flashes into the first viewport while a page loads. `svh` keeps it right when the mobile address bar changes the visible height.
- "Team" opens a new page showing team members as circular images + name underneath in a left-right carousel with navigation arrows (same circular style as sub-category cards). It must not dump all details at once.
- Clicking a member's circle opens their full detail (image, name, description/role).
- **Phase 8 implementation notes:**
  - `SiteFooterContent` is the single footer definition; `SiteFooter` (homepage slide) and `PageFooter` (every other page) are thin shells around it, so the two footers cannot drift apart.
  - Footer contact details and social links come from the one constant in `src/lib/site-config.ts` — **not** from the `settings` table, which is admin-only readable. Edit that file to change them.
  - `/contact` shows those same details and a message form (Name, Phone, Email address*, Comment*) that writes to `contact_messages` (migration 013) through the `sendContactMessage` server action in `src/lib/contact.ts`; the shared field rules live in `src/lib/contact-types.ts`. The form has a honeypot field and a basic in-memory rate limit (5 per hour per IP), shows the exact line "Thank you, your message has been sent." on success and resets. Nothing is emailed. `/team` shows the carousel. `Contact` must never be added to the hamburger menu.
  - The circular-card carousel is `src/components/ui/CircleCarousel.tsx`, shared by the sub-category page and `/team`. A new carousel consumer supplies the item list and a `renderAction`; do not copy the scroll mechanics.

### 4.8 Currency switcher (PKR / USD / EUR / GBP / AED / CAD)

- **Every amount stored anywhere is PKR** (products, cart, orders, analytics, order totals). Every other currency is **display-only**: `converted = pkr / rate`, rounded to two decimals and printed in that currency's own format via one `Intl.NumberFormat` per code (`$12.50`, `€12.50`, `£12.50`, `AED 12.50`, `CA$12.50`). PKR is the base and its format is the existing grouped number (`formatAmount`, no symbol, unchanged). PKR needs no rate and is always available.
- The admin sets one value per foreign currency — "1 USD / EUR / GBP / AED / CAD = X PKR" — in Settings → Currency. Each is stored in the single-row `store_details` table as a nullable `numeric(12,2)` column: `usd_rate` (**migration 015**, `supabase/migrations/015_usd_rate.sql`) and `eur_rate`, `gbp_rate`, `aed_rate`, `cad_rate` (**migration 016**, `supabase/migrations/016_currency_rates.sql`, each with a `null or > 0` check). Public-read like the rest of that row and written only through the service role. `NULL` means "no rate yet" and hides that currency.
- `src/lib/currency.ts` is the client-safe layer (`Currency`, `FOREIGN_CURRENCIES`, `CurrencyRates`, `formatPrice`, `formatPkr`, `formatCurrency`, `isCurrencyAvailable`, `listAvailableCurrencies`, the localStorage helpers). `src/lib/currency-rate.ts` is server-only and reads every rate (`getCurrencyRates`, returning a `CurrencyRates` map of only the codes that have a positive rate) with `unstable_cache` behind the existing `store-details` cache tag, so Settings' existing `revalidateStorefront({})` already expires it. A missing row or un-run migration fails closed to PKR-only.
- `CurrencyProvider` (`src/components/currency/CurrencyProvider.tsx`) is mounted in the root layout and receives the rates map as a **prop** (server-read), so static storefront pages stay static. The selected currency is **PKR on the server and on the first client render**; the saved choice (localStorage key `zuhas:currency`, read via `useSyncExternalStore` with the PKR server snapshot, wrapped in try/catch) is only swapped in after hydration, so there is never a hydration mismatch. A saved currency whose rate no longer exists falls back to PKR.
- Every storefront price renders through `<Price amount={…} />` (`useFormatPrice` is the string-returning hook): listing cards, product detail, Quick View, cart popup, wishlist grid, search results, filter price labels and the checkout order summary. The **percentage** off and the strikethrough pair are unchanged (computed from PKR). Filtering and sorting keep comparing **PKR** values; only displayed labels change.
- **Not converted (always PKR):** `/admin`, Analytics, the order confirmation page, My Orders and emails. On checkout, when any non-PKR currency is selected, the summary shows that currency **and** a line under the total: "Order will be placed and charged in PKR (Rs X)" with the real PKR total; the order itself is always created and saved in PKR server-side.
- The switcher (`src/components/currency/CurrencySwitcher.tsx`) is a small white pill fixed bottom-left on every storefront page (homepage slides and the full-screen footer slide included), **never** in `/admin`. It lists **PKR plus only the currencies that have a rate**, opening **upward** and scrolling (`max-h`, `overflow-y-auto`) if the list grows past the viewport; it closes on outside click and Escape, highlights the selected row and rotates its chevron. Flags are inline SVG (no emoji) for all six codes, the controls are real buttons with `aria-haspopup`/`aria-expanded` and a 44px touch target. It sits at `z-30` (below popups `z-40` and drawers/modals `z-50`) and is offset above the mobile safe area. It renders nothing when PKR is the only option.

---

## 5. Admin Dashboard

Sidebar layout, simple and clean. The shell and its guard are in place (Phase 9A — see §8); Categories, Products and Inventory are live (Phase 9B — see §9), and the remaining screens are still placeholders. Sidebar sections, in this order:

1. Dashboard (home)
2. Categories
3. Products
4. Inventory
5. Orders
6. Customers
7. Messages
8. Analytics
9. Announcement Bar
10. Team Members
11. Settings

A Contact page also exists (its link shows only in the site footer).

### Dashboard (home)
- Order-status summary: counts for Order Placed, Order Confirmed, Processing, Shipped, Delivered, Cancelled, with a "View all orders" link.
- Recent-orders list with its own "View all orders" link.
- Inventory/low-stock section below: products at or below their low-stock threshold are auto-flagged.

### Categories
Full add/edit/delete for top-level categories (Women's, Men's, Kid's, Bag's, Jewellery, plus any added later) and for sub-categories nested within Women's / Men's / Kid's. When adding/editing a TOP-LEVEL category, the form has two separate image upload fields labeled "Desktop Image" and "Mobile Image (optional)", reusing the same image upload component for both. Sub-categories keep a single image.

### Products
- Add/edit/delete.
- Form fields: name, description, price, optional discount price, multiple image upload (gallery), a custom free-text size field (admin types the available sizes; exactly what is typed is shown to customers; NOT a fixed dropdown), and a low-stock threshold per product.

### Inventory
- Stock quantity per product, per-product low-stock threshold, and a low-stock flag (linked to the dashboard home low-stock section).

### Orders
- List view, order detail view, and status updates: Order Placed → Order Confirmed → Processing → Shipped → Delivered, or Cancelled.

### Customers
- List of signed-up users.

### Messages
- What visitors send from the `/contact` form: table `contact_messages` (migration 013), newest first, paginated like the other admin lists (name, email, phone, a short preview of the comment, date).
- Unread rows are bold with a small dot; clicking one opens a detail dialog with the full message and marks it read; Delete uses the shared confirm dialog.
- The sidebar shows an unread count badge beside "Messages" (fetched once in `src/app/admin/layout.tsx`). Reads live in `listAdminContactMessages` / `countUnreadContactMessages` in `src/lib/admin/queries.ts`; the two actions are in `src/lib/admin/messages.ts`, both behind `requireAdmin()`.

### Analytics (keep it very simple and clean, nothing more than this)
- 4 stat cards: Total Sales, Total Orders, Total Customers, Average Order Value.
- Sales-over-time line chart with a filter: 7 days / 30 days / 12 months.
- Top 5 best-selling products (image, name, units sold).
- Orders-by-status summary.

### Announcement Bar
- Add/remove multiple announcements (shown in the ticker on every storefront page: the homepage and all `(site)` pages; never in `/admin`).

### Team Members
- Add/edit/delete (image, name, description/role). Feeds the footer's Team page.

### Settings
- General store settings: store name, contact email, phone, address, and the social links (Instagram, Facebook, TikTok, WhatsApp — each optional).
- **Currency** section: one field per foreign currency, "1 USD / EUR / GBP / AED / CAD = ___ PKR". Each is empty or a number greater than zero (at most two decimals and no higher than 10,000); empty means no rate and that currency is hidden on the storefront. Validated by `readOptionalCurrencyRate` in `src/lib/admin/validation.ts`, saved into the `store_details` rate columns added by migrations 015 (`usd_rate`) and 016 (`eur_rate`, `gbp_rate`, `aed_rate`, `cad_rate`). See §4.8.
- These are public values, so they live in the single-row `store_details` table (migration 010), not in `settings`. The footer and `/contact` read them through `getStoreDetails()` in `src/lib/store-details.ts` and fall back to `src/lib/site-config.ts` whenever a field is blank. `settings.admin_emails` never leaves `settings`.
- **Store Policies** section: four tabs (Privacy Policy, Refund Policy, Terms of Service, Shipping Policy), each a large plain textarea with a Save button — no rich editor. A small "B" (Bold) button sits above the textarea: it wraps the selected text in `** **` (or strips the markers when the selection is already wrapped), inserts `****` and puts the cursor between the asterisks when nothing is selected, and also fires on Ctrl/Cmd+B. One line under the textarea reads "Select text and click B to make it bold." The stored body is plain text plus `**bold**` runs; that is the only markup, rendered as `<strong>` by `renderPolicyText` in `src/lib/policy-text.ts` (never `dangerouslySetInnerHTML`). Saving writes that row in `store_policies` (migration 014) by slug through the service role in the `saveStorePolicy` action (`src/lib/admin/policies.ts`), then expires the `store-policies` cache tag and revalidates `/policies/[slug]`. The page reads all four through `listAdminStorePolicies` in `src/lib/admin/queries.ts`; the manager is `src/components/admin/StorePoliciesManager.tsx`. No new sidebar item.

---

## 6. Database (Supabase)

Tables: categories, sub_categories, products, orders (and order items), customers, announcements, team_members, settings, store_details, contact_messages, store_policies. Include the fields needed for inventory (stock quantity, low-stock threshold), discounts (discount price), analytics (order totals/dates/status), and Google + email/password auth. Use Supabase Storage for product images and team member images. Apply sensible Row Level Security (users see only their own orders; admin-only writes for management tables).

The categories table has desktop and mobile image fields.

`store_details` is the exception: one row (id 1), public read for `anon` / `authenticated`, writes only through the service role, because the footer and `/contact` have to render those values for an anonymous visitor. Every other settings row stays in `settings`, which is admin-only readable. It also holds the display-only conversion rates — `usd_rate` (**migration 015**), `eur_rate`, `gbp_rate`, `aed_rate`, `cad_rate` (**migration 016**), each nullable `numeric(12,2)` ("1 &lt;CUR&gt; = X PKR"); `NULL` hides that currency. Base storage of every amount stays PKR (§4.8).

`store_policies` (migration 014) is also public-read: `slug` is the primary key and the four rows are seeded (Privacy Policy, Refund Policy, Terms of Service, Shipping Policy), `anon` / `authenticated` may SELECT only, and writes go exclusively through the service role behind `requireAdmin()` in `saveStorePolicy`.

`contact_messages` is private in the other direction: RLS enabled with **no policy at all**, so `anon` / `authenticated` can neither select nor insert a row (plus an explicit REVOKE). The contact form writes only through the service-role key in the `sendContactMessage` server action, and only the dashboard's Messages section reads it.

---

## 7. Build Phases

1. **Foundation & Design System:** project setup, colors, fonts, buttons, Supabase tables.
2. **Homepage:** announcement bar, navbar, full-screen category slider, footer as the final slide.
3. **Sub-Category Page.**
4. **Product Listing Page.**
5. **Quick View & Product Detail Page.** — ✅ Completed
6. **Wishlist, Cart & Search** (plus the hamburger menu). — ✅ Completed
7. **Checkout, Orders & Account** (including Google + email/password auth). — ✅ Completed
8. **Footer & Team Page.** — ✅ Completed
9. **Admin Dashboard** (all sidebar sections including Inventory and Analytics). — ✅ Completed
   - **9A — Admin foundation:** auth guard, security layer, sidebar shell with all ten routes as placeholders. — ✅ Completed
   - **9B — Categories, Products, Inventory** and the image-upload mechanism. — ✅ Completed
   - **9C — Dashboard home, Orders, Customers, Analytics, Announcement Bar, Team Members, Settings.** — ✅ Completed (Analytics uses `recharts`; Settings writes the public `store_details` row read by the footer and `/contact`.)
10. **Polish & QA:** full responsive pass, animation smoothness (desktop and touch), dynamic add/remove checks (categories, sub-categories, team members), discount display checks, and end-to-end order flow with and without login.

Only start a phase when the user says so. Finish and verify one phase fully before moving on.

---

## 8. Admin Security Model (Phase 9A)

Non-negotiable. Do not "simplify" any of this away when the dashboard screens land.

- **Access = signed in AND allowlisted.** The allowlist is `settings.admin_emails`, a jsonb array of lowercase emails, which is exactly what `public.is_admin()` (migration 001) reads. There is one source of truth; do not add a second one in env vars or code.
- `src/lib/admin/guard.ts` is server-only and exposes two functions:
  - `getAdminAccess()` — reports `signed-out` / `denied` / `admin` without acting, so the layout can choose between a redirect and an access-denied page.
  - `requireAdmin()` — the hard gate. It redirects a signed-out caller to `/login?next=%2Fadmin` and throws `AdminAccessDeniedError` for a signed-in non-admin.
- **The `/admin` layout checks on the server for every request** (it renders before any page below it). Not signed in → `/login?next=%2Fadmin`. Signed in but not an admin → the plain access-denied page and nothing else: no sidebar, no nav list, no data, no hint at what the dashboard holds.
- **Never rely on the layout alone.** Every admin page, server action and admin data function calls `requireAdmin()` itself, because a layout does not protect a server action invoked directly.
- The allowlist is read through the **shopper's own session**, not the service-role key, so RLS decides: a non-admin's select on `settings` returns nothing, and the explicit list comparison in the guard is a second, independent check. Both must pass. Errors, missing env vars and unexpected shapes all fail closed.
- Admin **reads and writes** go through `getAdminDb()` (`src/lib/admin/db.ts`). It returns the service-role client, so every function using it must call `requireAdmin()` first — the key authorises nothing by itself, it only decides which rows an already-authorised admin may touch.
- `src/lib/admin/db.ts` and `src/lib/supabase/admin.ts` both `import "server-only"`. That package (a Next.js dependency) fails the **build** if a Client Component ever reaches the service-role key, which is what turns §8's rule into something enforced instead of documented. Never remove it, and never import either file from a `"use client"` module.
- `src/proxy.ts` (the Next 16 middleware) still only refreshes cookies and authorises nothing. Session refresh is not access control.
- The only admin entry point on the storefront is the "Admin Dashboard" button on `/account`, rendered server-side for allowlisted admin emails only — no admin link in the navbar, hamburger menu, footer or any other page. `/admin` is typed directly (or reached through that button), and the whole `/admin` tree is `noindex`.
- `/login` accepts an opt-in `?next=` return path so the round trip through sign-in returns to `/admin`. It honours same-origin relative paths only: anything not starting with a single `/` (e.g. `//evil.example`, `https://…`) is ignored and the shopper lands on `/account`. Never widen that check.

---

## 9. Admin Data, Images & Feedback (Phase 9B)

Non-negotiable for the remaining admin screens (9C). These rules are what §8's security model needs in order to hold once real data is on screen.

- **The page fetches, the manager mutates.** Each screen is a server page that calls `requireAdmin()` and then a reader in `src/lib/admin/queries.ts` (service role, no fallbacks — an admin screen reports a failed query instead of hiding it). It hands the rows to a client manager (`src/components/admin/*Manager.tsx`). Every add/edit/delete is a server action in `src/lib/admin/{categories,products,inventory}.ts`, followed by `router.refresh()`, which re-runs the page's own query. Never write from a client component and never fetch admin data in one.
- **The browser is never trusted.** Each action re-reads and re-validates every field against `src/lib/admin/validation.ts`, which the client also imports so the two sides share one set of limits. The server also re-reads the parent rows: a sub-category must really belong to the chosen category, and a product whose category has sub-categories must pick one (otherwise the storefront would never list it — a sub-category page matches on `sub_category_id`).
- **Slugs are derived, never typed.** `uniqueSlug()` in `queries.ts` slugifies the name (`src/lib/admin/slug.ts`) and adds `-2`, `-3` for clashes. It takes an `excludeId` on edit — without it, saving a product would find its own slug taken and rename it on every edit. Pass the row's id whenever you are updating.
- **Deleting is guarded, and says why.** A category cannot be deleted while sub-categories or products point at it; a sub-category cannot be deleted while products do. Both return a sentence naming the count. A product *can* be deleted, because `order_items.product_id` is `on delete set null` and each order line keeps its own name, price and quantity snapshot. If a future schema change makes a delete fail on a foreign key, report code `23503` as a sentence, never as a database error.
- **One storage bucket, signed uploads.** `store-images` (migration 007) is public-read, 5 MB, jpeg/png/webp, with folders `categories/` and `products/`. An image never passes through a server action body — `requestImageUpload` (a server action, `requireAdmin()` first) signs a short-lived upload URL and the browser PUTs the file with `XMLHttpRequest`, which is also how the progress bar works. There are deliberately **no** insert/update/delete policies for `anon`/`authenticated`; a write is only possible through a URL the server issued.
- **Removing an image and deleting a row both clean up Storage.** `deleteStoredImages()` runs server-side after the row is written — files no longer referenced by the row, and every file on the item when the item is deleted. A delete that fails is logged, never fatal: a stray orphaned file is not worth losing the admin's edit. Removing an image in a form changes nothing until that form is saved.
- **Every write revalidates the storefront.** `revalidateStorefront()` in `src/lib/admin/revalidate.ts` handles the homepage, category, sub-category and product paths, including the old paths when a product moves category. Call it in every action that changes what a customer can see.
- **Stock belongs to Inventory only.** The product form carries the low-stock threshold; the quantity is edited on `/admin/inventory`, and a new product starts at 0. `isLowStock()` in `src/lib/products.ts` is the single low-stock rule (`stock <= threshold`) for both the Inventory screen and the Dashboard home's low-stock section — import it rather than repeating the comparison.
- **Shared UI, not per-screen UI.** `admin-fields.tsx` (labels, inputs, buttons, one feedback line), `AdminDialog.tsx` (the only modal: dimmed backdrop, Escape to close, background scroll locked), `AdminDeleteButton.tsx` (confirm before deleting, and it shows the action's own refusal in the dialog) and `ImageUpload.tsx` (`ImageUpload` for a single image, `ImageGalleryUpload` for the reorderable gallery where the first image is the main one). A new admin screen reuses these; it does not copy them. Every delete asks first, every save and delete reports success or failure, and every table reflows on mobile.

---

## 10. Order Creation Is Server-Side Only (Phase 7)

Non-negotiable. Do not "simplify" any of this away in a later phase.

- Orders, order items and customer rows are written **only** by the server action `placeOrder` in `src/lib/orders.ts`, using the service-role key. Never add a route handler, API route or client-side Supabase write that creates an order.
- `SUPABASE_SERVICE_ROLE_KEY` stays in `.env.local` **without** a `NEXT_PUBLIC_` prefix, so it never enters a client bundle. `createAdminClient()` (`src/lib/supabase/admin.ts`) is the only way to reach it, and it must only ever be imported from server code.
- The browser sends **product ids, sizes and quantities only**. The server re-reads every product from `products`, applies the current price (discount price when set), rejects missing/inactive products, invalid quantities and sizes the product does not offer, and calculates every amount itself.
- The order number comes from `public.generate_order_number()` (migration 006), which is granted to `service_role` only.
- Migration 006 revokes insert/update on `orders`, `order_items` and `customers` from `anon` and `authenticated`, and reduces the orders UPDATE policy to admin-only. Keep it that way as the dashboard grows.
- The order confirmation page is **not** reachable by order number alone. Order numbers are short and sequential, so guessing one must reveal nothing: `orders.confirmation_token` (migration 012, nullable) holds a 32-byte random, URL-safe secret that `placeOrder` mints and saves on the order. Checkout redirects to `/order/confirmation?order=<order_number>&token=<token>`; the page and `getOrderConfirmation` require **both**, compare them in constant time (`crypto.timingSafeEqual`), and return the same `notFound()` for a missing token, a wrong token, an order with no token, and a non-existent number — never disclosing whether the order number exists. A missing token is never a reason to fall back to a number-only lookup.
- The confirmation page and `getOrderConfirmation` read only the non-PII columns (order number, status, dates, amounts, line snapshots). They must never select or render the shopper's name, phone, address or email; those appear only in the account area, behind RLS.
- "My Orders" and the logged-in order detail page keep working **without** a token: they are filtered by `user_id` on the server, with the RLS policies from 001 enforcing it a second time. Admin order screens are unchanged.

---

## 11. Motion (Polish pass)

Non-negotiable rules for every animation added from here on.

- **One shared file.** `src/lib/motion.ts` holds the durations, easings and reusable Framer Motion variants (entrances 200–350ms on `cubic-bezier(0.22, 1, 0.36, 1)`, faster ease-in exits). Import from it; do not hard-code curves in components. The same curves are mirrored as `--motion-ease` / `--motion-ease-exit` in `globals.css` for the plain-CSS transitions.
- **Transform and opacity only** (GPU-friendly). The one exception is an accordion open/close, which uses the CSS `grid-template-rows: 0fr → 1fr` technique with an inner `min-height: 0; overflow: hidden` — never animate `height: auto`. Never animate width/height/top/left/margins/box-shadow on large elements.
- **Enter and exit.** Every popup, drawer, menu and dialog animates on enter *and* exit through `AnimatePresence`, and never blocks clicks or typing while animating.
- **Reduced motion.** `MotionProvider` (client, wraps the root layout) sets `MotionConfig reducedMotion="user"`, and `globals.css` has a `@media (prefers-reduced-motion: reduce)` fallback that collapses CSS transitions/animations. Components that hard-code a `transition` read `useReducedMotion()`.
- **Hover only on real hover devices.** Any hover-only effect lives inside `@media (hover: hover) and (pointer: fine)` (see `.card-hover-second`), and the existing `reveal:` variant keeps touch controls always visible.
- **Scroll lock without layout shift.** Menus/drawers/modals lock the page with `overflow: hidden`; `html { scrollbar-gutter: stable }` reserves the scrollbar width so the page never jumps sideways (the filter drawer additionally compensates `padding-right`).
- **Animated elements:** hamburger→X morph (`MenuMorphIcon`), menu/search/cart popups (`NavbarPopover`), the menu drawer and its staggered items + chevron accordion, search-result and cart-item staggers, the cart-count badge pop and wishlist-heart pop (`PopOnChange`), the product-card gallery hover (the premium two-image swap: second image settles 1.08→1 with the first fading out, or the restored single-image zoom; both 0.8s on `--motion-ease`) with the instantly-revealed wishlist/quick-view/Add-to-Cart controls, quick-view and filter modals/drawers, the shared storefront image fade-in (`FadeInImage`), the admin drawer + staggered sidebar, admin dialogs and the admin feedback message. The homepage category slider, adaptive header tone, button hover fills and the product image viewer keep their existing behavior untouched.
- **Image fade-in.** Storefront `next/image` components go through `FadeInImage` (300ms fade over a `bg-black/5` placeholder, `img.complete` check for cached images, `priority` skips the fade). Admin screens keep plain `next/image`.
- **No new animation library, and do not add** page-transition fades, scroll-reveal for cards or parallax.