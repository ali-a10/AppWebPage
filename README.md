# LetsPlay marketing site

Static HTML/CSS for [letsplayapp.ca](https://letsplayapp.ca). Two pages — the landing page (`index.html`) and the privacy policy (`privacy.html`) — sharing a single stylesheet at `assets/styles.css`. No build step, no JS, no external dependencies.

## Local preview

Open either page directly in a browser:

```
webPage/index.html
webPage/privacy.html
```

…or serve the folder with any static server, e.g.:

```
npx serve webPage
```

## Deploying via GitHub Pages

1. In the repo on GitHub: **Settings → Pages**.
2. **Source:** `Deploy from a branch`.
3. **Branch:** `main`, **Folder:** `/webPage`.
4. Add `letsplayapp.ca` as the custom domain and follow GitHub's [custom-domain DNS instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) to point the apex domain at GitHub Pages.

## Things to update before launch

The store badges currently use **"Coming soon" placeholders** (`.store-badge--soon`) — they are not clickable and do not use Apple's or Google's official artwork. This is intentional for the pre-launch / developer-program-application phase.

Once your apps are approved and live, replace each `.store-badge--soon` `<div>` with a real `<a>` linking to the App Store / Google Play listing, and swap in the **official badge artwork**:

- Apple App Store badge: download from <https://tools.applemediaservices.com/app-store>
- Google Play badge: download from <https://play.google.com/intl/en_us/badges/>

Apple's and Google's marketing guidelines require the use of their official badges in production — do not ship hand-drawn approximations.
