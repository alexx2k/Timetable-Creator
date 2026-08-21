# Timetable Creator

A browser-based editor for creating and printing pool timetables.

Live site: timetable.alexbalsillie.com

## Project structure

```text
index.html                 Page structure and application shell
css/
  app.css                  Workspace, responsive, dark-mode and print styling
  ui.css                   Simplified UI and rendered Markdown styling
  footer-editor.css        Optional footer Markdown editor dialog
js/
  core.js                  Timetable state, bookings, rendering and base interactions
  defaults.js              Default booking types and colours
  project.js               Project setup, centres, file format and autosave
  editor.js                Drag-to-create, quick type selection and copy/place interactions
  professional.js          Undo/redo, multi-select, overlap warnings and context menus
  exact-half-coverage.js   Exact top/bottom 50% pool coverage behaviour
  theme.js                 Light/dark appearance handling
  ui.js                    User-facing wording, rendered footer and booking-type UI
  footer-editor.js         Quick footer fields and optional Markdown editing
  boot.js                  Application startup
tests/
  smoke.mjs                Chromium release smoke test
fslt-logo.png              Printed FSLT logo
```

The application uses plain browser JavaScript with no framework or build step. Scripts are loaded in dependency order from `index.html`, with `boot.js` starting the application after the feature files are ready. The old standalone startup/marketing screen and its styling have been removed; a first-time visit opens the New timetable setup dialog directly over the workspace, while an autosaved timetable opens immediately.

## Footer editing

The Settings panel keeps the standard venue, contact and admission-policy fields for quick changes. **Edit with Markdown** opens a larger modal editor when line breaks, bold, italics or lists are needed. Markdown changes are held as a draft until **Apply changes** is pressed; cancelling leaves the current footer untouched.

## Validation

GitHub Actions runs two checks on pushes and pull requests:

- JavaScript syntax validation across `js/` and `tests/`.
- A Chromium smoke test covering first-use setup, a five-lane timetable, exact half-pool geometry, booking drag and resize, copy/place, reusable and Custom booking types, creating a new booking type from the floating menu, the printed key, quick footer edits, Markdown Apply/Cancel behaviour, save/reopen, older V2 compatibility, undo/redo and PDF generation.

## Timetable files

Saved timetable JSON uses the `fslt-pool-timetable` format. The file-format version remains version 2 so existing V2 timetable files stay compatible. V2.2 exports identify the application as version 2.2 and retain Markdown footer content.
