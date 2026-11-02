# Leak Lock landing page

*Scroll in peace.* Landing page for Leak Lock, a content filter by MAVAL & Co.

Plain HTML/CSS, no build step. Open `index.html` in a browser to preview.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: hero, demo video, waitlist signup, feedback link |
| `styles.css` | Styles, using the Leak Lock (Minh version) palette |
| `google-apps-script.js` | Backend for the waitlist. Lives in Google Apps Script, not on the site |

## Waitlist

Signups go to a Google Sheet through a Google Apps Script web app.

- The `/exec` URL is set in `SIGNUP_ENDPOINT` near the bottom of `index.html`.
- To change the script: paste `google-apps-script.js` into the sheet's Apps Script editor, save, then
  **Deploy → Manage deployments → Edit → Version: New version → Deploy** (the URL stays the same).
- Run `setupSheet` from the editor to (re)apply the sheet formatting.
- The "Join X others" line shows once the count reaches `COUNT_MIN_TO_SHOW` in `index.html`.

## To do

- [ ] Add the demo video (see the comment in the demo section of `index.html`)
- [ ] Add the Google Form link to the "Share your feedback" button (`feedbackLink`)
- [ ] Raise `COUNT_MIN_TO_SHOW` to ~10 before sharing widely

## Deploying

Hosted on Cloudflare Pages, connected to this repo: every push to `main` goes live.
No build command; output directory is the repo root.
