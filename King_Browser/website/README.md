# King website v2

The production, responsive English/Turkish marketing website for King Browser. Built with React, TypeScript, Vite, locally served Manrope, and Lucide icons.

## Run

```sh
cd website
npm ci
npm run dev -- --port 5174
```

Open http://127.0.0.1:5174. To produce a static site, run `npm run build`; deploy the `dist/` directory. `npm run preview` serves the production build locally. This project currently assumes deployment at the domain root.

## Included

- English/Turkish copy with a remembered language preference
- Responsive navigation, keyboard-operable product tabs, and platform selector
- Real King screenshots and a 27-second 1080p product film with original music, bilingual captions, and keyboard dismissal
- Expandable FAQ, official GitHub links, and direct release downloads
- Authored entrances, tour transitions, desktop depth, and reduced-motion support
- Local fonts and assets, no analytics or third-party scripts

Download filenames and version labels must stay in sync with the electron-builder `artifactName` values in the root `package.json` and the version in its manifest. Release assets are published as a draft by `.github/workflows/release.yml`; verify the actual asset list and promote the release before treating direct `releases/latest/download/` links as live. The release-page fallback always points to GitHub's latest release page.

Product copy lives in `src/content.ts`; visual tokens and responsive styles live in `src/styles.css`. See `ASSETS.md` for asset sources and `VERIFICATION.md` for checks performed.

The approved websitev2 design has been promoted into `website/`, the existing Vercel deployment directory. Root `dev:website` and `build:website` scripts continue to work.
