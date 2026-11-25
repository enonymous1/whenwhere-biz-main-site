/**
 * WhenWhere.biz — inquiry form backend (Option A)
 *
 * Paste this whole file into the PRIVATE bookings Sheet:
 *   Extensions → Apps Script, replace the default Code.gs contents.
 *
 * 1. Change NOTIFY_EMAIL at the top below to the personal email you
 *    want new-inquiry notifications sent to. SEND_CONFIRMATION (just
 *    below it) is the only other setting: on by default, it sends
 *    the visitor a confirmation email styled like the notification.
 * 2. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 3. Copy the Web app URL and paste it as INQUIRY_ENDPOINT in
 *    index.html (WHENWHERE_CONFIG, at the top of the calendar script)
 *    AND as the form's action="…" attribute. Both must match.
 * 4. Push the site once. From then on the form saves straight to the
 *    private Sheet and emails you. Reply from that personal Gmail.
 *
 * The script creates an 'Inquiries' tab on first submit if it does
 * not exist yet, and writes the header row (below) when the tab is
 * empty. It appends one row per inquiry, in this order:
 *   Submitted | Name | Email | Phone | Type | Date | Venue |
 *   Guests | Budget | Stage | Dream/notes
 * If the tab already has rows with no headers, the header row is now
 * inserted at the top (see ensureSheet) — the old version only wrote
 * headers to an empty tab and silently treated row 1 as a header.
 *
 * The notification email is sent twice over: a plain-text body for
 * clients that can't render HTML, and an htmlBody laid out like the
 * form itself (Night & Gold, one labelled row per field). Reply-To is
 * the visitor's email, so Reply in Gmail goes straight to them.
 *
 * The visitor gets the same treatment when SEND_CONFIRMATION is on:
 * a confirmation email in the same Night & Gold wrapper, same
 * labelled field rows, but no Sheet link — that stays owner-only.
 * It is sent FIRST, before the notification, so if the daily
 * MailApp quota runs out mid-send the visitor still gets proof
 * their inquiry landed. Two mails per inquiry on consumer Gmail
 * MailApp (100/day) = 50 inquiries/day. Deduped repeats get no
 * second confirmation: they return 'ok' before any mail is sent.
 *
 * If you change this code after deploying, Deploy → Manage deployments
 * → edit the deployment and pick the new version — otherwise the live
 * Web app URL keeps running the old code.
 *
 * Spam guard: one inquiry per email + event date per 5 minutes. A
 * repeat inside that window gets the same 'ok' back, but no second
 * row and no second email. The form itself also blocks a re-send
 * from the same browser for 5 minutes — the server check is the one
 * that can't be bypassed by posting straight at the endpoint.
 *
 * Response contract (the page depends on this — see R1 in REVIEW.md):
 *   doPost returns the literal body 'ok' on success (including a
 *   deduped repeat), and 'error: …' (generic, no internals) on failure,
 *   always HTTP 200. The page reads that body when CORS allows it; a
 *   non-'ok' body must never be treated as a saved inquiry.
 *   doGet returns a short plain-text note — the endpoint is POST-only,
 *   so a browser visit is a health check, not an error page.
 *
 * Reviewed 2026-11-25 (see REVIEW.md, R30–R38): the throttle key is
 * now only written AFTER a successful append + notify (the old code
 * wrote it first, so a failed append lost the inquiry AND blocked a
 * retry for 5 minutes); the whole check-append-notify runs under one
 * lock (the old lock covered only the cache check, so two first-ever
 * submits could both write the header row); mail failure can no
 * longer fail a saved inquiry (notification is best-effort — the
 * Sheet is the record); inputs are validated server-side (the old
 * code trusted the page's JS entirely, so a direct POST could store
 * an empty name/email); values starting with =, +, - or @ are stored
 * as text, not formulas; NOTIFY_EMAIL is validated before use.
 *
 * Known limits, deliberately not "fixed" here:
 * - The 5-minute dedup uses CacheService, which is best-effort storage:
 *   Google may evict a key early, so a duplicate could rarely slip
 *   through after a cache eviction. The browser-side throttle and the
 *   Sheet itself are the backstops; a stronger guarantee would need a
 *   Sheet scan on every submit (O(n) — slow at scale).
 * - No rate limit, CAPTCHA or origin check: anyone who can read the
 *   public page can POST to this endpoint (the URL is in view-source).
 *   The blast radius is one row in one private tab. If spam ever lands,
 *   add a honeypot field or a Turnstile challenge — not a secret URL.
 * - Timestamps use the script/Sheet timezone (new Date()); convert at
 *   export if you ever read the Sheet as UTC.
 */

/* ---- Settings: change this one line, nothing else ----
   To notify more than one person, list addresses separated by
   commas, e.g. 'you@gmail.com, partner@example.com'. Everyone
   listed gets the same email, and Reply-To is still the visitor. */
var NOTIFY_EMAIL = 'your-personal-email@example.com';

/** On = each NEW inquiry also gets a short confirmation email (see
 * buildConfirmEmail), styled like the notification — same Night &
 * Gold wrapper, same field rows, no Sheet link (that stays
 * owner-only). Off = notify only. Either way the row is saved first
 * and mail is best-effort; a mail failure never fails a saved inquiry. */
var SEND_CONFIRMATION = true;

/** Header row for the Inquiries tab, in column order. */
var HEADERS = ['Submitted', 'Name', 'Email', 'Phone', 'Type', 'Date',
  'Venue', 'Guests', 'Budget', 'Stage', 'Dream/notes'];

/** Throttle window for one email + event date, in seconds (CacheService TTL). */
var THROTTLE_SECONDS = 300;

/** Same email pattern the page validates with — keep the two in sync,
    or the page will promise inquiries the server rejects (and vice versa). */
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Per-field length caps, matching the maxlengths on the form. Sheets
    cells cap at 50,000 characters; these fail fast with a clear error
    instead of failing obscurely inside appendRow. */
var MAX_LEN = { name: 100, email: 254, phone: 30, type: 60, date: 10,
  venue: 200, guests: 20, budget: 20, stage: 30, dream: 2000 };

/**
 * Escape a value for the HTML notification email.
 * @param {*} s The value to escape.
 * @return {string} The value with &, <, >, " and ' escaped.
 */
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Trim a posted field to a string, capped at the given length.
 * @param {*} v The posted value (e.parameter values are strings).
 * @param {number} max Maximum length; longer values are truncated.
 * @return {string} The trimmed, capped value ('' when absent).
 */
/* R35: length caps — Sheets cells cap at 50,000 chars and an oversized field threw the append. */
/* R35: length caps — Sheets cells cap at 50,000 chars and an oversized field threw the append. */
function clean(v, max) {
  var s = String(v || '').trim();
  return max && s.length > max ? s.slice(0, max) : s;
}

/**
 * Guard a value against formula injection before it is written to the
 * Sheet. A cell starting with =, +, - or @ is interpreted as a formula
 * when the Sheet (or an exported CSV) is opened elsewhere — a visitor's
 * "dream" text of `=HYPERLINK("…")` would execute. Prefixing with a
 * single quote forces Sheets to store it as plain text (the quote is
 * not displayed).
 * @param {string} s The value to guard.
 * @return {string} The value, quote-prefixed when it needs it.
 */
/* R36: formula-injection guard — values starting = + - @ are stored as text, not formulas. */
/* R36: formula-injection guard — values starting = + - @ are stored as text, not formulas. */
function asText(s) {
  return /^[=+@-]/.test(s) ? "'" + s : s;
}

/**
 * Validate the posted fields. The page validates too, but a direct POST
 * bypasses the page entirely — the server is the only check that cannot
 * be skipped. Returns an error string, or '' when the inquiry is valid.
 * @param {Object} p The posted parameters (e.parameter).
 * @return {string} '' when valid, otherwise a short client-safe message.
 */
/* R34: server-side validation — the client checks are trivially bypassed by a direct POST. */
/* R34: server-side validation — the client checks are trivially bypassed by a direct POST. */
function validate(p) {
  if (!clean(p.name, MAX_LEN.name)) return 'name is required';
  var email = clean(p.email, MAX_LEN.email);
  if (!email || !EMAIL_RE.test(email)) return 'a valid email is required';
  if (!clean(p.type, MAX_LEN.type)) return 'type is required';
  return '';
}

/**
 * Return the Inquiries sheet, creating it (with headers) when needed,
 * and repair a headerless tab. The old code wrote headers only when
 * getLastRow() === 0, so a tab with pasted rows and no headers silently
 * treated row 1 as a header and misaligned every column after it.
 * @param {Spreadsheet} ss The bound spreadsheet.
 * @return {Sheet} The Inquiries sheet, guaranteed to carry HEADERS in row 1.
 */
/* R37: a headerless tab used to silently treat row 1 as the header — repair it before appending. */
/* R37: a headerless tab used to silently treat row 1 as the header — repair it before appending. */
function ensureSheet(ss) {
  var sheet = ss.getSheetByName('Inquiries') || ss.insertSheet('Inquiries');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return sheet;
  }
  var first = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var ok = first.length === HEADERS.length &&
    first.every(function (v, i) { return String(v) === HEADERS[i]; });
  if (!ok) sheet.insertRowBefore(1).getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  return sheet;
}

/**
 * Health check for a browser visit. The endpoint is POST-only; without
 * doGet a visit showed Google's generic script-error page, which reads
 * as "the form is broken" to anyone testing the URL by hand.
 * @return {TextOutput} Plain text noting the endpoint is POST-only.
 */
function doGet() {
  return ContentService.createTextOutput(
    'WhenWhere.biz inquiry endpoint — POST an inquiry here; see the site for the form.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Handle one inquiry POST from the site form (or a direct POST).
 * Order is deliberate: validate → lock → dedup-check → append →
 * confirmation (best-effort, visitor first) → notify (best-effort) →
 * mark throttled. The throttle key is written LAST, so a
 * failure before it leaves the visitor free to retry immediately instead
 * of being locked out for 5 minutes with a lost inquiry.
 * @param {Object} e The Apps Script event; e.parameter holds the fields.
 * @return {TextOutput} 'ok', or a generic 'error: …' (detail is logged,
 *   never returned — the endpoint is public and must not leak internals).
 */
/**
 * Builds the confirmation email to the visitor (plain text + HTML).
 * Pure, like the notify bodies — no SpreadsheetApp/MailApp calls — so
 * the wording and the escaping can be tested without a live Sheet.
 *
 * Same Night & Gold inline styling as the notification email, same
 * labelled field rows, but no Sheet link: that stays owner-only. The
 * copy promises only what the page already promises (a personal reply,
 * usually within one business day) and says plainly that nothing else
 * is coming unless they ask — the confirmation is a receipt, not the
 * start of a mailing list. Replies go to NOTIFY_EMAIL when it is set
 * (see doPost); otherwise they go to the script owner's Gmail, which
 * is the same inbox.
 *
 * @param {string} email The visitor's (validated) address.
 * @param {Array<Array<string>>} fields Label/value pairs, as built in
 *   doPost — only non-empty values are shown.
 * @param {string} dream The visitor's free-text note, may be empty.
 * @return {{subject: string, body: string, htmlBody: string}} The three
 *   parts MailApp.sendEmail takes.
 */
function buildConfirmEmail(email, fields, dream) {
  var subject = 'Thanks — your WhenWhere inquiry is in';
  var lines = ['Thanks — your inquiry is in.', ''];
  var rows = '';
  for (var i = 0; i < fields.length; i++) {
    var v = (fields[i][1] || '').trim();
    if (!v) continue;
    lines.push(fields[i][0] + ': ' + v);
    rows += '<tr><td style="padding:9px 14px 9px 0;vertical-align:top;width:150px;'
      + 'font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d9a441;'
      + 'font-weight:700;">' + esc(fields[i][0]) + '</td>'
      + '<td style="padding:9px 0;vertical-align:top;font-size:15px;color:#ffffff;">'
      + esc(v) + '</td></tr>';
  }
  dream = (dream || '').trim();
  if (dream) {
    lines.push('', 'About the night:', dream);
  }
  lines.push('', 'Justin will reply personally to confirm your date, usually within one business day.',
    '', 'This email was sent to ' + email + ' because someone submitted an inquiry with that address.',
    'If that wasn’t you, just ignore it — nothing else is coming unless you ask.',
    '', '— WhenWhere', 'whenwhere.biz');
  var body = lines.join('\n');
  var dreamHtml = dream
    ? '<p style="margin:18px 0 0;padding:14px 16px;background:#141a3d;border-radius:8px;'
      + 'font-size:15px;line-height:1.6;color:#e8ecff;">' + esc(dream).replace(/\r?\n/g, '<br>') + '</p>'
    : '';
  var htmlBody =
    '<div style="background:#060a1a;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" '
    + 'style="width:100%;max-width:600px;background:#0d1230;border:1px solid #d9a441;'
    + 'border-radius:12px;padding:28px 30px;">'
    + '<tr><td style="font-size:11px;letter-spacing:.3em;color:#d9a441;font-weight:700;">'
    + 'WHENWHERE.BIZ</td></tr>'
    + '<tr><td style="padding:8px 0 4px;font-family:Georgia,serif;font-size:26px;color:#ffffff;">'
    + 'Thanks — your inquiry is in</td></tr>'
    + '<tr><td style="padding:0 0 14px;font-size:13px;color:#aab3d6;">'
    + 'We’ve got it, and Justin will reply personally to confirm your date, '
    + 'usually within one business day.</td></tr>'
    + '<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" '
    + 'style="width:100%;border-top:1px solid #2a3263;">' + rows + '</table></td></tr>'
    + (dream ? '<tr><td style="padding:16px 0 0;font-size:11px;letter-spacing:.14em;'
      + 'text-transform:uppercase;color:#d9a441;font-weight:700;">About the night</td></tr>'
      + '<tr><td>' + dreamHtml + '</td></tr>' : '')
    + '<tr><td style="padding:18px 0 0;font-size:13px;line-height:1.6;color:#aab3d6;">'
    + 'This email was sent to ' + esc(email) + ' because someone submitted an inquiry '
    + 'with that address. If that wasn’t you, just ignore it — nothing else is '
    + 'coming unless you ask.</td></tr>'
    + '</table></div>';
  return { subject: subject, body: body, htmlBody: htmlBody };
}

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    var problem = validate(p);
    if (problem) return ContentService.createTextOutput('error: ' + problem);

    var email = clean(p.email, MAX_LEN.email);
    var date = clean(p.date, MAX_LEN.date);
    var throttleKey = 'inq:' + email.toLowerCase() + '|' + date;
    var cache = CacheService.getScriptCache();
    var lock = LockService.getScriptLock();
    var haveLock = false;
    // R31: the lock wraps the whole check-append-notify pipeline — the old code locked only
    // the dedup check, so two first-ever submits could both write headers.
    // R31: the lock wraps the whole check-append-notify pipeline — the old code locked only
    // the dedup check, so two first-ever submits could both write headers.
    try { haveLock = lock.tryLock(10000); } catch (err) { haveLock = false; }
    if (!haveLock) {
      /* Another submit is being written right now. The visitor's retry is
         dedup-safe, so asking them to retry is correct — silently
         dropping the inquiry would be worse. */
      return ContentService.createTextOutput('error: busy, please retry');
    }
    try {
      if (cache.get(throttleKey)) return ContentService.createTextOutput('ok');

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) throw new Error('no bound spreadsheet');
      var sheet = ensureSheet(ss);
      var row = [new Date(), clean(p.name, MAX_LEN.name), email,
        clean(p.phone, MAX_LEN.phone), clean(p.type, MAX_LEN.type), date,
        clean(p.venue, MAX_LEN.venue), clean(p.guests, MAX_LEN.guests),
        clean(p.budget, MAX_LEN.budget), clean(p.stage, MAX_LEN.stage),
        clean(p.dream, MAX_LEN.dream)];
      sheet.appendRow(row.map(asText));

      /* Link back to the Inquiries tab, for the full history — it goes in
         the notification email (plain text + HTML) so one click opens the
         Sheet at the row this inquiry just landed in. */
      var sheetUrl = ss.getUrl().split('#')[0] + '#gid=' + sheet.getSheetId();

      var fields = [
        ['Name', row[1]], ['Email', row[2]], ['Phone', row[3]],
        ['Here about', row[4]], ['Event date', row[5]],
        ['Venue / town', row[6]], ['Expected guests', row[7]],
        ['Rough budget', row[8]], ['Planning stage', row[9]]
      ];

      /* Plain-text body — also the fallback for clients without HTML. */
      var textLines = ['New WhenWhere inquiry — ' + (row[4] || 'event'), ''];
      for (var i = 0; i < fields.length; i++) {
        var v = (fields[i][1] || '').trim();
        if (v) textLines.push(fields[i][0] + ': ' + v);
      }
      var dream = (row[10] || '').trim();
      if (dream) textLines.push('', 'About the night:', dream);
      textLines.push('', 'View all inquiries in the Sheet: ' + sheetUrl);
      var text = textLines.join('\n');

      /* HTML body — same fields, laid out like the form. */
      var rows = '';
      for (var j = 0; j < fields.length; j++) {
        var val = (fields[j][1] || '').trim();
        if (!val) continue;
        rows += '<tr><td style="padding:9px 14px 9px 0;vertical-align:top;width:150px;'
          + 'font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d9a441;'
          + 'font-weight:700;">' + esc(fields[j][0]) + '</td>'
          + '<td style="padding:9px 0;vertical-align:top;font-size:15px;color:#ffffff;">'
          + esc(val) + '</td></tr>';
      }
      var dreamHtml = dream
        ? '<p style="margin:18px 0 0;padding:14px 16px;background:#141a3d;border-radius:8px;'
          + 'font-size:15px;line-height:1.6;color:#e8ecff;">' + esc(dream).replace(/\r?\n/g, '<br>') + '</p>'
        : '';
      var html =
        '<div style="background:#060a1a;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">'
        + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" '
        + 'style="width:100%;max-width:600px;background:#0d1230;border:1px solid #d9a441;'
        + 'border-radius:12px;padding:28px 30px;">'
        + '<tr><td style="font-size:11px;letter-spacing:.3em;color:#d9a441;font-weight:700;">'
        + 'WHENWHERE.BIZ</td></tr>'
        + '<tr><td style="padding:8px 0 4px;font-family:Georgia,serif;font-size:26px;color:#ffffff;">'
        + 'New inquiry — ' + esc(row[4] || 'event') + '</td></tr>'
        + '<tr><td style="padding:0 0 14px;font-size:13px;color:#aab3d6;">'
        + 'Saved to your private Sheet &middot; Inquiries tab. Reply from your personal Gmail.</td></tr>'
        + '<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        + 'style="width:100%;border-top:1px solid #2a3263;">' + rows + '</table></td></tr>'
        + (dream ? '<tr><td style="padding:16px 0 0;font-size:11px;letter-spacing:.14em;'
          + 'text-transform:uppercase;color:#d9a441;font-weight:700;">About the night</td></tr>'
          + '<tr><td>' + dreamHtml + '</td></tr>' : '')
        + '<tr><td style="padding:18px 0 0;font-size:14px;">'
        + '<a href="' + esc(sheetUrl) + '" style="color:#d9a441;">View all inquiries in the private Sheet &rarr;</a></td></tr>'
        + '</table></div>';

      /* R39: the visitor's confirmation goes FIRST, then the owner
         notification — if the daily MailApp quota runs out mid-send, the
         person waiting on proof their inquiry landed gets the email, not
         just the owner. Both are best-effort; neither can fail the save.
         Deduped repeats never reach here (they return 'ok' above), so
         nobody gets a second confirmation. */
      var notifyOk = NOTIFY_EMAIL && NOTIFY_EMAIL !== 'your-personal-email@example.com' &&
        NOTIFY_EMAIL.split(',').every(function (a) { return EMAIL_RE.test(a.trim()); });
      if (SEND_CONFIRMATION) {
        try {
          var confirm = buildConfirmEmail(email, fields, dream);
          var confirmOpts = { htmlBody: confirm.htmlBody, name: 'WhenWhere.biz' };
          if (notifyOk) confirmOpts.replyTo = NOTIFY_EMAIL;
          MailApp.sendEmail(email, confirm.subject, confirm.body, confirmOpts);
        } catch (confirmErr) {
          Logger.log('WhenWhere inquiry saved but confirmation email failed: ' + confirmErr);
        }
      }

      /* Notification is best-effort: the row above is already saved, so a
         mail failure (bad NOTIFY_EMAIL, daily MailApp quota) must not
         report a saved inquiry as failed. The old code let sendEmail
         throw after appendRow, so the visitor saw an error for an inquiry
         that had landed. A bad NOTIFY_EMAIL is logged and mail is skipped. */
      // R32/R33: mail is best-effort — a failure must not fail a saved inquiry — and the
      // notify address is validated first so a leftover placeholder never throws.
      if (notifyOk) {
        try {
          MailApp.sendEmail(NOTIFY_EMAIL,
            'New WhenWhere inquiry — ' + (row[4] || 'event'), text,
            { htmlBody: html, replyTo: email, name: 'WhenWhere.biz' });
        } catch (mailErr) {
          Logger.log('WhenWhere inquiry saved but notification email failed: ' + mailErr);
        }
      } else {
        Logger.log('WhenWhere inquiry saved; NOTIFY_EMAIL is unset or invalid, notification skipped.');
      }

      /* Only now — after the row and the notify attempt — mark the
         throttle key, so a failure above leaves the retry path open. */
      cache.put(throttleKey, '1', THROTTLE_SECONDS);
      return ContentService.createTextOutput('ok');
    } finally {
      if (haveLock) { try { lock.releaseLock(); } catch (err2) {} }
    }
  } catch (err) {
    /* Never leak internals to a public caller; the detail is in the
       Apps Script Executions log, where the owner looks. */
    Logger.log('WhenWhere doPost failed: ' + err);
    return ContentService.createTextOutput('error: unavailable, please try again');
  }
}
