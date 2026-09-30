# IngredienPro — interactive app

A working web app built on the **FINAL SCREENS** in Figma (*IngredianPro | Wireframe*,
`lDikeJ9FNKkACdCVs1omaW`). Every page looks exactly like its Figma frame, but it runs on
real data: what a buyer sends really reaches the seller.

## Open it
- `python3 -m http.server` (or `npx serve`) in this folder → http://localhost:8000. Deploy: drag the folder onto Netlify. No build step.
- **The role switch** (bottom-left) views the app as **Guest**, **Buyer** or **Seller**, and stays on the same page when it reads the same for everyone. In Seller view, **as ▾** picks which seller you are signed in as — the one you registered, sellers with new enquiries (marked *· N new*), or anyone in the directory. So: send an enquiry as the buyer to Sri Lakshmi, switch to Seller, pick Sri Lakshmi, accept it.
- Each browser tab keeps its own role, so open the buyer in one tab and the seller in another and watch them update each other live.
- **Reset** clears every enquiry, chat, registered account and uploaded picture.
- Deep links: `index.html?as=buyer#/overview`, `?as=seller#/hub`, `#/find?q=turmeric`, `#/myenq/<chat>?enq=ENQ-1001` (opens the chat at that enquiry). Every Figma frame is still viewable at `#/screens` / `#/s/<id>`.
- Works on a phone. Resize the window and the layout reflows — it never scales down.

## Design sync (js/sync.js)
The frames in `screens/` are a snapshot of the Figma file taken **before** the changes in *IngredienPro - Change Log.md*. Until the snapshot is re-fetched, `js/sync.js` applies those changes to every screen as it renders:
- **Header:** no utility bar. Guest: About Us · How it Works · Category · Pricing · Find a Seller · Log in · Register for free. Buyer: the same five items, bell, My Account. Seller: Seller Hub badge · Help · bell · account.
- **Footer:** Marketplace (All categories · Find a seller · List your business) or Seller Hub (Dashboard · My enQ · Catalogue · Subscription) · Company (About us · How it works · Pricing · Contact us) · Support (Help centre · FAQ) · Legal.
- **Home:** one *Browse by category* section; the supplier card reads *For ingredient suppliers — Get listed as a verified supplier — List your business*. How it Works: *List your business*. Help: no "posted requirement" wording. *Post a requirement* is hidden everywhere.
- **About Us** (`#/about`) and **Pricing** (`#/pricing`, with a working Monthly / Annual toggle), built inside the real header, breadcrumb and footer of the How it Works frame for guests and buyers.

Once the snapshot is re-fetched from the updated file (`tools/fetch_figma.py` with a REST token pointed at it, or `tools/figma_export_plugin.js` through a plugin connection for small frames), each step finds nothing left to change.

## Data starts empty
Nothing is seeded except the seller directory, the product list and two stand-in accounts (Vega Foods, Ashwin Spice Works) the role switch uses before anyone registers. **My enQ, notifications, Overview and the Seller Hub dashboard only ever show what you did in this browser.** Register as a buyer or seller and that account — name, company, WhatsApp number, email, business type, categories, delivery city — is what the header, Overview and Profile & Settings show. Verification is skipped: the code screens are dummies and *Verify* / *Log in* always succeed.

## Enquiries and My enQ
- **One chat per buyer–seller pair.** Every enquiry the buyer sends that seller (from Find a Seller, a seller profile, or *+ Send another enquiry* in the chat) joins the same chat as its own card, with a reference (ENQ-1001…) and its own status: *Awaiting acceptance / New request → Active → Deal agreed / Closed*, or *Declined*.
- **The enquiry panel** on the right of the chat registers every enquiry with its status. Click one and the chat scrolls back to where it was sent and highlights it; as you scroll, the panel marks the enquiry you are reading under. Below 1100px the panel becomes a sideways strip at the top of the chat.
- **The seller accepts or declines each enquiry separately** — on the card in the chat or in the panel. The chat opens for messages once any enquiry is accepted; until then the buyer sees it as *Awaiting acceptance* and cannot message. Closing or declining one enquiry leaves the others open; when all are closed the chat is read-only, and a new enquiry reopens it.

## Profile pictures
Industry pattern (LinkedIn company pages, B2B marketplaces): one square image is the account's face everywhere; a seller's wide cover is separate and only appears on their storefront.
- **Buyer — Profile photo or company logo.** Shown in chats, the header and to sellers.
- **Seller — Logo (profile picture)**, shown in chats, search results, storefront and header, **and Storefront cover** (4:1, 1600 × 400), shown across the top of the public profile only — never cropped into a chat avatar.
- In Profile & Settings: click the preview or *Upload*, or drop an image on it. It is cropped from the centre (400 × 400 / 1600 × 400), saved at once, and can be replaced or removed. Initials show until a picture is set.

## What works
| Area | Behaviour |
|---|---|
| Find a Seller | Live list from data · search · category / certification / business-type / years / response filters · applied-filter chips · shortlist toggle · open profile · counts each seller's search appearances |
| Seller profile | Built from the seller's data: logo, storefront cover, stats, categories, products · Send enquiry · Shortlist · counts a profile view (one per buyer per day) |
| Send enquiry | Product suggestions · quantity/unit/notes · add up to 5 products in **one** enquiry: each finished product collapses to a one-line summary (**Done**, or Enter in Quantity), click a summary to edit it, a blank product box never blocks Send, missing fields are flagged inside the field · similar sellers limited to those who sell every product · product-not-sold prompt · tells you when it will join an existing chat |
| My enQ (buyer & seller) | One chat per seller · several enquiries per chat · enquiry panel · unread counts · All/Unread/Requests filters · search · archived (all enquiries closed/declined) |
| Chat | Accept / decline each enquiry (with reasons) · both sides message (Enter, starters, attach a file) · mark a deal agreed or close per enquiry · read-only when all are closed · undo a decline for 5 minutes |
| Buyer Overview | My Account home: active enquiries, seller responses, open chats, shortlists · *Needs your attention* built from real events · recent enquiries · sellers in your categories · profile completeness · first-visit and all-caught-up states |
| Seller Hub | Dashboard computed from activity: profile views, search appearances, enquiries received, average response time, weekly enquiry chart, needs-attention list · catalogue · subscription · Profile & Settings (Edit / Preview with logo and cover) |
| Notifications | Generated by what happens, per enquiry · dropdown (buyer) and page · open straight to the enquiry in its chat |
| Guest | Seller names and logos masked · any enquiry / shortlist opens the sign-up gate |
| Log in | WhatsApp or email → code screen (skipped). A registered seller's number, or one starting 98450, opens the Seller Hub; others log in as the buyer |
| Register Free | Buyer: form → verification (skipped) → categories & delivery city → Overview. Seller: form → verification (skipped) → documents → automated check → products → plan → review → approved → live → Seller Hub |

*Post a requirement* was removed from the product; its buttons, banners and footer links in the Figma snapshot are hidden.

## Responsive

The page always fills the window — it is never a 1440 canvas floating on grey. The frames are
drawn at 1440: at that width the app is the wireframe, pixel for pixel; wider, the bands stay
full-bleed while the gutters grow so the reading column stops widening; narrower, the layout
**reflows** rather than scaling down, so the type stays at the size it was designed at.

The bands are **container queries on `#stage`, not media queries**, because the flow sidebar
takes 272px out of the window — the app has to measure itself, not the viewport. `App.mode()`
reads the same width, so JS and CSS never disagree. All in `css/responsive.css`:

| App width | What changes |
|---|---|
| **> 1440** | Gutters grow by half the excess, so the content column stays about as wide as drawn while headers and footers still span the window. |
| **< 1440** | Nothing may exceed the canvas. Page gutters shrink from 120px towards the band's own gutter. Frames Figma drew on a free canvas (absolute x/y) start flowing. Rows fold instead of overflowing; tab strips and steppers scroll sideways. |
| **< 1100** | Gutter 24px. The account rail drops to its 64px icon-only state. My enQ shows one pane at a time — a *All chats / This chat* switch appears, because 340px of list plus what is left is too narrow for a readable chat. |
| **< 900** | The top nav folds into a hamburger drawer (right-hand sheet, role-aware: guest, buyer or seller links, current page marked). |
| **< 760** | One column: the shell stacks, the account rail becomes a scrolling strip above the content, every fixed width is released, modals become bottom sheets, touch targets go to 44px. |

Three things make this work without touching the wireframe:

- `render.js` tags what it renders. `is-row` on horizontal auto-layout frames, `is-free`
  (plus measured insets and gaps) on frames whose children carry absolute x/y, `has-gutter`
  with the drawn padding, `t-pre` on text Figma sized to its own content. The responsive
  sheet keys off those tags, so no rule has to name an individual screen.
- Figma's FILL becomes `flex: 1 1 0`, and a basis of zero makes a row squeeze its children to
  nothing instead of wrapping. Below 1440 those children are re-based on their content, with
  the panes that are meant to take the remaining space (`Pane / Thread`, `Main`, `Article`)
  put back to `1 1 0`.
- `js/responsive.js` handles what CSS cannot: the nav drawer, the pane switch, and a clamp
  that pulls any absolutely-pinned element (a gate modal, a suggestions dropdown) back inside
  whatever bounds it. The clamp remembers the original numbers, so widening the window
  restores the drawn position exactly.

Above the drawn width five frames still clip content — chat-starter chips, rating-bar fills and
one mega-panel link. That is the wireframe's own overflow, which Figma clips too, so it is left
alone rather than redesigned.

## The role switch

`js/flownav.js` + `css/flownav.css`. A small floating control replaced the flow sidebar, so the app gets the full window width. It keeps the old bar's hooks (`.rolebar`, `[data-role]`, `.rb-reset`) so scripted checks still find it.

## Motion

`css/motion.css`, 150–300ms, everything cancelled under `prefers-reduced-motion`:
screens fade and rise in (and come from the left when going back) · lists stagger in at 35ms
intervals · pressing anything scales it very slightly · rows lift on hover · modals rise and
scale, or slide up as a sheet on a phone · overlays animate out before they are removed ·
the sticky header only casts a shadow once it is stuck · a count that changes gets a nudge ·
a loading bar appears only if a screen takes more than 180ms.

## How it's built
- `tools/fetch_figma.py` pulls the FINAL frames from the Figma API into `screens/*.js`
  (`python3 tools/fetch_figma.py --fresh` after Figma changes; token in `~/.figma_token`).
- `js/render.js` renders a Figma frame as HTML (auto-layout → flexbox).
- `js/routes.js` maps app routes to Figma frames per role, and every Figma prototype link to an app route/action.
- `js/data.js` seller directory and product list · `js/store.js` state (v4: conversations holding enquiries), actions, cross-tab sync.
- `js/pages*.js`, `js/modals.js`, `js/auth.js` bind pages and pop-ups to live data, using the
  Figma elements themselves as templates (rows, bubbles, cards are cloned and filled).
- `css/responsive.css`, `css/motion.css`, `js/responsive.js` — the responsive and motion layers
  described above. They only ever override; `app.css` and the renderer are untouched by them.

## Checking it
Serve the folder (`python3 -m http.server 8777`) and open these through the server:

- `tools/enqtest.html` — the current end-to-end check: registration → account data, empty My enQ, two enquiries to one seller in one chat, the enquiry panel and jump-to-enquiry, seller accept, messages, Overview, dashboards, profile pictures, seller registration. Prints JSON.
- `tools/synctest.html` — the design sync (headers per role, footers, home, About Us, Pricing) and the multi-product enquiry form end to end. `tools/mpshot.html` renders that form with two products for a screenshot; `tools/panelshot.html` renders a chat holding a two-product and a one-product enquiry, to check the enquiry panel (it clears the prototype's data first).
- `tools/apptest.html`, `tools/apptest2.html` — older checks written for the seeded, one-chat-per-enquiry data (v3); they no longer match the app.
- `tools/rescheck.html?w=390` — loads all 91 frames at that width and reports anything that
  spills past whatever would clip it. `&routes=buyer|/myenq,seller|/hub,…` checks live routes
  (with their controllers) instead of raw frames.
- `tools/shot.html?w=390&h=1700&r=buyer&p=/myenq` — renders the app in an iframe of an exact
  width. Screenshot **this**, not the app directly: headless Chrome lays a top-level page out
  wider than `--window-size` and then crops, which makes direct screenshots lie.
- `tools/phonetest.html` — checks the phone-only controls: the pane switch, the hamburger,
  the nav drawer opening and closing.
- `tools/probe.html?s=<frame-id>&n=<node name>` — prints the computed ancestor chain for a node
  (width, direction, wrap, basis, alignment), which is how every layout bug above was found.
