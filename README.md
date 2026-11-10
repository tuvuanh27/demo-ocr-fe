# demo-ocr-fe

A React + Vite web front end for document OCR and structured extraction, powered by the Datalab Document Intelligence API.

## Features

- **Document conversion**: convert uploaded documents to Markdown, HTML, JSON, or chunks (`POST /api/v1/convert`).
- **Structured extraction**: extract JSON fields from a document using a JSON schema you define (`POST /api/v1/extract`). The default schema targets Vietnamese land-record fields such as `so_to` (sheet number), `so_thua` (parcel number), and `dia_chi` (address).
- **Block viewer**: overlays OCR blocks (e.g. `SECTIONHEADER`) on the page image so results can be checked against the source.
- **JSON viewer**: browse raw API responses.
- **Copy as cURL**: the app generates equivalent cURL commands for the requests it makes.

## Prerequisites

- Node.js and npm
- A Datalab API key (enter it in the app's settings; it is stored in the browser's `localStorage`)

## Getting started

```bash
npm install
npm run dev       # start the Vite dev server
```

Open the URL printed by Vite, then add your API key in the app.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server with HMR        |
| `npm run build`   | Build for production into `dist/`    |
| `npm run preview` | Serve the production build locally   |
| `npm run lint`    | Run ESLint over the project          |

## How API calls work

- **Development**: requests to `/api-service/...` are proxied by Vite (`vite.config.js`) to `https://www.datalab.to/api/v1`. This avoids CORS issues.
- **Production**: the app calls `https://www.datalab.to/api/v1` directly.
- Long-running jobs are polled through the `check_url` returned by the API until they complete or fail.

## Project structure

```
src/
  App.jsx                    main UI (upload, settings, results)
  services/documentApi.js    convert / extract / polling client
  utils/markdownParser.js    turns Markdown output into blocks
  components/JsonViewer.jsx  JSON result viewer
  data/sampleBlocks.js       sample OCR blocks
  theme/                     Material theme and design tokens
```

## Project tracking

This project uses [beads](https://github.com/gastownhall/beads) (`bd`) for issue tracking. See `AGENTS.md` and run `bd prime` for workflow details.
