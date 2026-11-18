# Birthday Wishes · Wishcraft Studio

Choose one of six birthday card designs, write a message in Hindi, Hinglish or English, and preview the animated reveal. **Share wish → Download birthday card** exports a standalone HTML card the recipient can open in their browser, even offline.

`index.html` is the site. It contains the artwork, licensed fonts, styles and scripts from `Wishcraft-Studio-Enhanced-2.html`. No install, build, API key or backend is required. Drafts and saved templates stay in the visitor’s browser. Publishing the studio does not upload visitors’ wishes or photos.

## Preview locally

Open `index.html` in a browser, or run this command **from this folder** and visit `http://localhost:8000/`:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

## Publish as a separate GitHub Pages site

1. Create a public repository named `birthday-wishes`.
2. Upload this folder’s **contents** to that repository’s root. `index.html` should be at the top level, not inside another `birthday-wishes` folder.
3. In **Settings → Pages → Build and deployment**, select **Deploy from a branch**, choose the branch containing `index.html` (usually `main`) and **/ (root)**, then save.
4. Wait for **pages build and deployment** to finish. Open **Visit site** in the Pages settings for the public address.

The same files also work on a static host under a subdirectory. Sending a *personalized card* uses the HTML download; no wish-link publishing service is needed or enabled.
