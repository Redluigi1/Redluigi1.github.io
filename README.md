# ayush-portfolio

Personal site for Ayush Kumar. Plain HTML, CSS and JS with no build step, so it deploys to GitHub Pages as is.

## Run locally

```
python -m http.server 5510
```

Then open http://localhost:5510.

## Deploy

Live at https://redluigi1.github.io/, served by GitHub Pages from the `main` branch root of `Redluigi1/Redluigi1.github.io`. Push to `main` and the site redeploys in a minute or two. All paths are relative, so the folder also works under any other repo name.

## Editing

- Copy lives in `index.html`.
- Colors and type are CSS variables at the top of `styles.css`.
- `main.js` holds the loader, smooth scroll, the hero portrait (ASCII intro plus the warm monochrome grade in `gradePortrait`), the four case-study interactions (loop diagram, war-room trace, results chart, address NER demo) and the scroll reveals.
- `scene.js` is the WebGL particle scene (noise, neural network, point-cloud portrait built from `assets/img/portrait-suit-cut-700.webp`). It loads three.js from jsDelivr.
- The graduation clip is `assets/video/convocation.mp4`; set `MEDIA.gradVideo` in `main.js` to `null` to use the still instead.
- To update the resume, replace `assets/Ayush_Kumar_Resume.pdf`.

## Stack

GSAP 3.15 (ScrollTrigger, SplitText) and Lenis, loaded from jsDelivr. Fonts are Geist, Geist Mono and Instrument Serif from Google Fonts. If the CDN is unreachable, the page still renders with all content visible and no animation.
