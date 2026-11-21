# WhenWhere.biz — Main Site

The main site for WhenWhere.biz: weddings & events plus drone light
shows, for Charlottesville and Central Virginia. It is the page the
drone light shows page links home to.

**Live:** <https://enonymous1.github.io/whenwhere-biz-main-site/>
— GitHub Pages, deployed from this repo (see [Deployment](#deployment)).

## What is on the page

- **One theme — Night & Gold** — night navy `#060a1a` + gold
  `#d9a441`, the same design system as the drone light shows page.
  There is no theme picker; the Sunset Peach theme was removed.
- **The intro, verbatim** — "At WHEN & WHERE, our goal is to provide
  the heart beat to your celebration… an evening that will resonate
  for a lifetime." It sits under the hero.
- **Sections for every nav link** — Home, Gallery, Services, Weddings
  & Events, Calendar, FAQ, Reviews, About, Contact. Gallery reuses the
  site's existing photos.
- **Drone light shows** — a featured lane with a live canvas sky that
  cycles hearts → rings → starburst, linking out to
  <https://enonymous1.github.io/whenwhere-drone-light-shows/> (the
  drone page's own home; it moves to whenwhere.biz/drone-light-shows/
  when the full site does).
- **About** — About Us, Our Story, and Meet The Team. The team cards
  are placeholders until real names and photos are added.
- **Calendar — Option A, Sheets-driven** — a month grid in the site's
  own style showing Available / Hold / Booked, with a legend. Tap a
  date for its detail, then “Check this date” prefills the inquiry
  form with that date. It reads the published Google Sheet CSV live
  (`SHEET_CSV_URL` is set — see
  [Calendar & form setup](docs/CALENDAR-AND-FORM-SETUP.md)); if the
  Sheet cannot be loaded it falls back to clearly-labelled sample
  dates for Dec 2026–Mar 2027 and says so. Seasonal lead-time
  guidance sits below the grid.
- **One shared inquiry form** — lane buttons pre-fill it (wedding date
  check, drone 2027 date), and tapping a calendar date prefills the
  event date. It is connected (`INQUIRY_ENDPOINT` is set): submitting
  saves the inquiry to a private Google Sheet and emails your personal
  Gmail (Apps Script — see the setup guide); you reply from that
  personal email. If the endpoint were ever unset, the fallback is
  copy / download only — there is no mailto, and no email address is
  listed anywhere on the page.

Honest placeholders, kept on purpose: Reviews is a "reviews on their
way" placeholder rather than invented testimonials, and the team cards
carry no invented names or photos. The calendar's sample dates are
labelled sample-only — they are not real bookings.

## Screenshots

Captured from the page at 1280×900 in dark mode (the page follows the
OS; the shots below are the dark rendering, which is where the themed
scrollbar shows). The hero is a plain viewport screenshot of the top
of the page; the section shots scroll the section into view first —
for sections with no top padding, leave room for the sticky nav or
the heading hides behind it. Serve the folder over HTTP first so the
photos and fonts load.

![Hero — the vineyard ceremony photo and headline](docs/screenshots/hero.jpg)

![Drone light shows — the live canvas sky, here showing the wedding rings](docs/screenshots/drones.png)

![Calendar — the month grid, here on the labelled sample dates](docs/screenshots/calendar.png)

## Preview

`index.html` plus the `assets/` photos beside it — open it in a
browser, or serve the folder so paths resolve exactly as they will on
Pages:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Calendar & form setup

Full step-by-step instructions — public Sheet, private Sheet, Apps
Script deployment, testing, and troubleshooting — are in
[docs/CALENDAR-AND-FORM-SETUP.md](docs/CALENDAR-AND-FORM-SETUP.md).
The short version: create the two Sheets, publish the public one as
CSV, paste its link as `SHEET_CSV_URL` and the Apps Script Web app
URL as `INQUIRY_ENDPOINT` in `WHENWHERE_CONFIG` at the top of the
calendar script in `index.html`, push once. After that, editing the
Sheet updates the calendar with no redeploy.

## Editing the site content (Google Sheets)

The page's text and photos are editable from a Google Sheet — no
code changes and no redeploy for copy edits. The page reads the
Sheet (published as CSV) and overrides the matching text and images;
the text baked into `index.html` stays as the fallback, so the page
is unchanged if the Sheet is unreachable.

**How it works:** every editable bit of copy is tagged in the HTML
with `data-content="key"` (text) or `data-content-img="key"` (an
`<img>`). A small loader at the end of the script block fetches the
content and applies it. The content source is `CONTENT_CSV_URL` in
`WHENWHERE_CONFIG`; when it is blank the page reads `content.json`
beside `index.html` instead. Blank cells are ignored, so a
half-filled Sheet never wipes text.

**The Sheet** has four columns — `key | text | image | alt` — one row
per item. Text rows fill in `text`; image rows fill in `image` (a
filename in `assets/`, e.g. `assets/hero.jpg`, or a full URL) and
`alt` (the accessibility description). Image size is set by the
page's CSS, not the Sheet. A few rows keep markup in `text` — the
hero headline and a handful of labels — and those must keep their
`<span>` / `<br />` / `<a>` tags when edited; everything else is
plain text. `docs/content.csv` is the current Sheet contents in CSV
form (137 rows) — paste it into a new Sheet to start.

**To connect a Sheet:**

1. Create a new Google Sheet (one per site) and paste in
   `docs/content.csv` — File → Import → Upload, or paste the rows.
2. File → Share → Publish to web → choose the Sheet, format CSV,
   Publish. Copy the link.
3. Paste the link as `CONTENT_CSV_URL` in `WHENWHERE_CONFIG` in
   `index.html` and push once. After that, editing the Sheet updates
   the page with no redeploy (the page fetches with `no-store`, so
   edits show on the next load).

**What is and isn't in the Sheet:** the marketing copy (hero,
gallery, services, weddings, drone section, why, calendar intro,
FAQ, reviews, about, team, form labels, footer) and the five photos.
Not in it: the nav labels, the submit button and form note (both are
set by the form's mode in JS), the send-failure result panel, the
validation messages, and the calendar's own status strings — those
are app behaviour, not copy. To add a new editable bit later, tag
the element with `data-content="new-key"` (or `data-content-img`),
add the row to the Sheet and to `content.json`, and the loader picks
it up. Swapping the back-end later (for example to a CMS that emits
the same `key → {text, image, alt}` map) only means changing how the
map is fetched — the override mechanism stays the same.

## Deployment

Hosted on GitHub Pages via GitHub Actions — free, fast, versioned in
git, and no backend server needed. The workflow
(`.github/workflows/pages.yml`) deploys the page on every push to
`main`. There is no build step: what is committed is what goes live.

**One-time setup:**

1. Create an EMPTY public repo, e.g.
   `enonymous1/whenwhere-biz-main-site`.
2. Upload this folder's contents (including `.github/` and `docs/`)
   to its root.
3. Repo → **Settings → Pages → Build and deployment → Source: GitHub
   Actions** → Save. (Not "Deploy from a branch".)
4. Push to `main`. Watch the run under the repo's **Actions** tab;
   it takes ~1–2 minutes. The live URL is
   `https://enonymous1.github.io/whenwhere-biz-main-site/` — that is
   the link to share for the demo.

**Updating the page:** small copy changes can be edited directly in
`index.html` and pushed. Bigger changes (new sections, theme work)
go through the WhenWhere.biz Main Site build and are re-exported
over `index.html`, then pushed the same way. Calendar date changes
do not need a push at all once the Sheet is connected — edit the
Sheet. Note: the Sunset Peach theme and theme picker were removed
from this repo on 2026-11-17; if the page is ever re-exported from
the build, that removal has to be re-applied to the export.

When the full site is ready, this page is the one that moves to
`whenwhere.biz` itself — the drone page already links home to it.

## Project structure

```text
whenwhere-biz-main-site/
├── .github/
│   └── workflows/
│       └── pages.yml           # deploy on push to main
├── docs/
│   ├── CALENDAR-AND-FORM-SETUP.md   # Sheets + Apps Script setup, testing, troubleshooting
│   ├── CONTENT-EDITING.md           # how to edit the site's text + photos in the Sheet
│   ├── INQUIRY-PIPELINE.md          # inquiry-to-booking workflow, visitor + manager views
│   ├── calendar-sample.csv          # the 14 sample dates shown before setup
│   ├── content.csv                  # the Sheet contents (key | text | image | alt), 137 rows
│   ├── screenshots/                 # hero, drone section, calendar (for this README)
│   │   ├── hero.jpg
│   │   ├── drones.png
│   │   └── calendar.png
│   └── apps-script/
│       └── Code.gs                  # Apps Script doPost for the private Sheet
├── index.html                  # the page (content tagged data-content / data-content-img)
├── content.json                # the page content, local fallback for the Sheet
├── assets/                     # photos (hero, barn, ceremony, dancing, drone-hearts)
├── README.md
└── LICENSE                     # © 2026 WhenWhere.biz, all rights reserved
```

## License

© 2026 WhenWhere.biz — All rights reserved. See `LICENSE`.
