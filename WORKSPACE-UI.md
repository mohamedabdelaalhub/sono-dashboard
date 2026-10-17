# Revenue analysis workspace

2026-10-17. Presentation changes only. No database, calculation, parser, source-selection or config.js changes.

`assets/js/workspace-ui.js` loads before app.js. App boot initializes the shell, tab selection refreshes the grouped navigation, and draw decorates newly rendered tables. The original tab keys, permission filters, file inputs, period controls and export handlers remain authoritative. Groups never remove permission-hidden classes or grant a tab. The archive's async fill decorates its tables after data arrives.

The header combines period context, a collapsible file area and one report-export menu. Five navigation groups retain existing sub-tabs. Summary starts with attention links and six metrics. Missing expense/patient coverage remains unavailable rather than zero; recorded movement is not labeled profit. Coverage warnings remain above the metrics, while source audits and narrative explanations move into disclosures.

Existing financial and employee-error drill-downs open within main as a full-width region. Expense, doctor and service links reuse current analysis/source data. An archive has no reconstructed raw movements. Returning removes only the detail region, preserving the underlying DOM, table searches, pagination, scroll and focus. Tab/period changes close a stale detail. New service movement details require the existing data permission and distinguish whole-receipt values from allocated service revenue.

Tables support scoped search and 25/50/100-row pages. Mobile tables retain two columns and an explicit row detail dialog containing every field and proxies for original authorized actions. Export clones remove UI controls and include every matching row across pages. Report PDF expands disclosures in its temporary clone. Native print temporarily expands details and restores them afterwards. Exports do not mutate the original table or drop matching rows after page one.

Table/archive actions use labeled SVG icons with gray rest state and blue hover/focus. Delete uses red. Archive deletion and clearing loaded files use a named confirmation dialog with cancel as initial focus and Escape cancellation. Clearing files does not delete archived reports.

Validation: all 20 CJS suites passed during implementation. workspace-ui.cjs covers grouped permission preservation, unavailable-data metrics, table search/pagination, detail return state, mobile row dialogs, full filtered export clones and confirmation choices. app-periods.cjs loads the workspace with the real app and verifies period/source behavior and confirmed clearing. CSS/JS syntax and git diff --check passed. A local synthetic preview was created for inspection, but the cloud browser blocked localhost. Production account and physical/mobile viewport visual checks were not completed. Do not claim a screenshot review or logged-in end-to-end UI test.

No new external AI calls or patient data writes were introduced.
