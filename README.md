# Whispers

Whispers is a small, privacy-focused website for anonymous encrypted file storage. The site is built with Eleventy and uses browser-side encryption so files are stored on the server only as encrypted blobs.

## What it does

- Generates a browser-side encryption key on first visit
- Encrypts files locally before uploading them
- Stores uploaded files on the server under a per-user directory
- Lets the user list stored files and download/decrypt them locally
- Includes a simple contact page that submits to a PHP mail handler

## Project structure

- `site.in/` — Eleventy source templates and assets
  - `site.in/index.njk` — homepage and encrypted file upload interface
  - `site.in/contact.njk` — contact page with PHP mail handling
  - `site.in/api/` — standalone PHP endpoints
  - `site.in/assets/` — CSS and JavaScript assets
- `site.out/` — generated build output for deployment
- `scripts/` — deployment helper scripts
- `eleventy.config.js` — Eleventy configuration and passthrough copy rules
- `package.json` — build and deploy scripts

## Development

Install dependencies:

```bash
npm install
```

Run a local preview:

```bash
npm run dev
```

Build the site:

```bash
npm run build
```

## Deployment

The project is configured to deploy the generated site to DreamHost with:

```bash
npm run deploy
```

This uses `rsync` to copy the contents of `site.out/` to the target host.

## Notes

- The encryption and decryption logic runs in the browser.
- The PHP endpoint stores encrypted files and metadata on the server.
- The contact form currently uses PHP’s `mail()` function, so delivery depends on the hosting environment’s mail configuration.
