import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { ph } from "../lib/posthog";

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | permission_denied | no_camera | busy | error
  const [manualBarcode, setManualBarcode] = useState("");

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controlsRef.current?.stop();
              onResult(result.getText());
            }
            // No-result frames are normal — ignore them silently
          }
        );

        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
          setStatus("scanning");
        }
      } catch (e) {
        if (cancelled) return;
        const name = e?.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setStatus("permission_denied");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setStatus("no_camera");
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          setStatus("busy");
        } else {
          setStatus("error");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitManual = () => {
    const v = manualBarcode.trim();
    if (!v) return;
    ph.manualFoodEntryStarted(v);
    controlsRef.current?.stop();
    onResult(v);
  };

  const handleClose = () => {
    controlsRef.current?.stop();
    onClose();
  };

  const showVideo = status === "starting" || status === "scanning";

  const ERROR_CONTENT = {
    permission_denied: {
      icon: "📷",
      title: "Camera permission denied",
      body: "Allow camera access in your browser settings, then reload.\niOS: Settings → Safari → Camera → Allow.",
    },
    no_camera: {
      icon: "📵",
      title: "No camera found",
      body: "Enter the barcode number manually below.",
    },
    busy: {
      icon: "⚠️",
      title: "Camera in use",
      body: "Another app is using your camera. Close it and try again, or enter the barcode manually.",
    },
    error: {
      icon: "⚠️",
      title: "Couldn't start camera",
      body: "Enter the barcode number manually below.",
    },
  };

  const errContent = ERROR_CONTENT[status];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.93)",
        zIndex: 9600,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>

      {/* Close button */}
      <div style={{
        position: "absolute",
        top: "calc(20px + env(safe-area-inset-top, 0px))",
        right: 20,
      }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleClose}
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}>
          <X size={20} color="#fff" />
        </motion.button>
      </div>

      <div style={{ width: "100%", maxWidth: 360, padding: "0 20px" }}>
        <p style={{ color: "#fff", textAlign: "center", fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          Scan a barcode
        </p>

        {/* Camera view */}
        {showVideo && (
          <div style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            background: "#000",
            aspectRatio: "4/3",
            marginBottom: 20,
          }}>
            <video
              ref={videoRef}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              playsInline
              muted
              autoPlay
            />

            {/* Corner-bracket overlay */}
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}>
              <div style={{ width: 220, height: 90, position: "relative" }}>
                {/* Top-left */}
                <div style={{ position: "absolute", top: 0, left: 0, width: 22, height: 22, borderTop: "3px solid #534AB7", borderLeft: "3px solid #534AB7", borderRadius: "2px 0 0 0" }} />
                {/* Top-right */}
                <div style={{ position: "absolute", top: 0, right: 0, width: 22, height: 22, borderTop: "3px solid #534AB7", borderRight: "3px solid #534AB7", borderRadius: "0 2px 0 0" }} />
                {/* Bottom-left */}
                <div style={{ position: "absolute", bottom: 0, left: 0, width: 22, height: 22, borderBottom: "3px solid #534AB7", borderLeft: "3px solid #534AB7", borderRadius: "0 0 0 2px" }} />
                {/* Bottom-right */}
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderBottom: "3px solid #534AB7", borderRight: "3px solid #534AB7", borderRadius: "0 0 2px 0" }} />
                {/* Scan line */}
                {status === "scanning" && (
                  <motion.div
                    animate={{ y: [0, 88, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    style={{
                      position: "absolute",
                      left: 4,
                      right: 4,
                      height: 2,
                      background: "rgba(83,74,183,0.85)",
                      borderRadius: 1,
                    }}
                  />
                )}
              </div>
            </div>

            {/* "Starting..." overlay */}
            {status === "starting" && (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.5)",
              }}>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: 0 }}>Starting camera…</p>
              </div>
            )}
          </div>
        )}

        {/* Error states */}
        {errContent && (
          <div style={{
            background: "rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "20px 16px",
            marginBottom: 20,
            textAlign: "center",
          }}>
            <p style={{ fontSize: 28, margin: "0 0 8px" }}>{errContent.icon}</p>
            <p style={{ color: "#fff", fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>{errContent.title}</p>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: 0, lineHeight: 1.55, whiteSpace: "pre-line" }}>
              {errContent.body}
            </p>
          </div>
        )}

        {/* Manual entry — always visible */}
        <div>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center", marginBottom: 10, fontWeight: 500 }}>
            {status === "scanning" ? "— or enter manually —" : "Enter barcode manually"}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              data-testid="manual-barcode-input"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitManual(); }}
              onFocus={() => ph.manualFoodEntryStarted("")}
              placeholder="e.g. 5000168214628"
              inputMode="numeric"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                padding: "12px 14px",
                color: "#fff",
                fontSize: 15,
                outline: "none",
              }}
            />
            <button
              data-testid="manual-barcode-submit"
              onClick={submitManual}
              style={{
                background: "#534AB7",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 16px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
                minHeight: 44,
              }}>
              Go
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
