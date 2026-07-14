# HTML to PDF

[![CI/CD](https://github.com/Zian502/html-to-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/Zian502/html-to-pdf/actions/workflows/ci.yml)

Use Chromium to render a local HTML file or web page into a searchable PDF while retaining CSS, web fonts, images, and backgrounds.

## Web application

Install dependencies and Chromium, then start the local service:

```powershell
pnpm.cmd install
pnpm.cmd run install:browser
pnpm.cmd start
```

Open `http://127.0.0.1:4173`. Upload a `.html` or `.htm` file, select full-page or a paper format, and convert it. Generated PDFs are stored under `runtime/` and remain available in the page list for preview and download.

Development mode restarts the Node process when server files change:

```powershell
pnpm.cmd dev
```

The service binds to `127.0.0.1` by default. Use `PORT` to change the port and `HOST` only when the service must be reachable from another machine.

Uploaded HTML is rendered in safe mode: JavaScript and external requests are disabled. Use self-contained HTML with embedded styles, fonts, and images.

### HTTP API

```text
POST /api/pdfs?filename=report.html&mode=full-page&landscape=false
GET  /api/pdfs
GET  /api/pdfs/:id
GET  /api/pdfs/:id/download
```

The upload endpoint accepts the raw HTML file as its request body and limits uploads to 10 MiB. `mode` accepts `full-page`, `A4`, `A3`, or `Letter`.

## Setup

```powershell
cd D:\workspace\patsnap\tools\html-to-pdf
pnpm.cmd install
pnpm.cmd run install:browser
```

The browser installation step is optional when Google Chrome is already installed. The tool first uses Playwright Chromium and automatically falls back to the local Chrome installation.

## Usage

```powershell
pnpm.cmd pdf -- .\examples\report.html .\output\report.pdf
```

Render a URL:

```powershell
pnpm.cmd pdf -- https://example.com .\output\example.pdf
```

Match a fixed desktop canvas rather than A4:

```powershell
pnpm.cmd pdf -- .\page.html .\output\page.pdf --width 1440px --height 900px --viewport 1440x900
```

Automatically match the PDF to the full HTML canvas:

```powershell
pnpm.cmd pdf -- .\page.html .\output\page.pdf --full-page
```

Wait for an asynchronous application to finish rendering:

```powershell
pnpm.cmd pdf -- https://example.com .\output\page.pdf --wait-for "[data-ready=true]" --delay 500
```

Run `pnpm.cmd pdf -- --help` for all options.

## Rendering notes

- The default CSS media type is `screen`, so the PDF stays close to the browser view. Pass `--media print` to use the page's print stylesheet.
- The renderer waits for network idle, fonts, and images. Use `--wait-for` when the page loads data after navigation.
- Use `@page`, `break-inside`, `break-before`, and `break-after` in the source page to control pagination.
- Browser PDF output keeps text selectable. For strict pixel identity, a screenshot-based PDF mode is more appropriate, but text will no longer be selectable.

## Online conversion with GitHub Actions

GitHub Actions does not provide a file-upload input for manually triggered workflows. This repository uses GitHub's normal web upload flow instead:

1. Open the repository on GitHub.
2. Open the `uploads` directory.
3. Select **Add file**, then **Upload files**.
4. Upload a self-contained `.html` or `.htm` file and commit it to `main`.
5. Open **Actions**, then **Convert HTML to PDF**.
6. Open the latest run and download the `converted-pdfs-*` artifact.

The automatic upload flow uses `--full-page` to preserve a desktop page as one continuous PDF page. To use A4, A3, Letter, or landscape output, open **Actions**, select **Convert HTML to PDF**, choose **Run workflow**, and enter the path of an HTML file already stored in the repository.

GitHub's browser upload limit is 25 MiB per file. For reliable rendering, bundle styles and images into the HTML or upload its relative asset files alongside it.

## CI/CD

Every push and pull request automatically runs the `CI/CD` workflow. The pipeline installs locked dependencies, runs the test suite, installs Chromium, generates a real PDF from the example HTML, verifies the PDF signature and size, and publishes the result as a seven-day build artifact.

The separate `Convert HTML to PDF` workflow remains responsible for converting HTML files uploaded to the `uploads` directory.

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Zian502/html-to-pdf)

The root `render.yaml` creates a free Docker web service in Render's Singapore region. Each push runs GitHub Actions first; Render deploys the commit after the checks pass and exposes the service on an `onrender.com` URL.

Render's free instance uses an ephemeral filesystem. Generated PDFs can disappear when the instance restarts, sleeps, or is redeployed, so this setup is intended for demos rather than permanent document storage.

## License

Licensed under the [MIT License](./LICENSE). Copyright (c) 2026 Zian502.
