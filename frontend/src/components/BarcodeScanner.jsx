import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef(null);
  const detectionInterval = useRef(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (detectionInterval.current) clearInterval(detectionInterval.current);
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        startDetection();
      }
    } catch (e) {
      setError("Camera access denied. Please allow camera access and try again.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setScanning(false);
  };

  const startDetection = () => {
    // Use BarcodeDetector API if available
    if ("BarcodeDetector" in window) {
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
      detectionInterval.current = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              clearInterval(detectionInterval.current);
              stopCamera();
              onResult(barcodes[0].rawValue);
            }
          } catch (e) {}
        }
      }, 200);
    } else {
      // Fallback: show manual input
      setError("Barcode scanner not supported in this browser. Please enter the barcode manually.");
    }
  };

  const [manualBarcode, setManualBarcode] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>

      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={20} color="#fff" />
        </motion.button>
      </div>

      <div style={{ width: "100%", maxWidth: 360, padding: 20 }}>
        <p style={{ color: "#fff", textAlign: "center", fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Scan a barcode</p>

        {!error ? (
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} playsInline muted />
            {/* Scanner overlay */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 200, height: 80, border: "2px solid #534AB7", borderRadius: 8, position: "relative" }}>
                <div style={{ position: "absolute", top: -2, left: -2, width: 20, height: 20, borderTop: "3px solid #534AB7", borderLeft: "3px solid #534AB7", borderRadius: "2px 0 0 0" }} />
                <div style={{ position: "absolute", top: -2, right: -2, width: 20, height: 20, borderTop: "3px solid #534AB7", borderRight: "3px solid #534AB7", borderRadius: "0 2px 0 0" }} />
                <div style={{ position: "absolute", bottom: -2, left: -2, width: 20, height: 20, borderBottom: "3px solid #534AB7", borderLeft: "3px solid #534AB7", borderRadius: "0 0 0 2px" }} />
                <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderBottom: "3px solid #534AB7", borderRight: "3px solid #534AB7", borderRadius: "0 0 2px 0" }} />
                {scanning && (
                  <motion.div
                    animate={{ y: [0, 76, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ position: "absolute", left: 4, right: 4, height: 2, background: "#534AB7" }}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Manual input fallback */}
        <div style={{ marginTop: 20 }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center", marginBottom: 12 }}>
            {error || "Or enter barcode manually:"}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              data-testid="manual-barcode-input"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              placeholder="Enter barcode number..."
              style={{ flex: 1, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 15, outline: "none" }}
            />
            <button
              data-testid="manual-barcode-submit"
              onClick={() => { if (manualBarcode.trim()) { stopCamera(); onResult(manualBarcode.trim()); } }}
              style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "12px 16px", cursor: "pointer", fontWeight: 600 }}>
              Scan
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
