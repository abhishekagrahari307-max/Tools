# Browser codecs

`codecs.js` contains the ESM browser exports `zlibSync` and `unzlibSync` from **fflate 0.8.2** and `qrcode` from **qrcode-generator 2.0.4**. It is a checked-in, tree-shaken bundle; guests do not contact npm or a CDN. Both upstream libraries use the [MIT license](LICENSE.txt).

To reproduce it from this directory (only needed when updating dependencies):

```sh
work=$(mktemp -d)
npm install --prefix "$work" --no-audit --no-fund fflate@0.8.2 qrcode-generator@2.0.4 esbuild@0.25.12
printf '%s\n' "export { zlibSync, unzlibSync } from 'fflate';" "export { default as qrcode } from 'qrcode-generator';" > "$work/entry.js"
"$work/node_modules/.bin/esbuild" "$work/entry.js" --bundle --format=esm --minify --legal-comments=none --banner:js='/* fflate 0.8.2 and qrcode-generator 2.0.4. MIT; see LICENSE.txt. */' --outfile=codecs.js
```
