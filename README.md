# Timetable Creator

A browser-based editor for creating and printing pool timetables.

Live site: timetable.alexbalsillie.com

## Project structure

```text
index.html                 Page structure and application shell
css/
  app.css                  Editor, responsive, dark-mode and print styling
js/
  core.js                  Timetable state, bookings, rendering and base interactions
  project.js               Project setup, centres, file format, autosave and startup wizard
  editor.js                Drag-to-create, quick type selection and copy/place interactions
  professional.js          Undo/redo, multi-select, overlap warnings and context menus
  exact-half-coverage.js   Exact top/bottom 50% pool coverage behaviour
  theme.js                 Light/dark appearance handling
  boot.js                  Application startup
fslt-logo.png               Printed FSLT logo
```

The JavaScript is deliberately split by responsibility while retaining plain browser JavaScript and no build step. Scripts are loaded in dependency order from `index.html`, with `boot.js` starting the application after the feature files are ready.

## Validation

GitHub Actions runs a JavaScript syntax check for files in `js/` on pushes and pull requests.

## Timetable files

Saved timetable JSON uses the `fslt-pool-timetable` format. The current file-format version remains version 2 so existing V2 timetable files stay compatible.
