# Leak Lock landing page

*Scroll in peace.* Landing page for Leak Lock, a content filter by MAVAL & Co.

Plain HTML/CSS, no build step. Open `public/index.html` in a browser to preview.

## Files

| File | What it is |
|---|---|
| `public/index.html` | The page: hero, demo video, waitlist signup, feedback link |
| `public/styles.css` | Styles, using the Leak Lock (Minh version) palette |
| `google-apps-script.js` | Backend for the waitlist. Lives in Google Apps Script, not on the site |
| `wrangler.jsonc` | Cloudflare config: publishes only the `public/` folder |

## Waitlist

Signups go to a Google Sheet through a Google Apps Script web app.

- The `/exec` URL is set in `SIGNUP_ENDPOINT` near the bottom of `public/index.html`.
- To change the script: paste `google-apps-script.js` into the sheet's Apps Script editor, save, then
  **Deploy → Manage deployments → Edit → Version: New version → Deploy** (the URL stays the same).
- Run `setupSheet` from the editor to (re)apply the sheet formatting.
- The "Join X others" line shows once the count reaches `COUNT_MIN_TO_SHOW` in `public/index.html`.

## Demo videos

The demo section has two tabs with three steps each. Videos live in `public/assets/demos/`, and each step's file path is set in `DEMO_PLATFORMS` near the bottom of `public/index.html`.

| Tab | Before | Enabling | After |
|---|---|---|---|
| Short Form & Reels | `short-form/before-reels.mp4` | `short-form/use_extension.mp4` | `short-form/after-reel.mp4` |
| Reddit | `reddit/before.mp4` (to add) | `reddit/enabling.mp4` (to add) | `reddit/after.mp4` (to add) |

To convert a GIF, and make the first-frame image shown while it loads:

```
ffmpeg -i in.gif -an -c:v libx264 -profile:v high -level 4.0 -preset slow -crf 24 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -movflags +faststart out.mp4
ffmpeg -i out.mp4 -frames:v 1 -q:v 4 out.jpg
```

- A missing file shows "video coming soon". The frame takes each video's shape automatically.
- Cloudflare rejects any single file over 25 MiB.

## To do

- [ ] Add the three Reddit demo videos (see "Demo videos" above)
- [ ] Add the Google Form link to the "Share your feedback" button (`feedbackLink`)
- [ ] Raise `COUNT_MIN_TO_SHOW` to ~10 before sharing widely

## Live site

https://leaklock.linusmunn.workers.dev · QR code for slides in `qr/` (PNG + SVG).

## Deploying

Hosted on Cloudflare (Workers static assets), connected to this repo: every push to `main` goes live.
`wrangler.jsonc` publishes only `public/`. No build command; deploy command is `npx wrangler deploy`.
