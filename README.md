# BPSC NEXUS — Clean NIVA GitHub Update

Replace these files in the existing repository:

- index.html
- server.mjs
- package.json
- render.yaml

KEEP `records-1.js` through `records-8.js` exactly as they are.

## NIVA response cleanup
NIVA now renders responses cleanly:
- Markdown headings are converted into visual labels.
- Bold text is rendered normally.
- Bullets are rendered as proper list items.
- Code-style backticks are shown as small inline terms.
- Raw `###`, `**`, backticks, tables, JSON wrappers and code fences are not shown to students.
- NIVA is instructed to answer the actual question first instead of repeatedly giving generic preparation introductions.

## Other integrated features
The package retains the Custom Mock, question translator, NIVA modes, and analytics integration from the previous final build.

No record/question-bank files are included or modified.


### Answer-label fix
The quiz and NIVA now convert internal zero-based answer indexes to visible option letters (A/B/C/D), including the option text where appropriate. Internal scoring still uses the numeric index, so quiz correctness logic is unchanged.
