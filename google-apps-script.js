/**
 * Leak Lock waitlist → Google Sheet
 *
 * Setup (one time):
 * 1. Create a Google Sheet (e.g. "Leak Lock Waitlist") from a PERSONAL Google account.
 * 2. Extensions → Apps Script. Replace the code with this file, Save.
 * 3. Run `setupSheet` once (select it in the toolbar dropdown → Run) to format the sheet.
 * 4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 * 5. Paste the /exec URL into SIGNUP_ENDPOINT in index.html.
 *
 * After editing this script: Deploy → Manage deployments → Edit → Version: New version → Deploy.
 * The /exec URL stays the same.
 */

const SHEET_NAME = "Waitlist";
const HEADERS = ["#", "Signed up", "Email", "Source", "Status", "Notes"];
const STATUSES = ["New", "Unsubscribed"];
const DATE_FORMAT = "mmm d, yyyy  h:mm am/pm";

// Leak Lock (Minh) palette
const GREEN = "#58cc02";
const GREEN_DARK = "#46a302";
const GREEN_INK = "#163d00";
const GREEN_TINT = "#effbdc";

const MAX_SIGNUPS_PER_MINUTE = 20;   // global cap across all visitors (Apps Script can't see IPs)

/** GET ?action=count → { count } for the "Join X others" line. Cached for 60s. */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action !== "count") return json_({ ok: false, error: "unknown_action" });
  const cache = CacheService.getScriptCache();
  const cached = cache.get("count");
  if (cached !== null) return json_({ count: Number(cached) });
  const count = countSignups_(getSheet_());
  cache.put("count", String(count), 60);
  return json_({ count: count });
}

function countSignups_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  return sheet.getRange(2, 3, last - 1, 3).getValues()       // Email, Source, Status
    .filter(r => r[0] && r[2] !== "Unsubscribed").length;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return json_({ ok: true });            // honeypot filled → bot, ignore

    // Global rate limit: bucket per minute
    const cache = CacheService.getScriptCache();
    const bucket = "rate_" + Math.floor(Date.now() / 60000);
    const used = Number(cache.get(bucket) || 0);
    if (used >= MAX_SIGNUPS_PER_MINUTE) return json_({ ok: false, error: "rate_limited" });
    cache.put(bucket, String(used + 1), 120);

    const sheet = getSheet_();

    const email = String(p.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json_({ ok: false, error: "invalid_email" });
    }

    const last = sheet.getLastRow();
    if (last > 1) {
      const existing = sheet.getRange(2, 3, last - 1, 1).getValues().flat();
      if (existing.includes(email)) return json_({ ok: true, duplicate: true });
    }

    const row = last + 1;
    sheet.getRange(row, 1, 1, 5)
      .setNumberFormats([["0", DATE_FORMAT, "@", "@", "@"]])   // pin formats so stale ones can't leak in
      .setValues([[
        row - 1,
        new Date(),
        email,
        cleanSource_(p.source),
        "New"
      ]]);
    cache.remove("count");                                 // refresh the public count
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/** Run once from the editor to create/format the sheet. Safe to re-run any time. */
function setupSheet() {
  const sheet = getSheet_();
  const ss = sheet.getParent();

  // Header
  const header = sheet.getRange(1, 1, 1, HEADERS.length);
  header.setValues([HEADERS])
    .setBackground(GREEN).setFontColor(GREEN_INK).setFontWeight("bold")
    .setFontSize(11).setVerticalAlignment("middle")
    .setBorder(null, null, true, null, null, null, GREEN_DARK, SpreadsheetApp.BorderStyle.SOLID_THICK);
  sheet.setRowHeight(1, 34);
  sheet.setFrozenRows(1);

  // Column widths + formats (whole columns so new rows inherit them)
  const widths = [48, 160, 280, 200, 120, 280];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  const max = sheet.getMaxRows();
  sheet.getRange(2, 1, max - 1, 1).setNumberFormat("0").setHorizontalAlignment("center").setFontColor("#777777");
  sheet.getRange(2, 2, max - 1, 1).setNumberFormat(DATE_FORMAT);
  sheet.getRange(2, 3, max - 1, HEADERS.length - 2).setNumberFormat("@");   // plain text
  sheet.getRange(2, 3, max - 1, 1).setFontWeight("bold");
  sheet.getRange(2, 1, max - 1, HEADERS.length).setVerticalAlignment("middle").setFontFamily("Arial");

  // Status dropdown
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  sheet.getRange(2, 5, max - 1, 1).setDataValidation(rule);

  // Status colors
  const statusRange = sheet.getRange(2, 5, max - 1, 1);
  const colors = { "New": [GREEN_TINT, "#367d00"], "Unsubscribed": ["#f2f2f2", "#777777"] };
  const rules = sheet.getConditionalFormatRules()
    .filter(r => !r.getRanges().some(rg => rg.getColumn() === 5));
  Object.keys(colors).forEach(s => rules.push(
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s)
      .setBackground(colors[s][0]).setFontColor(colors[s][1]).setRanges([statusRange]).build()));
  sheet.setConditionalFormatRules(rules);

  // Alternating row shading (rows below the header)
  sheet.getBandings().forEach(b => b.remove());
  sheet.getRange(2, 1, max - 1, HEADERS.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
    .setFirstRowColor("#ffffff").setSecondRowColor("#f7f7f7");

  // Filter on the header so you can sort/filter by status, date, etc.
  if (!sheet.getFilter()) sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), HEADERS.length).createFilter();

  // Tidy: drop unused columns, rename the tab
  const extra = sheet.getMaxColumns() - HEADERS.length;
  if (extra > 0) sheet.deleteColumns(HEADERS.length + 1, extra);
  sheet.setTabColor(GREEN);
  ss.setActiveSheet(sheet);
}

/** Uses the "Waitlist" tab; falls back to renaming the first tab. Migrates old 3-column layout. */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else if (sheet.getRange(1, 1).getValue() === "Timestamp") {
    migrateOldLayout_(sheet);
  }
  return sheet;
}

/** Old layout: Timestamp | Email | Source → new: # | Signed up | Email | Source | Status | Notes */
function migrateOldLayout_(sheet) {
  const last = sheet.getLastRow();
  const old = last > 1 ? sheet.getRange(2, 1, last - 1, 3).getValues() : [];
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  if (old.length) {
    const rows = old.map((r, i) => [i + 1, r[0], r[1], cleanSource_(r[2]), "New", ""]);
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }
}

/** Turns a full page URL into something readable, e.g. "leaklock.com" or "local file". */
function cleanSource_(src) {
  src = String(src || "").slice(0, 300);
  if (!src) return "";
  if (src.startsWith("file:")) return "local file";
  const m = src.match(/^https?:\/\/([^\/?#]+)/);
  return m ? m[1].replace(/^www\./, "") : src;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
