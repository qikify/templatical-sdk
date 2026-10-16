---
"@templatical/editor": minor
---

Add your own sections to the block settings panel

`blockSettings` takes a list of sections that appear below the built-in ones for the selected block. Each has an `id`, a `title`, an optional `appliesTo` and `summary`, an optional `stylesheet`, and a `mount(el, ctx)` that fills the section with your DOM and may return a cleanup. `ctx.update()` edits the block through the normal update path, so every change is an Undo/Redo step and marks the template dirty, and `ctx.onChange()` also fires on Undo/Redo. Works in `init()` and `initCloud()`. `BlockSettingsSection` and `BlockSettingsContext` are exported.
