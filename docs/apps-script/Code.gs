/**
 * WhenWhere.biz — inquiry form backend (Option A)
 *
 * Paste this whole file into the PRIVATE bookings Sheet:
 *   Extensions → Apps Script, replace the default Code.gs contents.
 *
 * 1. Change 'your-personal-email@example.com' below to the personal
 *    email you want new-inquiry notifications sent to.
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
 * If you change this code after deploying, Deploy → Manage deployments
 * → edit the deployment and pick the new version — otherwise the live
 * Web app URL keeps running the old code.
 */
function doPost(e) {
  var p = (e && e.parameter) || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Inquiries') || ss.insertSheet('Inquiries');
  sheet.appendRow([new Date(), p.name || '', p.email || '', p.phone || '',
    p.type || '', p.date || '', p.venue || '', p.guests || '',
    p.budget || '', p.stage || '', p.dream || '']);
  MailApp.sendEmail('your-personal-email@example.com',
    'New WhenWhere inquiry — ' + (p.type || 'event'),
    'Name: ' + (p.name || '') + '\nEmail: ' + (p.email || '') +
    '\nEvent date: ' + (p.date || '') + '\n\n' + (p.dream || ''));
  return ContentService.createTextOutput('ok');
}
