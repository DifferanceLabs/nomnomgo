# URI decoder compatibility adapter

`query-string` 7 expects `require('decode-uri-component')` to return a function.
Upstream decode-uri-component 0.5.1 fixes GHSA-vcc3-ghjq-m6fr and
GHSA-qr28-fpjm-wq7f, but exports that function as ESM's default export.

This adapter exports the exact upstream function through CommonJS. The patched
upstream package is installed under an npm alias pinned to 0.5.1, with its
registry integrity recorded in package-lock.json. No upstream source is copied,
no decoder algorithm is reimplemented, and no advisory is suppressed.

Node 24 supports loading synchronous ESM through require; Metro also handles the
ESM dependency during web/native exports. The root dependency/override directs
legacy consumers to this adapter without changing the Expo SDK or query-string
API. Tests exercise Unicode and malformed query values and the adversarial
percent-run case in a worker with a deadline. Remove this adapter when the
navigation stack supports the patched decoder directly.

Upstream: https://github.com/SamVerschueren/decode-uri-component
