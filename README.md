# HTML to PDF

[![CI/CD](https://github.com/Zian502/html-to-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/Zian502/html-to-pdf/actions/workflows/ci.yml)

Use Chromium to render a local HTML file or web page into a searchable PDF while retaining CSS, web fonts, images, and backgrounds.

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
