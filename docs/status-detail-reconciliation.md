# Status detail reconciliation

The detailed status export contains unlabeled numeric subtotals between service rows and one final total. Those are reconciliation rows, not income transactions. In the October 7 reproduction, summing all numeric rows produced exactly three times the original service total.

The detailed reader now requires a service on every transaction. It resolves context fields only within actual Excel merge ranges. Empty unmerged insurer/channel/date values stay empty. Detailed reports with `تاريخ الحجز` cannot enter the aggregate status parser. A weak one-column total without title evidence cannot classify a department view as an expense report.

Services are atomic even when their names contain commas. Zero-net services remain in patient/visit/service counts. Contract/pricing entities are not treated as payment methods or evidence of deferred collection. Visit identity falls back to the patient key when the source lacks a file number; names remain excluded from saved/exported reports.

For status-detail-only financial inputs, absent expense/payment information remains null instead of becoming zero expenses, 100% profit or an invented cash balance. Dependent rules, target evaluations, health score, chart balance, export values and AI summary honor the unavailable fields. Adding financial source data retains the existing financial path.

Validation used the supplied workbooks through SheetJS 0.18.5 and the actual parseReport/analyze pipeline:

| Source | Service rows | Service total EGP | Dates |
| --- | ---: | ---: | ---: |
| Original system export | 871 | 372,278.51 | 30 |
| Prepared workbook | 872 | 372,778.51 | 30 |

Both contain 32 zero-net service rows. The prepared workbook includes one additional physical-therapy service for EGP 500 on September 29. Its extra department views are not added to the financial total. The sources therefore legitimately differ; the software must not force them to the same result.

Source workbooks and patient information are not committed. Anonymous regressions are in `tests/status-detail.cjs` and `tests/status-detail-ui.cjs` (test dependencies `xlsx` and `jsdom`). Existing tests for period selection, reconciliation, exports, workers, calculator, sharing, SQL permissions and secure AI also passed.

Existing archived PDFs are snapshots of the previous calculations. Refresh the deployed page and upload the original XLSX again to generate a corrected report. Cache version 51 covers both the page and worker modules. Configuration, database schema, authentication, branch study features and design features were not changed.
