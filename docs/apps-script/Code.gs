/**
 * WhenWhere.biz — inquiry form backend (Option A)
 *
 * Paste this whole file into the PRIVATE bookings Sheet:
 *   Extensions → Apps Script, replace the default Code.gs contents.
 *
 * 1. Change NOTIFY_EMAIL at the top below to the personal email you
 *    want new-inquiry notifications sent to. It is the only setting
 *    in this file — everything else stays as it is.
 * 2. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 3. Copy the Web app URL and paste it as INQUIRY_ENDPOINT in
 *    index.html (WHENWHERE_CONFIG, at the top of the calendar script).
 * 4. Push the site once. From then on the form saves straight to the
 *    private Sheet and emails you. Reply from that personal Gmail.
 *
 * The script creates an 'Inquiries' tab on first submit if it does
 * not exist yet. It appends one row per inquiry, in this order:
 *   Submitted | Name | Email | Phone | Type | Date | Venue |
 *   Guests | Budget | Stage | Dream/notes
 *
 * The notification email is sent twice over: a plain-text body for
 * clients that can't render HTML, and an htmlBody laid out like the
 * form itself (Night & Gold, one labelled row per field). Reply-To is
 * the visitor's email, so Reply in Gmail goes straight to them.
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
 */
/* ---- Settings: change this one line, nothing else ----
   To notify more than one person, list addresses separated by
   commas, e.g. 'you@gmail.com, partner@example.com'. Everyone
   listed gets the same email, and Reply-To is still the visitor. */
var NOTIFY_EMAIL = 'your-personal-email@example.com';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function doPost(e) {
  var p = (e && e.parameter) || {};

  /* Spam guard — drop a repeat of the same email + event date inside
     5 minutes. The lock keeps two simultaneous posts from both
     slipping through; if the lock can't be had, check the cache
     anyway and carry on (fail open, never drop a real inquiry). */
  if (p.email) {
    var throttleKey = 'inq:' + String(p.email).trim().toLowerCase()
      + '|' + String(p.date || '').trim();
    var cache = CacheService.getScriptCache();
    var lock = LockService.getScriptLock();
    var haveLock = false;
    try { haveLock = lock.tryLock(5000); } catch (err) { haveLock = false; }
    try {
      if (cache.get(throttleKey)) return ContentService.createTextOutput('ok');
      cache.put(throttleKey, '1', 300);
    } finally {
      if (haveLock) { try { lock.releaseLock(); } catch (err2) {} }
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Inquiries') || ss.insertSheet('Inquiries');
  sheet.appendRow([new Date(), p.name || '', p.email || '', p.phone || '',
    p.type || '', p.date || '', p.venue || '', p.guests || '',
    p.budget || '', p.stage || '', p.dream || '']);

  var fields = [
    ['Name', p.name], ['Email', p.email], ['Phone', p.phone],
    ['Here about', p.type], ['Event date', p.date],
    ['Venue / town', p.venue], ['Expected guests', p.guests],
    ['Rough budget', p.budget], ['Planning stage', p.stage]
  ];

  /* Plain-text body — also the fallback for clients without HTML. */
  var textLines = ['New WhenWhere inquiry — ' + (p.type || 'event'), ''];
  for (var i = 0; i < fields.length; i++) {
    var v = (fields[i][1] || '').trim();
    if (v) textLines.push(fields[i][0] + ': ' + v);
  }
  var dream = (p.dream || '').trim();
  if (dream) textLines.push('', 'About the night:', dream);
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
      + 'font-size:15px;line-height:1.6;color:#e8ecff;">' + esc(dream).replace(/\n/g, '<br>') + '</p>'
    : '';
  var html =
    '<div style="background:#060a1a;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" '
    + 'style="width:100%;max-width:600px;background:#0d1230;border:1px solid #d9a441;'
    + 'border-radius:12px;padding:28px 30px;">'
    + '<tr><td style="font-size:11px;letter-spacing:.3em;color:#d9a441;font-weight:700;">'
    + 'WHENWHERE.BIZ</td></tr>'
    + '<tr><td style="padding:8px 0 4px;font-family:Georgia,serif;font-size:26px;color:#ffffff;">'
    + 'New inquiry — ' + esc(p.type || 'event') + '</td></tr>'
    + '<tr><td style="padding:0 0 14px;font-size:13px;color:#aab3d6;">'
    + 'Saved to your private Sheet &middot; Inquiries tab. Reply from your personal Gmail.</td></tr>'
    + '<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" '
    + 'style="width:100%;border-top:1px solid #2a3263;">' + rows + '</table></td></tr>'
    + (dream ? '<tr><td style="padding:16px 0 0;font-size:11px;letter-spacing:.14em;'
      + 'text-transform:uppercase;color:#d9a441;font-weight:700;">About the night</td></tr>'
      + '<tr><td>' + dreamHtml + '</td></tr>' : '')
    + '</table></div>';

  MailApp.sendEmail(NOTIFY_EMAIL,
    'New WhenWhere inquiry — ' + (p.type || 'event'), text,
    { htmlBody: html, replyTo: p.email || '', name: 'WhenWhere.biz' });
  return ContentService.createTextOutput('ok');
}
