# Preview browser review — 27 September 2026

Reviewed the deployed `codex/premium-store-upgrade` preview after the owner completed Vercel sign-in. The deployment was Ready and both GitHub CI runs for commit `de04736` succeeded.

## Observed

- Desktop homepage renders the new emerald/ivory design, header, illustrated hero, category/search/sort controls and footer. No visible overlap was observed in the inspected desktop viewport.
- Navigation from homepage to basket and sign-in works. The sign-in form renders its labels and fields in the new split layout.
- The catalogue shows its explicit load-failure state. The basket exits loading and displays a retry action for unavailable prices. The only console errors captured were from a browser extension, not the application.
- Vercel lists both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production and Preview. Their values were not revealed or changed. `NEXT_PUBLIC_SITE_URL` is currently Production-only.
- The existing main-branch production site also shows no products and fallback store branding. This is supporting evidence of a pre-existing data/configuration issue, not proof of its cause.
- Vercel Storage shows no linked managed database. A separately provisioned Supabase project can still be configured through the environment variables above.

## Remaining blockers

The preview cannot currently retrieve catalogue/settings data. The exact cause (project availability, configuration, schema or permissions) is unverified. Supabase project access is needed to diagnose it and trial the migration against the real schema. Product details, account authentication, populated baskets, checkout and admin mutations have not been verified against real data. No orders or customer records were created, and no production deployment or database change was made.

Mobile browser emulation was unavailable through the current browser interface; responsive CSS review is not reported as a mobile browser test. Follow-up code review retained the in-stock filter at narrow widths and added an accessible name to the icon-only account link.

Preview: https://al-ammar-enterprises-pos-system-git-dd791a-al-ammar-enterprises.vercel.app

Pull request: https://github.com/ShazebAhmed/Al-Ammar-Enterprises-POS-System/pull/1

## Update: live data and mobile widths — 27 September 2026 (Claude)

The "cannot retrieve catalogue/settings data" blocker above was the Supabase free project being paused; it was resumed and the live site now loads settings (Rs. 250 delivery, categories, WhatsApp number). The store has no products yet.

Mobile review of the live site (`main` after #16) in the built-in browser with viewport emulation at **360×780** and **414×860**. For each page a script listed elements extending past the viewport that are not inside a scrolling or clipping container, and screenshots were checked.

| Page                                         | 360px                                                                                              | 414px                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Home (hero, collection, empty state, footer) | Hero heading: "Extraordinary" and "little" ran together and "little" was cut off at the right edge | Words ran together ("Extraordinarylittle"), still fitting |
| Basket (empty)                               | OK                                                                                                 | OK                                                        |
| Checkout (empty basket)                      | OK                                                                                                 | OK                                                        |
| Sign in / create account                     | OK                                                                                                 | OK                                                        |
| Reset password                               | OK                                                                                                 | OK                                                        |
| Product not found                            | OK                                                                                                 | OK                                                        |

Cause: under 520px the CSS hides the heading's second `<br>`, and JSX left no whitespace between `</em>` and "little". Fixed by adding a space after `</em>`; applying the same change to the live page in the browser gave three lines ending at x=294 of 360.

The category chips row intentionally scrolls sideways and is not an overflow.

Not checked on mobile: a real product page and a filled basket (no products exist), and account/admin pages (they need a signed-in account; Claude does not sign in with the owner's password).
