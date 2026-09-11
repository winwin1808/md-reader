const fs = require('fs')

// Update Spec
let spec = fs.readFileSync('docs/superpowers/specs/2026-09-11-phase-2-design.md', 'utf8')
spec = spec.replace(/SettingsPopover/g, 'SettingsModal')
spec = spec.replace(/popover/g, 'modal')
fs.writeFileSync('docs/superpowers/specs/2026-09-11-phase-2-design.md', spec)

// Update Plan
let plan = fs.readFileSync('docs/superpowers/plans/2026-09-11-phase-2-2a-opt-plan.md', 'utf8')
plan = plan.replace(/SettingsPopover/g, 'SettingsModal')
plan = plan.replace(/popover\/dropdown/g, 'modal (hộp thoại)')
plan = plan.replace(/popover/g, 'modal')
fs.writeFileSync('docs/superpowers/plans/2026-09-11-phase-2-2a-opt-plan.md', plan)
