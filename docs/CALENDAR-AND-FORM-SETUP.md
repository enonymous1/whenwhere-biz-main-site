# Calendar & inquiry form setup — Option A (Sheets-driven)

This is the setup guide for the calendar and form that are now live in
`index.html`. No paid email, no Workspace, no backend server. Two Google
Sheets do the work: one public sheet the calendar reads, one private
sheet the form writes to.

**What you end up with**

- A calendar grid on the site (Night & Gold) showing
  **Available / Hold / Booked**. Tap a date → detail → “Check this date”
  prefills the inquiry form with that date.
- Edit a cell in the public Sheet and the site updates on the next page
  load — no redeploy, no code change.
- A visitor submits the inquiry form → a row lands in your private
  Sheet **and** you get an email at your personal Gmail → you reply
  from that personal Gmail.
- Until the two URLs below are set, the site is honest about it: the
  calendar shows clearly-labelled **sample dates** (Dec 2026–Mar 2027,
  in `docs/calendar-sample.csv`) and the form keeps its
  mailto / copy / download fallback. Nothing is sent until the visitor
  sends it.

**The two settings — both in `index.html`, in `WHENWHERE_CONFIG` at the
top of the calendar script**

```js
var WHENWHERE_CONFIG = {
  SHEET_CSV_URL: "",
  INQUIRY_ENDPOINT: ""
};
```

Paste each URL between the quotes, push once, and both go live.

---

## 1 · Public availability Sheet — what the calendar reads

This is the only Sheet the public ever sees. It holds **three columns
only**: Date, Status, Note. No client names, no venues, no prices, no
contact details — the most it can ever reveal is that a date is booked.

### 1a. Create it

1. In Google Sheets, create a new spreadsheet. Name it something clear,
   e.g. `WhenWhere — Public Availability`.
2. Row 1, exactly: `Date` | `Status` | `Note`
3. Add one row per held or booked date — dates are `YYYY-MM-DD`:

   | Date | Status | Note |
   |---|---|---|
   | 2027-05-15 | Booked | Evening only |
   | 2027-05-22 | Hold | Awaiting deposit |

   Status is exactly one of `Available`, `Hold`, or `Booked`
   (case-insensitive in the page code; use these spellings anyway).
   **Every date with no row defaults to Available**, so you only list
   exceptions — plus any Available date you want to annotate
   (e.g. “Available — holiday weekend”).

   Start from the sample if it helps: copy the 14 rows in
   `docs/calendar-sample.csv` into the Sheet, then replace them with
   your real dates. Do not leave sample dates in the live Sheet — once
   the Sheet is connected the sample dates in the page disappear, and
   only the Sheet's rows are shown.

### 1b. Publish it as CSV

1. In that Sheet: **File → Share → Publish to web**.
2. Choose that sheet (not the whole spreadsheet), choose
   **Comma-separated values (.csv)**, and Publish.
3. Copy the link Google gives you. It looks like:
   `https://docs.google.com/spreadsheets/d/e/…/pub?output=csv`

   Anyone with the link can read the CSV — that is the point, and it is
   why the Sheet must contain only Date / Status / Note. Do not put
   the private bookings Sheet through this step.

### 1c. Connect the site to it

1. In `index.html`, find `SHEET_CSV_URL` in `WHENWHERE_CONFIG` and
   paste the Publish-to-web CSV link between the quotes.
2. Commit and push (see `README.md` → Deployment). Publish the site
   once.
3. Open the live site → Calendar. The status line under the grid
   should read **“Live from your Google Sheet · updated …”**.
   If it still says “Sample dates”, the URL is empty, wrong, or the
   Sheet is not published — see Troubleshooting below.

From then on: change a date's Status in the Sheet, reload the page,
done. No redeploy.

---

## 2 · Private bookings Sheet — never published

Keep a **second, separate** Sheet for the real work: client names,
venue, package, price, contact details, payment status, and the
inquiry inbox.

1. Create a second spreadsheet, e.g. `WhenWhere — Private Bookings`.
   Share it only with the people who should see client details.
2. **Never** Publish-to-web this one, and never put its link in
   `index.html`.
3. The form backend (step 3) will create an `Inquiries` tab in it
   automatically on the first submit, and writes its header row
   (`Submitted | Name | Email | Phone | Type | Date | Venue | Guests
   | Budget | Stage | Dream/notes`) when the tab is empty. If your
   `Inquiries` tab already has rows with no headers, insert a row at
   the top yourself — right-click row 1 → **Insert 1 row above** —
   and type those labels in. You can add your own tabs
   (e.g. `Bookings`, `Payments`) alongside it — the script only
   touches `Inquiries`, so their headers are yours to type.

---

## 3 · Inquiry form → private Sheet (Apps Script)

The form posts to a tiny Apps Script web app that lives in your
private Sheet. The code lives in this repo at
`docs/apps-script/Code.gs` — copy that file into the private Sheet.

### 3a. Install the script

1. Open your **private** Sheet → **Extensions → Apps Script**.
2. Replace the default `Code.gs` contents with the contents of
   `docs/apps-script/Code.gs`.
3. In that code, change exactly one thing: the `NOTIFY_EMAIL` variable
   near the top — `'your-personal-email@example.com'` → the personal
   email you want new-inquiry notifications sent to (your personal
   Gmail). That is the address the notification comes from / to — you
   reply from it afterwards.

### 3b. Deploy it as a web app

1. **Deploy → New deployment → Web app**.
2. **Execute as:** Me.
3. **Who has access:** Anyone.
   (Anyone must be able to submit the form — that is what makes it a
   public contact form. The script only appends a row and emails you;
   it exposes no Sheet data back to the visitor.)
4. Deploy, authorise the script when Google asks (it needs permission
   to write to the Sheet and send email as you), and copy the
   **Web app URL** (`https://script.google.com/macros/s/…/exec`).

### 3c. Connect the site to it

1. In `index.html`, find `INQUIRY_ENDPOINT` in `WHENWHERE_CONFIG`
   and paste the Web app URL between the quotes.
2. Commit and push.

From then on, submitting the form saves straight to the private
Sheet's `Inquiries` tab and emails you. The visitor sees a
confirmation on the page; nothing depends on
`hello@whenwhere.biz` — that address stays optional and unconfirmed
until you set up a real inbox for it.

> **After any code change:** Deploy → Manage deployments → edit the
> deployment and pick the new version. The live Web app URL keeps
> running the old version until you do this. Changing only the
> notification email in the code counts as a code change.

### 3d. Test it (do this before sharing the link)

1. Submit the form yourself on the live site with a test name and
   your own email.
2. Check the private Sheet → `Inquiries` tab: one new row, in this
   order — Submitted | Name | Email | Phone | Type | Date | Venue |
   Guests | Budget | Stage | Dream/notes.
3. Check your personal inbox for “New WhenWhere inquiry — …”.
4. Reply to the test from your personal Gmail, using one shared
   signature every time, e.g. “Justin — WhenWhere.biz”.
5. Delete the test row from `Inquiries` afterwards.

If the form falls back to email / copy / download instead of
submitting, `INQUIRY_ENDPOINT` is empty or the deployment is not
live — see Troubleshooting.

---

## 4 · Replying from personal email (for now)

This setup deliberately skips business email for now:

- One personal address is the reply address for every inquiry.
  Pick one and stick to it, so clients do not end up with two
  different personal addresses for the same business.
- Use the same signature on every reply.
- When you later set up a real `hello@whenwhere.biz` inbox
  (Zoho Free, Google Workspace, or similar), nothing in the calendar
  or form needs rebuilding — only the reply address changes, and
  `hello@whenwhere.biz` can replace the personal address in the
  Apps Script notification and in the form fallback.

---

## 5 · Day-to-day use

| I want to… | Do this |
|---|---|
| Mark a date booked / on hold | Edit Status in the **public** Sheet. Reload the site to check. |
| Free a date again | Delete its row in the public Sheet (it defaults to Available), or set Status to `Available`. |
| See a new inquiry | Private Sheet → `Inquiries` tab, plus the email notification. |
| Change the notification email | Edit it in Apps Script, then redeploy as a new version (step 3b note). |
| Change wording / photos / sections | Edit `index.html` and push — same as any other site change. |
| Change the calendar Sheet link | Edit `SHEET_CSV_URL` in `index.html` and push once. |

---

## Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Calendar still says “Sample dates” | `SHEET_CSV_URL` is empty, or the Sheet is not published. Re-do step 1b and check the link ends in `output=csv`. Republish after adding a new tab — Publish-to-web is per-sheet. |
| Calendar shows “Live …” but a date is wrong | The row in the public Sheet has a typo: date must be `YYYY-MM-DD`, Status must be `Available` / `Hold` / `Booked`. Fix the cell, reload. |
| Calendar is blank / fetch fails | The CSV link is private or the publish was revoked. The page falls back to sample dates on purpose — check step 1b, then hard-refresh. |
| Form falls back to email / copy / download | `INQUIRY_ENDPOINT` is empty, or the Apps Script deployment is not live. Check the URL in `index.html`, and in Apps Script → Deploy → Manage deployments that the active version is the latest. |
| Form submits but no row / no email | The script was not authorised, or the notification email is still the placeholder. In Apps Script, run `doPost` once manually to trigger the authorisation prompt, and check the email address in the code. |
| Same inquiry sent twice within 5 minutes | By design — the spam guard drops the repeat (same email + event date): no second row, no second email, and the form still shows the thank-you. The first copy is in the Sheet. A different event date, or waiting 5 minutes, goes through. |
| Old code still running after an edit | You edited the code but did not create a new deployment version. See the note at the end of step 3b. |

## Files

```text
index.html                          # the page; WHENWHERE_CONFIG holds the two URLs
docs/CALENDAR-AND-FORM-SETUP.md    # this file
docs/apps-script/Code.gs            # Apps Script doPost — copy into the private Sheet
docs/calendar-sample.csv            # the 14 sample dates the page shows before setup
```
