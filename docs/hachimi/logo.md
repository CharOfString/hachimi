# Custom logo

The startup logo is hidden by default. The name, version and account information
remain visible.

- `/logo` shows usage.
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
mode requires a terminal implementing the Kitty graphics protocol with Unicode
placeholders (Kitty 0.28 or newer). Selecting it explicitly opts into that
protocol; keyboard protocol support alone does not imply image support. In tmux,
enable `allow-passthrough`. Redirected, non-TTY output does not emit images.

Settings are stored under `ui.logo` in the user `.gemini/settings.json` and take
effect immediately. `ui.hideBanner` and screen-reader mode also hide the logo.
Gemini configuration paths and `GEMINI.md` support are unchanged.

The implementation follows the
[Kitty graphics protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/#unicode-placeholders),
including quiet chunked PNG transfer, Unicode image cells and tmux escaping.
