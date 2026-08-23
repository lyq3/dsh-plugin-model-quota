export const MODEL_QUOTA_STYLE_ID = 'dsh-model-quota-styles'

export const modelQuotaStyles = `
.mq-dock{box-sizing:border-box;width:100%;max-width:var(--dsh-chat-content-width,748px);margin:0 auto;padding:3px calc(var(--dsh-composer-side-clearance,16px) + 16px) 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;position:relative}
.mq-dock__line{min-width:0;display:flex;align-items:center;gap:8px;white-space:nowrap}
.mq-dock__trigger{min-width:0;flex:1;display:flex;align-items:center;gap:7px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:5px;padding:0;overflow:hidden}
.mq-dock__trigger:focus-visible,.mq-icon-button:focus-visible,.mq-button:focus-visible,.mq-input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4b83f5);outline-offset:2px}
.mq-dock__title{color:var(--dsw-alias-label-secondary);font-weight:500;flex:none}
.mq-dock__accounts{min-width:0;display:flex;gap:10px;overflow-x:auto;scrollbar-width:none}
.mq-dock__accounts::-webkit-scrollbar{display:none}
.mq-dock__account{display:inline-flex;gap:4px;flex:none}
.mq-dock__label{max-width:130px;overflow:hidden;text-overflow:ellipsis}
.mq-quota{font-variant-numeric:tabular-nums}
.mq-status--available{color:var(--dsw-alias-label-tertiary)}
.mq-status--low{color:var(--dsw-alias-state-warning-primary,#b7791f)}
.mq-status--exhausted{color:var(--dsw-alias-state-danger-primary,#d14343)}
.mq-status--error{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}
.mq-icon-button{width:24px;height:24px;flex:none;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:transparent;border:0;border-radius:999px;padding:0}
.mq-icon-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mq-icon-button[aria-busy=true]{animation:mq-spin 1s linear infinite}
@keyframes mq-spin{to{transform:rotate(360deg)}}
.mq-popover{z-index:100;box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:min(520px,70vh);position:absolute;right:16px;bottom:calc(100% + 8px);overflow:auto;border:1px solid var(--dsw-alias-border-inverted,var(--dsw-alias-border-l1));border-radius:12px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-base));box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.18));color:var(--dsw-alias-label-secondary);padding:12px}
.mq-popover__header,.mq-section-title,.mq-card__header,.mq-actions,.mq-field__head,.mq-preview__header{display:flex;align-items:center;gap:8px}
.mq-popover__header{justify-content:space-between;margin-bottom:8px}
.mq-popover__title,.mq-card__title{margin:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}
.mq-popover__meta{color:var(--dsw-alias-label-tertiary);font-size:11px;margin:0 0 8px}
.mq-detail-list,.mq-window-list,.mq-preview-list,.mq-unsupported-list{list-style:none;margin:0;padding:0}
.mq-detail{padding:9px 0;border-top:1px solid var(--dsw-alias-border-l2)}
.mq-detail:first-child{border-top:0}
.mq-detail__heading{display:flex;align-items:baseline;gap:6px;color:var(--dsw-alias-label-primary);font-weight:500}
.mq-detail__provider{text-transform:capitalize}
.mq-detail__label{margin:2px 0 5px;overflow-wrap:anywhere}
.mq-detail__grid{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
.mq-detail__grid dt{color:var(--dsw-alias-label-tertiary)}
.mq-detail__grid dd{margin:0;text-align:right;overflow-wrap:anywhere}
.mq-window-list{margin-top:5px;padding-left:12px}
.mq-window{display:flex;justify-content:space-between;gap:10px;color:var(--dsw-alias-label-tertiary)}
.mq-card{box-sizing:border-box;width:100%;max-width:760px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);padding:16px}
.mq-card__header{align-items:flex-start;justify-content:space-between;margin-bottom:14px}
.mq-card__description{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.mq-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.mq-field{min-width:0;display:flex;flex-direction:column;gap:5px}
.mq-field--wide{grid-column:1/-1}
.mq-field__head{justify-content:space-between}
.mq-label{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}
.mq-hint,.mq-field-error,.mq-save-state,.mq-preview__meta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.mq-field-error,.mq-save-state--failed{color:var(--dsw-alias-state-danger-primary,#d14343)}
.mq-input{box-sizing:border-box;width:100%;height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;padding:6px 9px}
.mq-input[aria-invalid=true]{border-color:var(--dsw-alias-state-danger-primary,#d14343)}
.mq-secret-row{display:flex;gap:8px}
.mq-secret-row .mq-input{min-width:0;flex:1}
.mq-badge{display:inline-flex;align-items:center;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px;padding:0 7px}
.mq-button{min-height:32px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;padding:5px 10px}
.mq-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.mq-button--primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);border-color:transparent}
.mq-button:disabled{cursor:not-allowed;opacity:.55}
.mq-actions{grid-column:1/-1;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--dsw-alias-border-l2);padding-top:14px}
.mq-save-state{margin-right:auto}
.mq-preview{grid-column:1/-1;border-top:1px solid var(--dsw-alias-border-l2);padding-top:14px}
.mq-preview__header{justify-content:space-between;margin-bottom:6px}
.mq-section-title{margin:0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}
.mq-preview-list li,.mq-unsupported-list li{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid var(--dsw-alias-border-l2)}
.mq-preview-list li:first-child,.mq-unsupported-list li:first-child{border-top:0}
.mq-preview__identity{min-width:0;overflow-wrap:anywhere}
.mq-preview__provider{text-transform:capitalize;color:var(--dsw-alias-label-tertiary);margin-right:6px}
.mq-connection{grid-column:1/-1;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);padding:9px 10px;font-size:12px}
.mq-connection p{margin:0}
@container (max-width:560px){.mq-form{grid-template-columns:1fr}.mq-field--wide,.mq-actions,.mq-preview,.mq-connection{grid-column:1}.mq-actions{justify-content:stretch}.mq-actions .mq-button{flex:1}}
@media (max-width:560px){.mq-dock{padding-left:16px;padding-right:16px}.mq-dock__label{max-width:88px}.mq-popover{position:fixed;left:12px;right:12px;bottom:12px;width:auto;max-height:70vh}.mq-card{padding:13px;container-type:inline-size}.mq-form{grid-template-columns:1fr}.mq-field--wide,.mq-actions,.mq-preview,.mq-connection{grid-column:1}.mq-secret-row{align-items:stretch;flex-direction:column}.mq-card__header{flex-direction:column}}
@media (prefers-reduced-motion:reduce){.mq-icon-button[aria-busy=true]{animation:none}}
`

export function injectModelQuotaStyles(documentRef: Document = document): () => void {
  const existing = documentRef.getElementById(MODEL_QUOTA_STYLE_ID)
  if (existing !== null) return () => undefined

  const style = documentRef.createElement('style')
  style.id = MODEL_QUOTA_STYLE_ID
  style.dataset.plugin = 'dsh-plugin-model-quota'
  style.textContent = modelQuotaStyles
  documentRef.head.appendChild(style)
  return () => style.remove()
}
