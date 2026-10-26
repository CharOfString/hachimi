# Custom logo

The startup logo is hidden by default. The name, version and account information
remain visible.

- `/logo` shows usage and the detected terminal graphics capabilities.
- `/logo off` hides the logo.
- `/logo ascii ~/Pictures/logo.txt` imports a UTF-8 text file.
- `/logo kitty ~/Pictures/logo.png` selects a PNG image.

Paths can contain spaces, with optional single or double quotes. ASCII artwork
retains indentation, supports Unicode block characters, and is limited to 120
columns and 20 lines. Tabs and terminal control sequences are rejected. Narrow
terminals truncate long lines. Imported text is saved in the user settings, so
the original text file is no longer required.

Kitty mode accepts PNG files up to 2 MiB and 16 million pixels. The image is fit
into at most 24 columns and 6 rows while preserving its aspect ratio. Its
absolute path is saved; keep the image file available for later sessions. This
mode works with terminals implementing the Kitty graphics protocol; the terminal
application does not need to be Kitty. When Unicode placeholders are confirmed,
Hachimi uses them. Otherwise it uses standard image placements at the logo's
rendered position, without sending Unicode placeholder glyphs to the terminal.
An explicit `/logo kitty` selection is accepted even when capability queries are
unanswered. It still needs a terminal with graphics support to show images.
Keyboard protocol support alone does not imply image support. In tmux, enable
`allow-passthrough`. Redirected, non-TTY output does not emit images.

Settings are stored under `ui.logo` in the user `.gemini/settings.json` and take
effect immediately. `ui.hideBanner` and screen-reader mode also hide the logo.
Gemini configuration paths and `GEMINI.md` support are unchanged.

The implementation follows the
[Kitty graphics protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/#unicode-placeholders),
including quiet chunked PNG transfer, standard image placements, optional
Unicode image cells and tmux escaping.

Detection follows Kitty source revision
[`2805c0e4`](https://github.com/kovidgoyal/kitty/blob/2805c0e4e9f8c3a488e86337a65f62c8e4a7942a/docs/graphics-protocol.rst).
The `a=q` image probe confirms basic graphics; the `e=T,U=1` feature query
confirms Unicode placeholders. Feature queries were added in Kitty 0.50. For
older Kitty releases, a successful graphics probe plus a terminal-reported Kitty
version of at least 0.28 is accepted. Other terminals without feature-query
support use standard placements rather than Unicode placeholders. Restart
Hachimi after changing terminal or tmux passthrough settings.
