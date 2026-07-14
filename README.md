# HTML to PDF

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
