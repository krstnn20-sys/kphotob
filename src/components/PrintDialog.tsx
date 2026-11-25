
"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_COPIES, MIN_COPIES } from "@/lib/copies";
import { preparePrintRaster } from "@/lib/compose-strip";
import {
  sharePrintAdapter,
  validatePrintCopies,
} from "@/lib/print";

type Props = {
  imageUrl: string;
  onClose: () => void;
};

export function PrintDialog({ imageUrl, onClose }: Props) {
  const [copiesText, setCopiesText] = useState("1");
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const leftPageRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const parsed = validatePrintCopies(copiesText);

  useEffect(() => {
    let active = true;

    async function prepareImage() {
      setPreparing(true);
      setShareFile(null);

      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error("Photo strip could not be loaded.");
        }

        const sourceBlob = await response.blob();

        const raster = await preparePrintRaster(sourceBlob, {
          maxWidth: Number.MAX_SAFE_INTEGER,
          grayscale: true,
        });

        const file = new File(
          [raster.blob],
          "kixclicks-photo-strip.png",
          {
            type: "image/png",
            lastModified: Date.now(),
          },
        );

        if (active) setShareFile(file);
      } catch {
        if (active) {
          setMessage("Could not prepare photo strip. Please try again.");
        }
      } finally {
        if (active) setPreparing(false);
      }
    }

    prepareImage();

    return () => {
      active = false;
    };
  }, [imageUrl]);

  useEffect(() => {
    function markAway() {
      leftPageRef.current = true;
    }

    function recoverAfterReturn() {
      if (!leftPageRef.current) return;

      leftPageRef.current = false;
      setBusy(false);
      window.location.reload();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        markAway();
      } else {
        recoverAfterReturn();
      }
    }

    window.addEventListener("blur", markAway);
    window.addEventListener("focus", recoverAfterReturn);
    window.addEventListener("pagehide", markAway);
    window.addEventListener("pageshow", recoverAfterReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", markAway);
      window.removeEventListener("focus", recoverAfterReturn);
      window.removeEventListener("pagehide", markAway);
      window.removeEventListener("pageshow", recoverAfterReturn);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, []);

  async function onPrint() {
    if (!shareFile || busy || !parsed.ok) return;

    setBusy(true);
    setMessage("");

    try {
      const result = await sharePrintAdapter.print({
        imageUrl,
        shareFile,
        copies: parsed.copies,
        paperWidthMm: 80,
        grayscale: true,
        paperPreset: "thermal-80",
      });

      setMessage(result.message);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Printing failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="export-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-dialog-title"
      onClick={onClose}
    >
      <div
        className="export-modal-card print-dialog-card"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="print-dialog-title" className="export-modal-title">
          Print photo strip
        </p>

        <p className="export-modal-hint">
          Send your photo strip to BR RawPrinter to print.
        </p>

        <img
          src={imageUrl}
          alt="Print preview"
          className="export-modal-image"
        />

        <label className="control-label spaced" htmlFor="copies">
          Copies
        </label>

        <div className="copy-stepper">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              parsed.ok &&
              setCopiesText(
                String(Math.max(MIN_COPIES, parsed.copies - 1)),
              )
            }
            disabled={busy}
          >
            -
          </button>

          <input
            id="copies"
            inputMode="numeric"
            value={copiesText}
            onChange={(event) => setCopiesText(event.target.value)}
            aria-invalid={!parsed.ok}
          />

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              parsed.ok &&
              setCopiesText(
                String(Math.min(MAX_COPIES, parsed.copies + 1)),
              )
            }
            disabled={busy}
          >
            +
          </button>
        </div>

        <p className="soft-note">
          {parsed.ok
            ? `${parsed.copies} cop${parsed.copies === 1 ? "y" : "ies"} selected. Set the same number in BR RawPrinter.`
            : parsed.error}
        </p>

        <p className="soft-note">
          Select 80 mm paper in BR RawPrinter.
        </p>

        {preparing && (
          <p className="soft-note" role="status">
            Preparing photo strip...
          </p>
        )}

        {message && (
          <p className="soft-note" role="status">
            {message}
          </p>
        )}

        <div className="export-modal-actions">
          <button
            type="button"
            className="primary-button full"
            onClick={onPrint}
            disabled={busy || preparing || !shareFile || !parsed.ok}
          >
            {preparing ? "Preparing..." : busy ? "Opening..." : "PRINT"}
          </button>

          <button
            type="button"
            className="secondary-button full"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
