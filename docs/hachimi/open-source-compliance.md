# Open-source review of the Hachimi changes

Review date: 2026-10-26.

## Scope and provenance

This review covers the command/package rename, the provider-account feature, and
the approval presets, and the associated source formatting and distribution
changes. It is not a license audit of every dependency already present in the
upstream repository.

The base repository is Gemini CLI, distributed under Apache-2.0. Its LICENSE and
existing Google copyright notices are retained. Modified source files carry a
modification copyright notice naming CharOfString <root@charofstring.cc>.
Original Hachimi source files use that name as their copyright holder.

The provider catalog in `packages/core/src/providers/presets.ts` was adapted
from `packages/core/src/providers/presets/*.ts` in the supplied Qwen Code
checkout, revision `64b2554801e45bef1d1482325cdf35d80a0ba79e`. The catalog
retains `Copyright 2026 Qwen Team` and adds the Hachimi modification notice. The
complete reference LICENSE, including its Google and Qwen attribution lines, is
retained in `third_party/qwen-code/LICENSE`. No root or provider-directory
NOTICE file was present in that reference checkout. Notices belonging to other,
unimported Qwen modules were not copied.

Account storage, protocol adapters and account-management UI are Hachimi
implementations informed by the reference workflow. No new third-party npm
dependencies were added for this feature.

Approval preset behavior references Qwen's `approvalModeCommand.ts`,
`useAutoAcceptIndicator.ts` and `approval-mode.ts` at the same revision. Hachimi
adapts approval-mode cycling in its existing hook, retaining Google's header and
adding the modification notice. Its command switches only between the Hachimi
and classic Gemini mechanisms. Qwen's AUTO classifier and session-mode command
behavior are not imported. These changes add no dependencies.

The global response-language preference is a Hachimi implementation in
`packages/core/src/utils/languagePreference.ts`, informed by the idea behind
Qwen's `packages/cli/src/i18n/languageUtils.ts` (a global `output-language.md`
rule file) at the same revision. It reads a user-written
`~/.gemini/LANGUAGE_PREFERENCE.md` instead of generating a rule file, and adds
Linux virtual console detection that forces English. No Qwen source, prompt text
or language tables are copied, and it adds no dependencies. Google's
`promptProvider.ts` retains its header and carries the modification notice.

## License obligations and distribution

The review uses the authoritative
[Apache License 2.0, section 4](https://www.apache.org/licenses/LICENSE-2.0).
The implementation preserves the license text, original applicable copyright
notices, modification notices and source attribution. `NOTICE` records the
upstream sources and the nature of the modifications.

Root, CLI and core npm packaging includes LICENSE and NOTICE. The build and
release preparation scripts copy the Qwen license into bundled or compiled
assets. The standalone build copies those bundle assets beside the executable.
Provider names identify compatibility; they do not claim provider endorsement.

Validation checks that the expected notices appear in npm package file lists,
that bundled copies match the source documents, and that the reference Qwen
license is preserved byte-for-byte. Existing upstream notices for unrelated
components remain unchanged.
