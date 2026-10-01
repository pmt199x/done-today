# Done Today

Mobile-first daily checklist + quick notes PWA, optimized first for **iPhone 14 Pro (393 × 852 CSS px)**.

## Features

- Today dashboard and completion progress.
- Three priorities: **Must do / Should do / If I have time**.
- Tap checkbox to complete a task.
- Swipe right to move a task to tomorrow.
- Swipe left to delete.
- Quick capture for tasks and notes using an iOS-style bottom sheet.
- Natural-language shortcuts such as `mai`, `tomorrow`, `9h`, `9:30`, `!gấp`, `urgent`, `!later`.
- Task details: date, priority, note, subtasks.
- Calendar, notes and personal statistics tabs.
- Daily rollover for unfinished overdue tasks.
- LocalStorage persistence.
- PWA manifest + service worker for install/offline use after HTTPS deployment.
- Safe-area support for Dynamic Island and Home Indicator.

## Icon system

All UI icons are inline SVG symbols in a single sprite at the top of `index.html` (no icon library, no emoji, no raster UI icons).

- **Style:** one outline family on a 24 × 24 grid — round caps/joins, large circles `r=9`, frames `rx≈3`, colour always via `currentColor`.
- **Usage:** `<svg class="i i-md" aria-hidden="true"><use href="#i-calendar"/></svg>` in HTML, or `icon('calendar', 'md')` in `app.js` (`setIcon(svg, name)` swaps an existing icon).
- **Sizes** (`styles.css` tokens): `xs` 14 px metadata · `sm` 16 px chips/inline · `md` 20 px buttons/rows (default) · `lg` 24 px tab bar/FAB · `xl` 32 px empty states. Stroke width is set per size so every icon renders at the same visual weight.
- **Priorities:** Must do = `flag`, Should do = `circle-dot`, If I have time = `leaf` — always paired with the label, colour only reinforces.
- **Icon buttons:** `.icon-btn` (+ `-subtle`, `-primary`, `-danger`, `-sm`, `-lg`). Visual size may be small; the hit area is always ≥ 44 × 44 px. Icon-only buttons must have an `aria-label`.
- **Available symbols:** home, check-circle, calendar, calendar-check, calendar-days, calendar-forward, clock, bell, repeat, sun, moon, sticky-note, file-text, user, menu, plus, minus, x, check, ellipsis, pencil, trash, copy, archive, pin, pin-off, arrow-left/right, undo, rotate-ccw, search, filter, sort, mic, chevron-left/right/up/down, flag, circle-dot, leaf, flame, sparkles, circle, info, list-checks, chart, gauge, activity, database, upload, download, cloud, settings, smartphone.

The home-screen icons (`icon-180/192/512.png`) use the same mark: a white disc with an indigo check on a full-bleed indigo field, kept inside the maskable safe zone.

## Project structure

```text
done-today/
├── .github/
│   └── workflows/
│       └── pages.yml        # GitHub Pages deployment
├── scripts/
│   └── check.mjs            # Lightweight source validation
├── .gitignore
├── .nojekyll
├── app.js                   # App state, rendering, gestures, parser
├── icon-180.png             # iOS home-screen icon
├── icon-192.png             # PWA icon
├── icon-512.png             # PWA icon
├── index.html               # App shell
├── manifest.json            # PWA metadata
├── netlify.toml             # Netlify deployment config
├── package.json             # Node local-dev commands
├── styles.css               # Mobile-first / iOS-oriented styling
├── sw.js                    # Offline service worker
└── vercel.json              # Vercel headers/config
```

## Run locally with Node

Requirements: Node.js 18+.

```bash
npm run dev
```

Then open:

```text
http://localhost:5173
```

The app itself does not require Node at runtime. Node is only used here as a convenient local static server.

## Validate before pushing

```bash
npm run check
```

## Push to GitHub

Create an empty repository on GitHub, then from this project directory run:

```bash
git init
git add .
git commit -m "Initial Done Today PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/done-today.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## Deploy with Vercel

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project**.
3. Import the `done-today` repository.
4. Framework Preset: **Other**.
5. No build command is required.
6. Deploy.

`vercel.json` disables long-term caching for `sw.js`, so service-worker updates propagate more reliably.

## Deploy with Netlify

1. Push the repository to GitHub.
2. In Netlify choose **Add new site → Import an existing project**.
3. Select the GitHub repository.
4. Netlify reads `netlify.toml` automatically.
5. Deploy.

The configured validation command is:

```text
npm run check
```

and the publish directory is the repository root.

## Deploy with GitHub Pages

A GitHub Actions workflow is already included.

After pushing to `main`:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions** if it is not already selected.
4. Open the **Actions** tab and confirm `Deploy GitHub Pages` completes successfully.
5. GitHub will show the public Pages URL in the deployment.

All app asset URLs are relative, so the PWA works when hosted under a GitHub Pages repository subpath such as `/done-today/`.

## Install on iPhone

After deployment over HTTPS:

1. Open the site in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Launch **Done Today** from the new icon.

## Current data model

This MVP is intentionally local-first. Tasks and notes are stored in `localStorage`, so data belongs to the current browser/device and is not synced to another device yet.

For a production multi-device version, the next logical upgrade is:

```text
React Native / Expo
        ↓
TypeScript application layer
        ↓
Supabase (Auth + PostgreSQL + sync)
        ↓
Push reminders / recurring tasks / widget
```

The current PWA remains useful as a deployable prototype and can also serve as the UI/interaction reference for a later native version.
