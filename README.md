# Morning Brief app

An installable web app (PWA) that shows the weekday morning brief. It works offline and opens full screen from the home screen.

## Files

- `index.html`, `app.css`, `app.js`: the app
- `sw.js`: the service worker. It caches the app for offline use and fetches briefs network-first. Bump `VERSION` after changing any app file.
- `manifest.webmanifest`, `icons/`: what the phone needs to install the app
- `briefs/`: the data

## Adding a brief (what the morning task does)

1. Write `briefs/<YYYY-MM-DD>.json`:
   ```json
   { "date": "2026-10-19", "label": "Monday 19 October", "html": "<div class=\"weather\">…</div>…", "rain": [{ "h": "06", "mm": 0 }] }
   ```
   `html` uses the same markup and classes as the Claude page (`weather`, `news`, `lesson`, …). `#rainChart` is drawn from `rain`.
   **The site is public: leave out the `board` block (class times, rooms, commute and departure times), any place name or location-specific link (town, address, station, local weather URL), and anything else personal.** The private Claude page keeps the full brief.
2. Add `{ "id": "<YYYY-MM-DD>", "date": "<YYYY-MM-DD>", "label": "…" }` to the top of `briefs/index.json`.

The app picks up the new brief when it opens, when it comes back to the foreground after 5 minutes, or when you tap ↻.

## Testing locally

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 8787
```

Then open http://localhost:8787. A phone can only install the app from an HTTPS address, such as GitHub Pages.
