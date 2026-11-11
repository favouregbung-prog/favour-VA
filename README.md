# Favour Egbung: portfolio

One-page, scroll-driven site: a mantel clock that assembles on load, then comes apart into the seven services.
Vite + React + TypeScript + three.js.

## Deploy on Vercel
1. Push this folder to a GitHub repo (or run `npx vercel` in it).
2. Import the repo on vercel.com. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
3. Add your domain under Project Settings, Domains.

## Run locally
    npm install
    npm run dev      # http://localhost:5173
    npm run build

Dev only: `?t=2.1` pins the intro at 2.1 s, `?p=0.34` pins the scroll timeline (0 to 1).

## Things to edit
- Copy: `src/App.tsx` (panels), `src/components/*.tsx` (hero, steps, sample Monday, closer), `index.html` (title and meta).
- Booking link: `src/lib/links.ts`.
- Clock look and camera: `src/lib/clock.ts`, `flight.ts`, `scroll.ts`.
