"use client";

import { useEffect, useState } from "react";
import { MAX_COPIES, MIN_COPIES } from "@/lib/copies";
import {
  PAPER_PRESETS,
  adapterFor,
  inspectPrinters,
  type PaperPreset,
  type PrintMethod,
  type PrinterStatus,
  validatePrintCopies,
} from "@/lib/print";

type Props = {
  imageUrl: string;
  onClose: () => void;
};

export function PrintDialog({ imageUrl, onClose }: Props) {
  const [copiesText, setCopiesText] = useState("1");
  const [method, setMethod] = useState<PrintMethod>("browser");
  const [paperPreset, setPaperPreset] = useState<PaperPreset>("fit");
  const [statuses, setStatuses] = useState<PrinterStatus[]>([
    { method: "browser", label: "Browser / system printer", available: true, detail: "Opens your operating system print dialog." },
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const parsed = validatePrintCopies(copiesText);
  const selected = statuses.find((item) => item.method === method);
  const paper = PAPER_PRESETS.find((item) => item.id === paperPreset) ?? PAPER_PRESETS[0];

  useEffect(() => {
    let active = true;
    inspectPrinters().then((next) => {
      if (active) setStatuses(next);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onPrint() {
    if (!parsed.ok || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await adapterFor(method).print({
        imageUrl,
        copies: parsed.copies,
        paperWidthMm: paper.widthMm,
        paperPreset,
        grayscale: paperPreset === "thermal-54" || paperPreset === "thermal-80",
      });
      setMessage(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-modal" role="dialog" aria-modal="true" aria-labelledby="print-dialog-title" onClick={onClose}>
      <div className="export-modal-card print-dialog-card" onClick={(event) => event.stopPropagation()}>
        <p id="print-dialog-title" className="export-modal-title">Print photo strip</p>
        <p className="export-modal-hint">For the RP30, run the local bridge and select Local print bridge with 80 mm paper. Browser printing remains available as a fallback.</p>
        <img src={imageUrl} alt="Print preview" className="export-modal-image" />
        <label className="control-label" htmlFor="print-method">Printing method</label>
        <div className="segmented print-method-row">
          {statuses.map((item) => (
            <button
              key={item.method}
              type="button"
              className={method === item.method ? "selected" : ""}
              onClick={() => setMethod(item.method)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="soft-note" role="status">{selected?.detail}</p>
        <label className="control-label spaced" htmlFor="paper-preset">Paper</label>
        <div className="segmented print-method-row">
          {PAPER_PRESETS.map((item) => (
            <button key={item.id} type="button" className={paperPreset === item.id ? "selected" : ""} onClick={() => setPaperPreset(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="control-label spaced" htmlFor="copies">Copies</label>
        <div className="copy-stepper">
          <button type="button" className="secondary-button" onClick={() => parsed.ok && setCopiesText(String(Math.max(MIN_COPIES, parsed.copies - 1)))} disabled={busy}>-</button>
          <input
            id="copies"
            inputMode="numeric"
            value={copiesText}
            onChange={(event) => setCopiesText(event.target.value)}
            aria-invalid={!parsed.ok}
          />
          <button type="button" className="secondary-button" onClick={() => parsed.ok && setCopiesText(String(Math.min(MAX_COPIES, parsed.copies + 1)))} disabled={busy}>+</button>
        </div>
        <p className="soft-note">{parsed.ok ? `${parsed.copies} cop${parsed.copies === 1 ? "y" : "ies"} selected` : parsed.error}</p>
        {message && <p className="soft-note" role="status">{message}</p>}
        <div className="export-modal-actions">
          <button type="button" className="primary-button full" onClick={onPrint} disabled={busy || !parsed.ok}>
            {busy ? "Opening print…" : "Print"}
          </button>
          <button type="button" className="secondary-button full" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
