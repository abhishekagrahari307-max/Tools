# Birthday Wishes · Wishcraft Studio

**[Open Garima’s birthday card](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/#/wish/garima)** · [Open the studio](https://abhishekagrahari307-max.github.io/Tools/birthday-wishes/)

Choose one of six designs, add a name, a message in Hindi, Hinglish or English, and an optional photo. Play the preview to try the reveal.

- **Share wish → Copy wish link:** paste the whole link into WhatsApp or another chat. It opens the recipient’s card directly on another device, without a login, download or access to the sender’s drafts.
- **Share wish → Download birthday card:** send the self-contained HTML file instead. It works offline and keeps the photo at the draft’s resolution.

## How online links work

`index.html` contains the artwork, licensed fonts, styles and scripts. No backend or installation is required. The part of the URL after `#/wish/` identifies the built-in Garima card or contains a versioned snapshot of the individual wish. It is decoded in the recipient’s browser, not sent to the web host. **Anyone with the complete link can read or forward it**; it is not encrypted. Editing or deleting a draft does not change an already-sent link.

New links are limited to 8,000 characters. If needed, the studio makes a small thumbnail locally for the link, without changing the draft. If even that doesn’t fit, the button explicitly offers a link without the photo; the HTML download still includes it.

## Preview locally

Open `index.html` directly, or run this **from this folder** and visit `http://localhost:8000/`:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Copying a wish link uses the public studio address even from a local file/preview. To test the recipient view locally, append the copied `#/wish/…` fragment to the local studio URL.

## Publish on GitHub Pages

1. Upload this folder’s contents to the root of a public repository, or keep the folder in an existing Pages site.
2. Set the `<link rel="canonical">` in `index.html` to that studio’s public HTTPS address. This is the base for recipient links.
3. In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, select the branch containing the site and **/ (root)**, then save.
4. Once **pages build and deployment** succeeds, visit the studio and try a copied link in a private window.

Routes use URL fragments, so a project subdirectory works without redirects or server rewrite rules. Keep the published studio address stable for existing links.
