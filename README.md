# LetsPlay marketing site

Static HTML/CSS for [letsplayapp.ca](https://letsplayapp.ca), sharing a single stylesheet at `assets/styles.css`. No build step, no JavaScript, no external dependencies.

`delete-account.html` is the URL Google Play requires under **App content → Data safety → Account deletion**, so it must stay reachable at that path.

## Local preview

Open any page directly in a browser:

```
webPage/index.html
webPage/privacy.html
webPage/contact.html
webPage/delete-account.html
```

…or serve the folder with any static server, e.g.:

```
npx serve webPage
```

## Deploying via GitHub Pages

1. In the repo on GitHub: **Settings → Pages**.
2. **Source:** `Deploy from a branch`.
3. **Branch:** `main`, **Folder:** `/ (root)`.
4. Add `letsplayapp.ca` as the custom domain and follow GitHub's [custom-domain DNS instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) to point the apex domain at GitHub Pages.

## Store badges

`assets/app-store-badge.svg` and `assets/google-play-badge.png` are the official artwork, downloaded from:

- Apple: <https://tools.applemarketingtools.com>
- Google: <https://play.google.com/intl/en_us/badges/>

Both stores' guidelines require the badges to be used unmodified, and the footer must keep the Apple and Google trademark notice. To change language or style, download a new badge from those pages rather than editing the files.
