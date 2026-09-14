const fs = require('fs')
let content = fs.readFileSync('docs/superpowers/plans/2026-09-11-phase-2-2a-opt-plan.md', 'utf8')
content = content.replace(
  /### \[x\] 2a-opt-1 — Settings Popover UI/,
  '### [ ] 2a-opt-1 — Settings Popover UI'
)
content = content.replace(
  /### \[x\] 2a-opt-2 — App Layout and Settings Integration/,
  '### [ ] 2a-opt-2 — App Layout and Settings Integration'
)
content = content.replace('Status: built', 'Status: building')
fs.writeFileSync('docs/superpowers/plans/2026-09-11-phase-2-2a-opt-plan.md', content)
