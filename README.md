# WhenWhere.biz — Main Site

The main site for WhenWhere.biz: weddings & events plus drone light
shows, for Charlottesville and Central Virginia. It is the page the
drone light shows page links home to.

**Live demo (planned):** <https://enonymous1.github.io/whenwhere-biz-main-site/>
— GitHub Pages, deployed from this repo (see [Deployment](#deployment)).

## What is on the page

- **Two themes, one site** — a toggle in the nav switches between
  Night & Gold (night navy `#060a1a` + gold `#d9a441`, the same design
  system as the drone light shows page) and Sunset Peach (peach header
  and backgrounds, dark-brown feature blocks, burnt-orange accents).
- **The intro, verbatim** — "At WHEN & WHERE, our goal is to provide
  the heart beat to your celebration… an evening that will resonate
  for a lifetime." It sits under the hero in both themes.
- **Sections for every nav link** — Home, Gallery, Services, Weddings
  & Events, Calendar, FAQ, Reviews, About, Contact. Gallery reuses the
  site's existing photos.
- **Drone light shows** — a featured lane with a live canvas sky that
  cycles hearts → rings → starburst, linking out to
  <https://whenwhere.biz/drone-light-shows/>.
- **About** — About Us, Our Story, and Meet The Team. The team cards
  are placeholders until real names and photos are added.
- **One shared inquiry form** — lane buttons pre-fill it (wedding date
  check, drone 2027 date), and submitting builds a formatted inquiry
  the visitor can open in their email app addressed to
  `hello@whenwhere.biz`, copy, or download. There is no backend and
  no Google Form connected yet — same pattern as the drone page.

Honest placeholders, kept on purpose: the Calendar carries no made-up
booked dates (an exact date is checked through the form), Reviews is
a "reviews on their way" placeholder rather than invented
testimonials, and the team cards carry no invented names or photos.

## Preview

`index.html` is a single self-contained file (photos inlined) — open
it in a browser, or serve the folder so paths resolve exactly as they
will on Pages:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deployment

Hosted on GitHub Pages via GitHub Actions — free, fast, versioned in
git, and no backend needed (the form opens the visitor's own email
app). The workflow (`.github/workflows/pages.yml`) deploys the page
on every push to `main`. There is no build step: what is committed
is what goes live.

**One-time setup:**

1. Create an EMPTY public repo, e.g.
   `enonymous1/whenwhere-biz-main-site`.
2. Upload this folder's contents (including `.github/`) to its root.
3. Repo → **Settings → Pages → Build and deployment → Source: GitHub
   Actions** → Save. (Not "Deploy from a branch".)
4. Push to `main`. Watch the run under the repo's **Actions** tab;
   it takes ~1–2 minutes. The live URL is
   `https://enonymous1.github.io/whenwhere-biz-main-site/` — that is
   the link to share for the demo.

**Updating the page:** small copy changes can be edited directly in
`index.html` and pushed. Bigger changes (new sections, theme work)
go through the WhenWhere.biz Main Site build and are re-exported
over `index.html`, then pushed the same way.

When the full site is ready, this page is the one that moves to
`whenwhere.biz` itself — the drone page already links home to it.

## Project structure

```text
whenwhere-biz-main-site/
├── .github/
│   └── workflows/
│       └── pages.yml           # deploy on push to main
├── index.html                  # the page (self-contained, ~4.3 MB)
├── README.md
└── LICENSE                     # © 2026 WhenWhere.biz, all rights reserved
```

## License

© 2026 WhenWhere.biz — All rights reserved. See `LICENSE`.
