import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveMessage } from "../services/api";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";

export default function Conversation() {
  const navigate   = useRef(null);
  const { theme }  = useTheme();
  const th         = themes[theme];
  const isDark     = theme === "dark";
  const { t, language } = useLang();
  const isRTL      = language === "ar";
  const dir        = isRTL ? "rtl" : "ltr";

  const videoRef         = useRef(null);
  const canvasRef        = useRef(null);
  const overlayCanvasRef = useRef(null);
  const intervalRef      = useRef(null);
  const historyRef       = useRef([]);
  const recognitionRef   = useRef(null);
  const fileInputRef     = useRef(null);

  // ── Collecte frames WLASL (caméra) ──
  const wordFramesRef    = useRef([]);
  const wordCapturingRef = useRef(false);
  const wordTimerRef     = useRef(null);

  const [isRunning,      setIsRunning]      = useState(false);
  const [detectedLetter, setDetectedLetter] = useState("");
  const [currentWord,    setCurrentWord]    = useState("");
  const [sentence,       setSentence]       = useState("");
  const [messages,       setMessages]       = useState([]);
  const [confidence,     setConfidence]     = useState(0);
  const [top3,           setTop3]           = useState([]);
  const [isDetecting,    setIsDetecting]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [inputMode,      setInputMode]      = useState("asl");
  const [autoMode,       setAutoMode]       = useState(false);
  const [lastAutoLetter, setLastAutoLetter] = useState("");
  const [flash,          setFlash]          = useState(false);

  const [isListening,  setIsListening]  = useState(false);
  const [speechLang,   setSpeechLang]   = useState("fr-FR");
  const [interimText,  setInterimText]  = useState("");
  const [sttSupported, setSttSupported] = useState(true);
  const [speechError,  setSpeechError]  = useState("");

  // ── WLASL upload (fichier) ──
  const [wlaslFile,    setWlaslFile]    = useState(null);
  const [wlaslResult,  setWlaslResult]  = useState(null);
  const [wlaslLoading, setWlaslLoading] = useState(false);
  const [wlaslError,   setWlaslError]   = useState("");

  // ── WLASL caméra ──
  const [wordDetecting,  setWordDetecting]  = useState(false);
  const [wordResult,     setWordResult]     = useState(null);
  const [wordProgress,   setWordProgress]   = useState(0);   // 0-20 frames capturées
  const [wordCamError,   setWordCamError]   = useState("");

  const autoRef     = useRef(autoMode);
  const inputModeRef = useRef(inputMode);
  useEffect(() => { autoRef.current = autoMode; }, [autoMode]);
  useEffect(() => { inputModeRef.current = inputMode; }, [inputMode]);

  const ROI      = { x: 100, y: 100, w: 300, h: 300 };
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const SPECIAL  = ["0","1","2","3","4","5","6","7","8","9"];
  const SEQUENCE_LENGTH = 20;

  const SPEECH_LANGS = [
    { code: "fr-FR", flag: "FR", label: "Français" },
    { code: "en-US", flag: "EN", label: "English"  },
    { code: "ar-MA", flag: "AR", label: "العربية"  },
  ];

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSttSupported(false);
    return () => stopListening();
  }, []);

  // ════════════════════════════════════════════
  // CAMÉRA
  // ════════════════════════════════════════════
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      videoRef.current.srcObject = stream;
      await new Promise((res) => (videoRef.current.onloadedmetadata = res));
      videoRef.current.play();
      setIsRunning(true);
      startDetection();
    } catch {
      alert("Impossible d'accéder à la caméra");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    clearInterval(intervalRef.current);
    clearTimeout(wordTimerRef.current);
    wordCapturingRef.current = false;
    wordFramesRef.current = [];
    setIsRunning(false);
    setIsDetecting(false);
    setDetectedLetter("");
    setConfidence(0);
    setTop3([]);
    setWordDetecting(false);
    setWordProgress(0);
    historyRef.current = [];
  };

  // ── Capture une frame (canvas → base64) ──
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    canvas.width = 640; canvas.height = 480;
    ctx.save(); ctx.translate(640, 0); ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    ctx.restore();
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  // ════════════════════════════════════════════
  // DÉTECTION — LETTRE (mode asl/keyboard)
  // ════════════════════════════════════════════
  const startDetection = () => {
    intervalRef.current = setInterval(async () => {
      // En mode wlasl, on ne détecte pas les lettres
      if (inputModeRef.current === "wlasl") return;

      const imageData = captureFrame();
      if (!imageData) return;

      try {
        setIsDetecting(true);
        const res = await fetch("http://127.0.0.1:5000/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageData }),
        });
        const data = await res.json();
        if (data.letter) {
          historyRef.current.push(data.letter);
          if (historyRef.current.length > 5) historyRef.current.shift();
          const stable = historyRef.current.sort((a, b) =>
            historyRef.current.filter((v) => v === b).length -
            historyRef.current.filter((v) => v === a).length
          )[0];
          setDetectedLetter(stable);
          setConfidence(data.confidence);
          setTop3(data.top3 || []);
          if (autoRef.current && data.confidence >= 80 && stable !== "nothing" && stable !== lastAutoLetter) {
            setLastAutoLetter(stable);
            setFlash(true);
            setTimeout(() => setFlash(false), 300);
            if (stable === "space")    { setSentence((p) => (p + " " + currentWord).trim()); setCurrentWord(""); }
            else if (stable === "del") { setCurrentWord((p) => p.slice(0, -1)); }
            else                       { setCurrentWord((p) => p + stable); }
          }
        }
      } catch (err) {
        console.error("Erreur prédiction lettre:", err);
      } finally {
        setIsDetecting(false);
      }
    }, 1200);
  };

  // ════════════════════════════════════════════
  // DÉTECTION — MOT via CAMÉRA (mode wlasl)
  // Collecte 20 frames sur ~3s, puis envoie au modèle
  // ════════════════════════════════════════════
  const startWordCapture = () => {
    if (wordCapturingRef.current) return;
    wordCapturingRef.current = true;
    wordFramesRef.current   = [];
    setWordDetecting(true);
    setWordResult(null);
    setWordCamError("");
    setWordProgress(0);

    // Collecte 20 frames espacées de ~150ms = ~3 secondes
    const frameInterval = 150;
    let collected = 0;

    const collectFrame = () => {
      if (!wordCapturingRef.current) return;
      const frame = captureFrame();
      if (frame) {
        wordFramesRef.current.push(frame);
        collected++;
        setWordProgress(collected);
      }
      if (collected < SEQUENCE_LENGTH) {
        wordTimerRef.current = setTimeout(collectFrame, frameInterval);
      } else {
        // Toutes les frames collectées → envoyer au backend
        sendWordFrames(wordFramesRef.current);
      }
    };

    collectFrame();
  };

  const cancelWordCapture = () => {
    wordCapturingRef.current = false;
    wordFramesRef.current    = [];
    clearTimeout(wordTimerRef.current);
    setWordDetecting(false);
    setWordProgress(0);
  };

  const sendWordFrames = async (frames) => {
    wordCapturingRef.current = false;
    try {
      const res = await fetch("http://127.0.0.1:5000/api/predict/word/frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWordResult(data);
      setSentence((prev) => (prev + " " + data.word).trim());
      try { await saveMessage({ text: data.word, type: "wlasl" }); } catch {}
    } catch (err) {
      setWordCamError(err.message);
    } finally {
      setWordDetecting(false);
      setWordProgress(0);
    }
  };

  // ════════════════════════════════════════════
  // WLASL UPLOAD FICHIER
  // ════════════════════════════════════════════
  const predictWordFromFile = async () => {
    if (!wlaslFile) return;
    setWlaslLoading(true);
    setWlaslError("");
    setWlaslResult(null);
    try {
      const formData = new FormData();
      formData.append("video", wlaslFile);
      const res  = await fetch("http://127.0.0.1:5000/api/predict/word", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWlaslResult(data);
      setSentence((prev) => (prev + " " + data.word).trim());
      try { await saveMessage({ text: data.word, type: "wlasl" }); } catch {}
    } catch (err) {
      setWlaslError(err.message);
    } finally {
      setWlaslLoading(false);
    }
  };

  // ════════════════════════════════════════════
  // OVERLAY CAMÉRA
  // ════════════════════════════════════════════
  useEffect(() => {
    if (!isRunning) return;
    const drawOverlay = () => {
      const overlay = overlayCanvasRef.current;
      const video   = videoRef.current;
      if (!overlay || !video) return;
      overlay.width = video.clientWidth; overlay.height = video.clientHeight;
      const scaleX = video.clientWidth / 640, scaleY = video.clientHeight / 480;
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      const flippedX = overlay.width - (ROI.x + ROI.w) * scaleX;
      const x = flippedX, y = ROI.y * scaleY, w = ROI.w * scaleX, h = ROI.h * scaleY;
      const cornerLen = 20;
      const color = wordDetecting ? "#667eea" : confidence >= 70 ? "#56ab2f" : confidence >= 40 ? "#f7971e" : "#667eea";
      ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.strokeStyle = color; ctx.lineWidth = 3;
      [[x,y,x+cornerLen,y,x,y+cornerLen],[x+w-cornerLen,y,x+w,y,x+w,y+cornerLen],
       [x,y+h-cornerLen,x,y+h,x+cornerLen,y+h],[x+w-cornerLen,y+h,x+w,y+h,x+w,y+h-cornerLen]]
      .forEach(([x1,y1,x2,y2,x3,y3]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.stroke();
      });
      ctx.shadowBlur = 0;

      // Barre de progression frames (mode wlasl caméra)
      if (wordDetecting && wordProgress > 0) {
        const barW = w;
        const barH = 6;
        const barY = y + h + 8;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(x, barY, barW, barH);
        ctx.fillStyle = "#667eea";
        ctx.fillRect(x, barY, barW * (wordProgress / SEQUENCE_LENGTH), barH);
      }

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x, y - 28, 220, 24);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px 'Segoe UI'";
      const label = wordDetecting
        ? `Capture ${wordProgress}/${SEQUENCE_LENGTH}...`
        : (inputModeRef.current === "wlasl" ? "Appuyer pour capturer" : t("conv_place_hand"));
      ctx.fillText(label, x + 8, y - 11);
    };
    const id = setInterval(drawOverlay, 100);
    return () => clearInterval(id);
  }, [isRunning, confidence, language, wordDetecting, wordProgress]);

  // ════════════════════════════════════════════
  // SPEECH
  // ════════════════════════════════════════════
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSttSupported(false); return; }
    setSpeechError("");
    const recognition = new SR();
    recognition.lang           = speechLang;
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart  = () => setIsListening(true);
    recognition.onresult = (event) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += txt + " ";
        else                           interim += txt;
      }
      setInterimText(interim);
      if (final.trim()) { setSentence((prev) => (prev + " " + final.trim()).trim()); setInterimText(""); }
    };
    recognition.onerror = (e) => {
      if      (e.error === "not-allowed") setSpeechError(t("conv_mic_denied"));
      else if (e.error === "no-speech")   setSpeechError(t("conv_no_speech"));
      else                                setSpeechError(`Erreur : ${e.error}`);
      setIsListening(false);
    };
    recognition.onend = () => { setIsListening(false); setInterimText(""); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening   = () => { recognitionRef.current?.stop(); setIsListening(false); setInterimText(""); };
  const toggleListening = () => isListening ? stopListening() : startListening();

  const sendSpeechMessage = async () => {
    if (!sentence.trim()) return;
    stopListening();
    const msg = { text: sentence.trim(), type: "speech", time: new Date().toLocaleTimeString() };
    setMessages((p) => [msg, ...p]);
    try { await saveMessage({ text: sentence.trim(), type: "speech" }); } catch {}
    setSentence(""); setInterimText("");
  };

  const addLetter = () => {
    if (!detectedLetter || detectedLetter === "nothing") return;
    if (detectedLetter === "space")    addWord();
    else if (detectedLetter === "del") setCurrentWord((p) => p.slice(0, -1));
    else                               setCurrentWord((p) => p + detectedLetter);
  };

  const addWord = () => {
    if (!currentWord.trim()) return;
    setSentence((p) => (p + " " + currentWord).trim());
    setCurrentWord("");
  };

  const sendSentence = async () => {
    if (!sentence.trim()) return;
    const msg = { text: sentence.trim(), type: "asl", time: new Date().toLocaleTimeString() };
    setMessages((p) => [msg, ...p]);
    try { await saveMessage({ text: sentence.trim(), type: "asl" }); } catch {}
    setIsSpeaking(true);
    const utt = new SpeechSynthesisUtterance(sentence.trim());
    utt.lang = "en-US"; utt.rate = 0.9;
    utt.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
    setSentence("");
  };

  const clearAll = () => {
    stopListening();
    cancelWordCapture();
    setCurrentWord(""); setSentence(""); setDetectedLetter("");
    setConfidence(0); setTop3([]); setInterimText("");
    setWlaslFile(null); setWlaslResult(null); setWlaslError("");
    setWordResult(null); setWordCamError("");
    historyRef.current = [];
  };

  useEffect(() => () => { stopCamera(); stopListening(); }, []);

  const confColor = (c) => c >= 70 ? "#56ab2f" : c >= 40 ? "#f7971e" : "#e52d27";

  const sectionLabel = (text) => (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.8px",
      textTransform: "uppercase", color: th.textSecondary,
      margin: "0 0 10px", textAlign: isRTL ? "right" : "left",
    }}>
      {text}
    </p>
  );

  const card = (children, extra = {}) => (
    <div style={{
      background: th.bgCard, border: `1px solid ${th.border}`,
      borderRadius: 14, padding: 18, ...extra,
    }}>
      {children}
    </div>
  );

  return (
    <div style={{
      minHeight : "100vh",
      background: th.bg,
      color     : th.textPrimary,
      fontFamily: "'Segoe UI', Arial, sans-serif",
      direction : dir,
    }}>
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes fadeIn     { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes flashGreen { 0%{opacity:1} 100%{opacity:0} }
        @keyframes blink      { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ripple     { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.4);opacity:0} }
        @keyframes waveBar    { 0%,100%{height:4px} 50%{height:18px} }
        @keyframes wordPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(102,126,234,0.4)} 50%{box-shadow:0 0 0 8px rgba(102,126,234,0)} }
        .cv-btn { transition: all 0.16s ease; }
        .cv-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.88; }
        .cv-btn:active:not(:disabled) { transform: translateY(0); }
        .key-btn { transition: background 0.1s, transform 0.1s; }
        .key-btn:hover  { background: rgba(102,126,234,0.22) !important; transform: scale(1.07); }
        .key-btn:active { transform: scale(0.93); }
        .mic-btn { transition: all 0.18s ease; }
        .mic-btn:hover  { transform: scale(1.05); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}; border-radius: 10px; }
      `}</style>

      <Navbar />

      <div style={{
        display            : "grid",
        gridTemplateColumns: "1fr 1fr",
        height             : "calc(100vh - 56px)",
        minHeight          : "800px",
        overflow           : "hidden",
      }}>

        {/* ════ COLONNE GAUCHE — Caméra ════ */}
        <div style={{
          borderInlineEnd: `1px solid ${th.border}`,
          display        : "flex",
          flexDirection  : "column",
          overflow       : "hidden",
        }}>
          <div style={{
            display       : "flex",
            alignItems    : "center",
            justifyContent: "space-between",
            padding       : "14px 20px",
            borderBottom  : `1px solid ${th.border}`,
            flexDirection : isRTL ? "row-reverse" : "row",
            flexShrink    : 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: th.textPrimary }}>
              {t("conv_camera")}
            </span>
            {/* Toggle Auto (seulement en mode lettre) */}
            {inputMode !== "wlasl" && (
              <div
                onClick={() => setAutoMode((p) => !p)}
                style={{
                  display   : "flex", alignItems: "center", gap: 8,
                  cursor    : "pointer", padding: "5px 12px",
                  borderRadius: 20,
                  border    : `1px solid ${autoMode ? "#56ab2f" : th.border}`,
                  background: autoMode ? (isDark ? "rgba(86,171,47,0.15)" : "rgba(86,171,47,0.08)") : th.bgCard,
                  transition: "all 0.2s",
                  flexDirection: isRTL ? "row-reverse" : "row",
                }}
              >
                <div style={{
                  width: 30, height: 16, borderRadius: 8,
                  background: autoMode ? "#56ab2f" : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"),
                  position: "relative", transition: "all 0.2s", flexShrink: 0,
                }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%", background: "white",
                    position: "absolute", top: 2,
                    left: autoMode ? 16 : 2, transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: autoMode ? "#56ab2f" : th.textSecondary }}>
                  {autoMode ? t("conv_auto_on") : t("conv_auto_off")}
                </span>
              </div>
            )}
            {/* Badge mode WLASL actif */}
            {inputMode === "wlasl" && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px",
                borderRadius: 20, background: "rgba(102,126,234,0.15)",
                color: "#667eea", border: "1px solid rgba(102,126,234,0.25)",
              }}>
                Mode mots
              </span>
            )}
          </div>

          {/* Zone vidéo */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000", minHeight: "420px" }}>
            <video
              ref={videoRef} autoPlay playsInline muted
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: "scaleX(-1)", display: isRunning ? "block" : "none",
              }}
            />
            <canvas ref={overlayCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {!isRunning && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: isDark ? "#0a0a0a" : "#1a1a1a" }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                </div>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>{t("conv_cam_disabled")}</p>
              </div>
            )}

            {/* Badge status */}
            {isRunning && (
              <div style={{
                position: "absolute", top: 12,
                [isRTL ? "left" : "right"]: 12,
                background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
                borderRadius: 20, padding: "4px 10px",
                fontSize: 12, fontWeight: 600, color: "white",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: wordDetecting ? "#667eea" : isDetecting ? "#f7971e" : "#56ab2f",
                  display: "inline-block",
                  animation: (wordDetecting || isDetecting) ? "pulse 1s ease infinite" : "none",
                }} />
                {wordDetecting ? `Capture ${wordProgress}/${SEQUENCE_LENGTH}` : isDetecting ? t("conv_analyzing") : t("conv_listening")}
              </div>
            )}

            {/* Bouton capture mot — overlay sur la caméra en mode wlasl */}
            {isRunning && inputMode === "wlasl" && (
              <div style={{
                position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                display: "flex", gap: 10,
              }}>
                {!wordDetecting ? (
                  <button
                    className="cv-btn"
                    onClick={startWordCapture}
                    style={{
                      padding: "10px 22px", borderRadius: 24, border: "none",
                      background: "linear-gradient(135deg, #667eea, #764ba2)",
                      color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
                      boxShadow: "0 4px 16px rgba(102,126,234,0.45)",
                      animation: "wordPulse 2s ease infinite",
                    }}
                  >
                    🤟 Capturer le signe (~3s)
                  </button>
                ) : (
                  <button
                    className="cv-btn"
                    onClick={cancelWordCapture}
                    style={{
                      padding: "10px 22px", borderRadius: 24, border: "none",
                      background: "rgba(229,45,39,0.85)",
                      color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    ✕ Annuler
                  </button>
                )}
              </div>
            )}

            {flash && (
              <div style={{ position: "absolute", inset: 0, border: "3px solid #56ab2f", animation: "flashGreen 0.3s ease", pointerEvents: "none" }} />
            )}
          </div>

          {/* ── Panneau inférieur ── */}
          <div style={{
            padding: "12px 16px", borderTop: `1px solid ${th.border}`,
            flexShrink: 0, display: "flex", flexDirection: "column", gap: 10,
            maxHeight: "310px", overflowY: "auto",
          }}>
            {/* Bouton start/stop caméra */}
            <button
              className="cv-btn"
              onClick={isRunning ? stopCamera : startCamera}
              style={{
                padding: "11px", borderRadius: 10, border: "none",
                background: isRunning
                  ? "linear-gradient(135deg, #e52d27, #b31217)"
                  : "linear-gradient(135deg, #56ab2f, #a8e063)",
                color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: isRunning ? "0 3px 12px rgba(229,45,39,0.3)" : "0 3px 12px rgba(86,171,47,0.3)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                {isRunning ? <rect x="4" y="4" width="16" height="16" rx="2"/> : <path d="M8 5v14l11-7z"/>}
              </svg>
              {isRunning ? t("conv_stop_cam") : t("conv_start_cam")}
            </button>

            {/* ── Panneau lettre détectée (modes asl/keyboard) ── */}
            {inputMode !== "wlasl" && card(
              <>
                {sectionLabel(t("conv_detected"))}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 70, height: 70, borderRadius: 12,
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    border: `1px solid ${th.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 48, fontWeight: 900, fontFamily: "monospace",
                    color: confidence > 0 ? confColor(confidence) : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"),
                    transition: "color 0.3s", flexShrink: 0,
                  }}>
                    {detectedLetter && detectedLetter !== "nothing" ? detectedLetter : "?"}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {confidence > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 7, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 4, width: `${confidence}%`, background: confColor(confidence), transition: "width 0.4s ease, background 0.3s" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: confColor(confidence), minWidth: 42 }}>{confidence.toFixed(1)}%</span>
                      </div>
                    )}
                    {top3.length > 0 && top3.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, minWidth: 18, color: i === 0 ? "#667eea" : th.textSecondary, fontFamily: "monospace" }}>{item.letter}</span>
                        <div style={{ flex: 1, height: 5, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 4, width: `${item.confidence}%`, background: i === 0 ? "#667eea" : (isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"), transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 11, color: th.textSecondary, minWidth: 34, textAlign: "right" }}>{item.confidence.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  className="cv-btn" onClick={addLetter}
                  disabled={!detectedLetter || detectedLetter === "nothing"}
                  style={{
                    width: "100%", marginTop: 12, padding: "9px", borderRadius: 9, border: "none",
                    background: (!detectedLetter || detectedLetter === "nothing")
                      ? (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)")
                      : "linear-gradient(135deg, #667eea, #764ba2)",
                    color: (!detectedLetter || detectedLetter === "nothing") ? th.textMuted : "white",
                    fontWeight: 700, fontSize: 13,
                    cursor: (!detectedLetter || detectedLetter === "nothing") ? "not-allowed" : "pointer",
                    boxShadow: (!detectedLetter || detectedLetter === "nothing") ? "none" : "0 2px 10px rgba(102,126,234,0.3)",
                  }}
                >
                  {t("conv_add_letter")}
                </button>
                {autoMode && (
                  <p style={{ fontSize: 11, color: "#56ab2f", margin: "8px 0 0", textAlign: "center" }}>
                    {t("conv_auto_hint")}
                  </p>
                )}
              </>
            )}

            {/* ── Résultat mot via caméra (mode wlasl) ── */}
            {inputMode === "wlasl" && card(
              <>
                {sectionLabel("Résultat — détection mot")}
                {!isRunning && (
                  <p style={{ color: th.textMuted, fontSize: 12, margin: "0 0 8px", textAlign: "center" }}>
                    Active la caméra puis appuie sur "Capturer le signe"
                  </p>
                )}
                {isRunning && !wordDetecting && !wordResult && !wordCamError && (
                  <p style={{ color: th.textSecondary, fontSize: 12, margin: 0, textAlign: "center" }}>
                    Positionne ta main dans le cadre, puis appuie sur le bouton de capture
                  </p>
                )}
                {/* Barre de progression */}
                {wordDetecting && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#667eea", fontWeight: 700 }}>Capture en cours…</span>
                      <span style={{ fontSize: 12, color: th.textSecondary }}>{wordProgress}/{SEQUENCE_LENGTH}</span>
                    </div>
                    <div style={{ height: 8, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        width: `${(wordProgress / SEQUENCE_LENGTH) * 100}%`,
                        background: "linear-gradient(135deg, #667eea, #764ba2)",
                        transition: "width 0.15s ease",
                      }} />
                    </div>
                    <p style={{ fontSize: 11, color: th.textMuted, margin: "6px 0 0", textAlign: "center" }}>
                      Maintiens le signe visible pendant toute la capture
                    </p>
                  </div>
                )}
                {/* Résultat */}
                {wordResult && !wordDetecting && (
                  <div style={{
                    background: isDark ? "rgba(86,171,47,0.1)" : "rgba(86,171,47,0.07)",
                    border: "1px solid rgba(86,171,47,0.25)",
                    borderRadius: 10, padding: "12px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#56ab2f", textTransform: "uppercase", letterSpacing: "0.5px" }}>Mot détecté ✅</p>
                      <p style={{ margin: "0 0 2px", fontSize: 26, fontWeight: 900, color: th.textPrimary, fontFamily: "monospace" }}>{wordResult.word}</p>
                      <p style={{ margin: 0, fontSize: 12, color: th.textSecondary }}>
                        Confiance : <span style={{ color: confColor(wordResult.confidence), fontWeight: 700 }}>{wordResult.confidence}%</span>
                      </p>
                    </div>
                    <button className="cv-btn" onClick={() => setWordResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: th.textMuted, fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                )}
                {/* Erreur */}
                {wordCamError && (
                  <div style={{ background: isDark ? "rgba(229,45,39,0.1)" : "rgba(229,45,39,0.06)", border: "1px solid rgba(229,45,39,0.25)", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#e52d27", fontWeight: 600 }}>
                    ❌ {wordCamError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ════ COLONNE DROITE — Builder ════ */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: th.textPrimary }}>{t("conv_builder")}</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── Tabs ── */}
            <div style={{
              display: "flex", gap: 4,
              background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)",
              borderRadius: 10, padding: 4,
              flexDirection: isRTL ? "row-reverse" : "row",
            }}>
              {[
                { val: "asl",      label: t("conv_mode_asl")     },
                { val: "keyboard", label: t("conv_mode_keyboard") },
                { val: "speech",   label: t("conv_mode_speech")   },
                { val: "wlasl",    label: " Mots"              },
              ].map((m) => (
                <button
                  key={m.val}
                  onClick={() => {
                    setInputMode(m.val);
                    if (m.val !== "speech") stopListening();
                    if (m.val !== "wlasl")  cancelWordCapture();
                    // Réinitialiser la détection de lettres si on revient en mode asl
                    historyRef.current = [];
                    setDetectedLetter(""); setConfidence(0); setTop3([]);
                  }}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 7, border: "none",
                    background: inputMode === m.val
                      ? (isDark ? "rgba(102,126,234,0.28)" : "white")
                      : "transparent",
                    color: inputMode === m.val ? "#667eea" : th.textSecondary,
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                    transition: "all 0.16s",
                    boxShadow: inputMode === m.val && !isDark ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* ── ASL / Keyboard ── */}
            {(inputMode === "asl" || inputMode === "keyboard") && card(
              <>
                {sectionLabel(t("conv_current_word"))}
                <div style={{
                  fontSize: 28, fontWeight: 800, letterSpacing: 3,
                  minHeight: 40, marginBottom: 14, color: th.textPrimary,
                  display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", direction: "ltr",
                }}>
                  {currentWord
                    ? currentWord.split("").map((ch, i) => <span key={i} style={{ animation: "fadeIn 0.2s ease" }}>{ch}</span>)
                    : <span style={{ color: th.textMuted, fontSize: 16, fontWeight: 400, letterSpacing: 0 }}>{t("conv_type_letters")}</span>
                  }
                  <span style={{ color: "#667eea", animation: "blink 1s step-end infinite" }}>|</span>
                </div>
                {inputMode === "keyboard" && (
                  <div style={{ background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)", borderRadius: 10, padding: 12, marginBottom: 12, border: `1px solid ${th.border}` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: 7 }}>
                      {ALPHABET.map((letter) => (
                        <button key={letter} className="key-btn" onClick={() => setCurrentWord((p) => p + letter)}
                          style={{ padding: "7px 2px", borderRadius: 6, border: `1px solid ${th.border}`, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: th.textPrimary, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          {letter}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 7 }}>
                      {SPECIAL.map((num) => (
                        <button key={num} className="key-btn" onClick={() => setCurrentWord((p) => p + num)}
                          style={{ flex: 1, padding: "6px 2px", borderRadius: 6, border: `1px solid ${th.border}`, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", color: th.textSecondary, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                          {num}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="cv-btn" onClick={() => setCurrentWord((p) => p.slice(0, -1))}
                        style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: isDark ? "rgba(229,45,39,0.15)" : "rgba(229,45,39,0.08)", color: "#e52d27", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        {t("conv_delete")}
                      </button>
                      <button className="cv-btn" onClick={() => setCurrentWord("")}
                        style={{ flex: 1, padding: "7px", borderRadius: 7, border: `1px solid ${th.border}`, background: "transparent", color: th.textSecondary, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        {t("conv_clear")}
                      </button>
                    </div>
                  </div>
                )}
                <button className="cv-btn" onClick={addWord} disabled={!currentWord.trim()}
                  style={{
                    width: "100%", padding: "9px", borderRadius: 9,
                    border: `1.5px solid ${currentWord.trim() ? "#667eea" : th.border}`,
                    background: currentWord.trim() ? (isDark ? "rgba(102,126,234,0.15)" : "rgba(102,126,234,0.07)") : "transparent",
                    color: currentWord.trim() ? "#667eea" : th.textMuted,
                    fontWeight: 700, fontSize: 13,
                    cursor: currentWord.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {t("conv_add_word")} {isRTL ? "←" : "→"}
                </button>
              </>
            )}

            {/* ── Speech ── */}
            {inputMode === "speech" && card(
              <>
                {!sttSupported && (
                  <div style={{ background: isDark ? "rgba(229,45,39,0.1)" : "rgba(229,45,39,0.06)", border: "1px solid rgba(229,45,39,0.25)", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#e52d27", fontWeight: 600 }}>
                    {t("conv_no_browser")}
                  </div>
                )}
                {sectionLabel(t("conv_lang_label"))}
                <div style={{ display: "flex", gap: 7, marginBottom: 18, flexDirection: isRTL ? "row-reverse" : "row" }}>
                  {SPEECH_LANGS.map((lang) => (
                    <button key={lang.code}
                      onClick={() => { setSpeechLang(lang.code); if (isListening) { stopListening(); setTimeout(startListening, 200); } }}
                      style={{
                        flex: 1, padding: "9px 6px", borderRadius: 9,
                        border: `1.5px solid ${speechLang === lang.code ? "#667eea" : th.border}`,
                        background: speechLang === lang.code ? (isDark ? "rgba(102,126,234,0.2)" : "rgba(102,126,234,0.07)") : th.bgCard,
                        color: speechLang === lang.code ? "#667eea" : th.textSecondary,
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>{lang.flag}</span>
                      <span style={{ fontSize: 11 }}>{lang.label}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "8px 0 16px" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isListening && [0, 0.3, 0.6].map((delay) => (
                      <div key={delay} style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", border: "2px solid #e52d27", animation: `ripple 1.5s ease-out ${delay}s infinite`, pointerEvents: "none" }} />
                    ))}
                    <button className="mic-btn" onClick={toggleListening} disabled={!sttSupported}
                      style={{
                        width: 72, height: 72, borderRadius: "50%", border: "none",
                        background: isListening ? "linear-gradient(135deg, #e52d27, #b31217)" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                        color: isListening ? "white" : th.textSecondary,
                        cursor: sttSupported ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isListening ? "0 0 0 4px rgba(229,45,39,0.18), 0 6px 20px rgba(229,45,39,0.35)" : "none",
                        zIndex: 1,
                      }}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    </button>
                  </div>
                  {isListening ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: 22, marginBottom: 8 }}>
                        {[0, 0.1, 0.2, 0.15, 0.05].map((delay, i) => (
                          <div key={i} style={{ width: 4, borderRadius: 2, background: "#e52d27", animation: `waveBar 0.8s ease-in-out ${delay}s infinite` }} />
                        ))}
                      </div>
                      <p style={{ color: "#e52d27", fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>{t("conv_listening_now")}</p>
                      <p style={{ color: th.textSecondary, fontSize: 12, margin: 0 }}>{t("conv_speak_now")}</p>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <p style={{ color: th.textSecondary, fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>{t("conv_click_speak")}</p>
                      <p style={{ color: th.textMuted, fontSize: 11, margin: 0 }}>{t("conv_speech_hint")}</p>
                    </div>
                  )}
                  {speechError && (
                    <div style={{ background: isDark ? "rgba(229,45,39,0.1)" : "rgba(229,45,39,0.06)", border: "1px solid rgba(229,45,39,0.25)", borderRadius: 9, padding: "9px 13px", fontSize: 12, color: "#e52d27", fontWeight: 600, textAlign: "center", width: "100%", boxSizing: "border-box" }}>
                      {speechError}
                    </div>
                  )}
                </div>
                {interimText && (
                  <div style={{ background: isDark ? "rgba(229,45,39,0.07)" : "rgba(229,45,39,0.04)", border: "1px dashed rgba(229,45,39,0.3)", borderRadius: 9, padding: "9px 13px", marginBottom: 12, fontSize: 13, color: th.textSecondary, fontStyle: "italic", lineHeight: 1.5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#e52d27", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("conv_recognizing")}</span>
                    {interimText}
                  </div>
                )}
                <button className="cv-btn" onClick={sendSpeechMessage} disabled={!sentence.trim()}
                  style={{
                    width: "100%", padding: "10px", borderRadius: 9, border: "none",
                    background: sentence.trim() ? "linear-gradient(135deg, #667eea, #764ba2)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    color: sentence.trim() ? "white" : th.textMuted,
                    fontWeight: 700, fontSize: 13,
                    cursor: sentence.trim() ? "pointer" : "not-allowed",
                    boxShadow: sentence.trim() ? "0 2px 10px rgba(102,126,234,0.3)" : "none",
                  }}
                >
                  {t("conv_send_speech")}
                </button>
              </>
            )}

            {/* ── WLASL — Upload vidéo ── */}
            {inputMode === "wlasl" && card(
              <>
                {sectionLabel("Upload vidéo (optionnel)")}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${wlaslFile ? "#56ab2f" : th.border}`,
                    borderRadius: 12, padding: "20px 16px",
                    textAlign: "center", cursor: "pointer",
                    background: wlaslFile
                      ? (isDark ? "rgba(86,171,47,0.08)" : "rgba(86,171,47,0.05)")
                      : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    transition: "all 0.2s", marginBottom: 12,
                  }}
                >
                  <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }}
                    onChange={(e) => { setWlaslFile(e.target.files[0]); setWlaslResult(null); setWlaslError(""); }} />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🎥</div>
                  <p style={{ color: wlaslFile ? "#56ab2f" : th.textSecondary, fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>
                    {wlaslFile ? wlaslFile.name : "Cliquer pour uploader une vidéo .mp4"}
                  </p>
                  <p style={{ color: th.textMuted, fontSize: 11, margin: 0 }}>Alternative à la caméra</p>
                </div>
                {wlaslResult && (
                  <div style={{ background: isDark ? "rgba(86,171,47,0.1)" : "rgba(86,171,47,0.07)", border: "1px solid rgba(86,171,47,0.25)", borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#56ab2f", textTransform: "uppercase", letterSpacing: "0.5px" }}>Mot détecté ✅</p>
                      <p style={{ margin: "0 0 2px", fontSize: 24, fontWeight: 900, color: th.textPrimary, fontFamily: "monospace" }}>{wlaslResult.word}</p>
                      <p style={{ margin: 0, fontSize: 12, color: th.textSecondary }}>
                        Confiance : <span style={{ color: confColor(wlaslResult.confidence), fontWeight: 700 }}>{wlaslResult.confidence}%</span>
                      </p>
                    </div>
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: `conic-gradient(#56ab2f ${wlaslResult.confidence * 3.6}deg, ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: th.bgCard, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#56ab2f" }}>
                        {wlaslResult.confidence}%
                      </div>
                    </div>
                  </div>
                )}
                {wlaslError && (
                  <div style={{ background: isDark ? "rgba(229,45,39,0.1)" : "rgba(229,45,39,0.06)", border: "1px solid rgba(229,45,39,0.25)", borderRadius: 9, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#e52d27", fontWeight: 600 }}>
                    ❌ {wlaslError}
                  </div>
                )}
                <button className="cv-btn" onClick={predictWordFromFile} disabled={!wlaslFile || wlaslLoading}
                  style={{
                    width: "100%", padding: "11px", borderRadius: 10, border: "none",
                    background: wlaslFile && !wlaslLoading ? "linear-gradient(135deg, #667eea, #764ba2)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    color: wlaslFile && !wlaslLoading ? "white" : th.textMuted,
                    fontWeight: 700, fontSize: 13,
                    cursor: wlaslFile && !wlaslLoading ? "pointer" : "not-allowed",
                    boxShadow: wlaslFile && !wlaslLoading ? "0 3px 12px rgba(102,126,234,0.35)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {wlaslLoading
                    ? <><div style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Analyse...</>
                    : "Analyser le fichier"
                  }
                </button>
              </>
            )}

            {/* Phrase complète */}
            {card(
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexDirection: isRTL ? "row-reverse" : "row" }}>
                  {sectionLabel(t("conv_sentence"))}
                  {sentence && (
                    <button onClick={() => setSentence("")} style={{ background: "none", border: "none", cursor: "pointer", color: th.textMuted, fontSize: 18, padding: 0, lineHeight: 1, marginBottom: 10 }}>×</button>
                  )}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, minHeight: 46, lineHeight: 1.6, color: sentence ? th.textPrimary : th.textMuted, wordBreak: "break-word" }}>
                  {sentence || (interimText
                    ? <span style={{ fontStyle: "italic" }}>{interimText}...</span>
                    : t("conv_sentence_ph")
                  )}
                </div>
              </>
            )}

            {/* Boutons envoyer / effacer */}
            {inputMode !== "speech" && (
              <div style={{ display: "flex", gap: 10, flexDirection: isRTL ? "row-reverse" : "row" }}>
                <button className="cv-btn" onClick={sendSentence} disabled={!sentence.trim() || isSpeaking}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 10, border: "none",
                    background: sentence.trim() && !isSpeaking ? "linear-gradient(135deg, #56ab2f, #a8e063)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    color: sentence.trim() && !isSpeaking ? "white" : th.textMuted,
                    fontWeight: 700, fontSize: 14,
                    cursor: sentence.trim() && !isSpeaking ? "pointer" : "not-allowed",
                    boxShadow: sentence.trim() && !isSpeaking ? "0 3px 12px rgba(86,171,47,0.35)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    {isSpeaking ? <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12z"/> : <path d="M3 9v6h4l5 5V4L7 9H3zm16.6 3A8.9 8.9 0 0 0 19 7.04V8.6a7.2 7.2 0 0 1 0 6.8v1.56A8.9 8.9 0 0 0 19.6 12z"/>}
                  </svg>
                  {isSpeaking ? t("conv_reading") : t("conv_send_read")}
                </button>
                <button className="cv-btn" onClick={clearAll}
                  style={{
                    padding: "12px 16px", borderRadius: 10,
                    border: `1px solid ${th.border}`, background: "transparent",
                    color: th.textSecondary, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Messages */}
            {card(
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexDirection: isRTL ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: th.textSecondary }}>{t("conv_messages")}</span>
                  {messages.length > 0 && (
                    <span style={{ background: "#667eea", color: "white", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{messages.length}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "18px 0" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={th.textMuted} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <p style={{ color: th.textMuted, fontSize: 12, margin: 0 }}>{t("conv_no_messages")}</p>
                    </div>
                  ) : messages.map((m, i) => (
                    <div key={i} style={{
                      background: m.type === "speech"
                        ? (isDark ? "rgba(86,171,47,0.1)"   : "rgba(86,171,47,0.07)")
                        : m.type === "wlasl"
                        ? (isDark ? "rgba(118,75,162,0.12)" : "rgba(118,75,162,0.07)")
                        : (isDark ? "rgba(102,126,234,0.12)": "rgba(102,126,234,0.07)"),
                      borderRadius: 9, padding: "9px 13px",
                      border: `1px solid ${m.type === "speech" ? "rgba(86,171,47,0.2)" : m.type === "wlasl" ? "rgba(118,75,162,0.25)" : "rgba(102,126,234,0.18)"}`,
                      animation: "fadeIn 0.3s ease", direction: isRTL ? "rtl" : "ltr",
                    }}>
                      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: th.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRTL ? "row-reverse" : "row" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                          background: m.type === "speech" ? "rgba(86,171,47,0.15)" : m.type === "wlasl" ? "rgba(118,75,162,0.15)" : "rgba(102,126,234,0.15)",
                          color:      m.type === "speech" ? "#56ab2f"              : m.type === "wlasl" ? "#764ba2"               : "#667eea",
                        }}>
                          {m.type === "speech" ? t("conv_mode_speech") : m.type === "wlasl" ? "🤟 WLASL" : "ASL"}
                        </span>
                        <span style={{ fontSize: 11, color: th.textMuted }}>{m.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}