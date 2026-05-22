import React, { useEffect, useRef, useState } from "react";
import { aslRealtimeFrame, aslRealtimeReset, saveMessage } from "../services/api";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import { useLang } from "../context/LanguageContext";

const ROI = { x: 100, y: 100, w: 300, h: 300 };
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SPECIAL = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;
const CAPTURE_JPEG_QUALITY = 0.68;

const SPEECH_LANGS = [
  { code: "fr-FR", flag: "FR", label: "Francais" },
  { code: "en-US", flag: "EN", label: "English" },
  { code: "ar-MA", flag: "AR", label: "العربية" },
];

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const toPercent = (v) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? clamp(n, 0, 100) : clamp(n * 100, 0, 100);
};

export default function Conversation() {
  const { theme } = useTheme();
  const th = themes[theme];
  const isDark = theme === "dark";
  const { t, language } = useLang();
  const isRTL = language === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const intervalRef = useRef(null);
  const detectionLoopActiveRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const recognitionRef = useRef(null);
  const sessionIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `asl-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  const [isRunning, setIsRunning] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [flash, setFlash] = useState(false);

  const [inputMode, setInputMode] = useState("asl");
  const [detectionMode, setDetectionMode] = useState("word");
  const detectionModeRef = useRef(detectionMode);

  const [autoMode, setAutoMode] = useState(true);
  const autoRef = useRef(autoMode);

  const [detectedLetter, setDetectedLetter] = useState("");
  const [currentWord, setCurrentWord] = useState("");

  const [predictedWord, setPredictedWord] = useState("");
  const [glossText, setGlossText] = useState("");
  const [wordSentence, setWordSentence] = useState("");
  const [stillProgress, setStillProgress] = useState(0);
  const [stillCount, setStillCount] = useState(0);
  const [stillNeeded, setStillNeeded] = useState(6);
  const [handPresent, setHandPresent] = useState(false);
  const [rapidCount, setRapidCount] = useState(0);
  const [rapidNeeded, setRapidNeeded] = useState(3);
  const [commitMode, setCommitMode] = useState("none");
  const [bufLen, setBufLen] = useState(0);
  const [bufSize, setBufSize] = useState(20);
  const [ollamaEnabled, setOllamaEnabled] = useState(null);
  const [sentencePending, setSentencePending] = useState(false);
  const [sentenceSource, setSentenceSource] = useState("none");
  const [sentenceAlternatives, setSentenceAlternatives] = useState([]);

  const [sentence, setSentence] = useState("");
  const [messages, setMessages] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [top3, setTop3] = useState([]);

  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("fr-FR");
  const [interimText, setInterimText] = useState("");
  const [sttSupported, setSttSupported] = useState(true);
  const [speechError, setSpeechError] = useState("");

  useEffect(() => {
    autoRef.current = autoMode;
  }, [autoMode]);

  useEffect(() => {
    detectionModeRef.current = detectionMode;
  }, [detectionMode]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSttSupported(false);
    return () => stopListening();
  }, []);

  const confColor = (c) => (c >= 70 ? "#56ab2f" : c >= 40 ? "#f7971e" : "#e52d27");

  const resetRealtimeUiState = () => {
    setDetectedLetter("");
    setPredictedWord("");
    setConfidence(0);
    setTop3([]);
    setStillProgress(0);
    setStillCount(0);
    setStillNeeded(6);
    setHandPresent(false);
    setRapidCount(0);
    setRapidNeeded(3);
    setCommitMode("none");
    setBufLen(0);
    setBufSize(20);
    setGlossText("");
    setWordSentence("");
    setOllamaEnabled(null);
    setSentencePending(false);
    setSentenceSource("none");
    setSentenceAlternatives([]);
  };

  const resetRealtimeSession = async () => {
    try {
      await aslRealtimeReset({ session_id: sessionIdRef.current, mode: detectionModeRef.current });
    } catch {
      // keep UI responsive even if backend reset fails
    }
  };

  const startCamera = async () => {
    try {
      await resetRealtimeSession();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      videoRef.current.srcObject = stream;
      await new Promise((res) => {
        videoRef.current.onloadedmetadata = res;
      });
      await videoRef.current.play();
      setIsRunning(true);
      startDetection();
    } catch {
      alert("Impossible d'acceder a la camera");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    detectionLoopActiveRef.current = false;
    clearTimeout(intervalRef.current);
    requestInFlightRef.current = false;
    setIsRunning(false);
    setIsDetecting(false);
    resetRealtimeUiState();
  };

  const handleLetterModeFrame = (data) => {
    const letter = data.current_word || data.prediction || "";
    setDetectedLetter(letter);
    setConfidence(toPercent(data.current_confidence ?? data.confidence));
    setTop3(
      (data.top3 || []).map((item) => ({
        label: item.word || item.letter || "?",
        confidence: toPercent(item.confidence),
      }))
    );

    if (autoRef.current && data.just_committed) {
      if (data.sentence_text) {
        setSentence(data.sentence_text);
      } else if (currentWord.trim()) {
        setSentence((prev) => (prev ? `${prev} ${currentWord}` : currentWord));
      }
      setCurrentWord("");
      setFlash(true);
      setTimeout(() => setFlash(false), 300);
    }
  };

  const handleWordModeFrame = (data) => {
    const prediction = data.prediction || "";
    const natural = data.sentence || "";

    setPredictedWord(prediction);
    setConfidence(toPercent(data.confidence));
    setTop3(
      (data.top3 || []).map((item) => ({
        label: item.word || "?",
        confidence: toPercent(item.confidence),
      }))
    );

    setStillProgress(clamp(Number(data.still_progress) || 0));
    setStillCount(Number(data.still_count) || 0);
    setStillNeeded(Number(data.still_needed) || 6);
    setHandPresent(Boolean(data.hand_present));
    setRapidCount(Number(data.rapid_count) || 0);
    setRapidNeeded(Number(data.rapid_needed) || 3);
    setCommitMode(data.commit_mode || "none");
    setBufLen(Number(data.buf_len) || 0);
    setBufSize(Number(data.buf_size) || 20);
    setGlossText(data.gloss || "");
    setWordSentence(natural);
    setOllamaEnabled(typeof data.ollama_enabled === "boolean" ? data.ollama_enabled : null);
    setSentencePending(Boolean(data.sentence_pending));
    setSentenceSource(data.sentence_source || "none");
    setSentenceAlternatives(
      Array.isArray(data.sentence_alternatives)
        ? data.sentence_alternatives.filter((s) => typeof s === "string" && s.trim())
        : []
    );
    if (natural) setSentence(natural);

    if (data.word_committed) {
      setFlash(true);
      setTimeout(() => setFlash(false), 320);
    }
  };

  const startDetection = () => {
    detectionLoopActiveRef.current = true;
    clearTimeout(intervalRef.current);

    const loop = async () => {
      if (!detectionLoopActiveRef.current) return;
      if (!videoRef.current || !canvasRef.current || requestInFlightRef.current) {
        intervalRef.current = setTimeout(loop, 12);
        return;
      }

      const startedAt = performance.now();
      const mode = detectionModeRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.width = CAPTURE_WIDTH;
      canvas.height = CAPTURE_HEIGHT;
      ctx.save();
      ctx.translate(CAPTURE_WIDTH, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
      ctx.restore();

      const imageData = canvas.toDataURL("image/jpeg", CAPTURE_JPEG_QUALITY);

      try {
        requestInFlightRef.current = true;
        setIsDetecting(true);
        const { data } = await aslRealtimeFrame({
          session_id: sessionIdRef.current,
          image: imageData,
          mode,
        });

        if (mode === "word") handleWordModeFrame(data);
        else handleLetterModeFrame(data);
      } catch (err) {
        console.error("Erreur prediction:", err.response?.data || err.message || err);
      } finally {
        requestInFlightRef.current = false;
        setIsDetecting(false);
      }

      const targetMs = mode === "word" ? 65 : 140;
      const elapsed = performance.now() - startedAt;
      const nextDelay = Math.max(8, targetMs - elapsed);
      intervalRef.current = setTimeout(loop, nextDelay);
    };

    intervalRef.current = setTimeout(loop, 0);
  };

  useEffect(() => {
    if (!isRunning) return;
    const drawOverlay = () => {
      const overlay = overlayCanvasRef.current;
      const video = videoRef.current;
      if (!overlay || !video) return;

      overlay.width = video.clientWidth;
      overlay.height = video.clientHeight;

      const scaleX = video.clientWidth / 640;
      const scaleY = video.clientHeight / 480;
      const ctx = overlay.getContext("2d");

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const flippedX = overlay.width - (ROI.x + ROI.w) * scaleX;
      const x = flippedX;
      const y = ROI.y * scaleY;
      const w = ROI.w * scaleX;
      const h = ROI.h * scaleY;

      const color = confidence >= 70 ? "#56ab2f" : confidence >= 40 ? "#f7971e" : "#667eea";
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      const cornerLen = 20;
      [
        [x, y, x + cornerLen, y, x, y + cornerLen],
        [x + w - cornerLen, y, x + w, y, x + w, y + cornerLen],
        [x, y + h - cornerLen, x, y + h, x + cornerLen, y + h],
        [x + w - cornerLen, y + h, x + w, y + h, x + w, y + h - cornerLen],
      ].forEach(([x1, y1, x2, y2, x3, y3]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();
      });

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x, y - 28, 230, 24);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px 'Segoe UI'";
      ctx.fillText(t("conv_place_hand"), x + 8, y - 11);
    };

    const id = setInterval(drawOverlay, 100);
    return () => clearInterval(id);
  }, [isRunning, confidence, language, t]);

  useEffect(() => {
    if (!isRunning) return;
    resetRealtimeUiState();
    resetRealtimeSession();
  }, [detectionMode, isRunning]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSttSupported(false);
      return;
    }

    setSpeechError("");
    const recognition = new SR();
    recognition.lang = speechLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const txt = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += `${txt} `;
        else interim += txt;
      }
      setInterimText(interim);
      if (final.trim()) {
        setSentence((prev) => (prev ? `${prev} ${final.trim()}` : final.trim()));
        setInterimText("");
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed") setSpeechError(t("conv_mic_denied"));
      else if (e.error === "no-speech") setSpeechError(t("conv_no_speech"));
      else setSpeechError(`Erreur: ${e.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  };

  const toggleListening = () => (isListening ? stopListening() : startListening());

  const sendSpeechMessage = async () => {
    if (!sentence.trim()) return;
    stopListening();
    const msg = { text: sentence.trim(), type: "speech", time: new Date().toLocaleTimeString() };
    setMessages((p) => [msg, ...p]);
    try {
      await saveMessage({ text: sentence.trim(), type: "speech" });
    } catch {
      // no-op
    }
    setSentence("");
    setInterimText("");
  };

  const addLetter = () => {
    if (!detectedLetter || detectedLetter === "nothing") return;
    setCurrentWord((prev) => `${prev}${detectedLetter}`);
  };

  const addWord = () => {
    if (!currentWord.trim()) return;
    setSentence((prev) => (prev ? `${prev} ${currentWord}` : currentWord));
    setCurrentWord("");
  };

  const getActiveSentence = () => {
    if (inputMode === "asl" && detectionMode === "word") {
      return (wordSentence || sentence).trim();
    }
    return sentence.trim();
  };

  const sendSentence = async () => {
    const text = getActiveSentence();
    if (!text) return;

    const msg = { text, type: "asl", time: new Date().toLocaleTimeString() };
    setMessages((p) => [msg, ...p]);
    try {
      await saveMessage({ text, type: "asl" });
    } catch {
      // no-op
    }

    setIsSpeaking(true);
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US";
    utt.rate = 0.9;
    utt.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);

    setSentence("");
    if (detectionMode === "word") setWordSentence("");
  };

  const clearAll = () => {
    stopListening();
    setCurrentWord("");
    setSentence("");
    setInterimText("");
    resetRealtimeUiState();
    resetRealtimeSession();
  };

  useEffect(() => {
    const videoEl = videoRef.current;
    const recognition = recognitionRef.current;
    return () => {
      const stream = videoEl?.srcObject;
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      detectionLoopActiveRef.current = false;
      clearTimeout(intervalRef.current);
      recognition?.stop();
    };
  }, []);

  const sectionLabel = (text) => (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.8px",
        textTransform: "uppercase",
        color: th.textSecondary,
        margin: "0 0 10px",
        textAlign: isRTL ? "right" : "left",
      }}
    >
      {text}
    </p>
  );

  const card = (children, extra = {}) => (
    <div
      style={{
        background: th.bgCard,
        border: `1px solid ${th.border}`,
        borderRadius: 14,
        padding: 18,
        ...extra,
      }}
    >
      {children}
    </div>
  );

  const activeSentence = inputMode === "asl" && detectionMode === "word" ? wordSentence || sentence : sentence;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: th.bg,
        color: th.textPrimary,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        direction: dir,
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes flashGreen { 0%{opacity:1} 100%{opacity:0} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ripple { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.4);opacity:0} }
        @keyframes waveBar { 0%,100%{height:4px} 50%{height:18px} }
        .cv-btn { transition: all 0.16s ease; }
        .cv-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.88; }
        .cv-btn:active:not(:disabled) { transform: translateY(0); }
        .key-btn { transition: background 0.1s, transform 0.1s; }
        .key-btn:hover { background: rgba(102,126,234,0.22) !important; transform: scale(1.07); }
        .key-btn:active { transform: scale(0.93); }
        .mic-btn { transition: all 0.18s ease; }
        .mic-btn:hover { transform: scale(1.05); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}; border-radius: 10px; }
      `}</style>

      <Navbar />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          height: "calc(100vh - 56px)",
          minHeight: "800px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            borderInlineEnd: `1px solid ${th.border}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: `1px solid ${th.border}`,
              flexDirection: isRTL ? "row-reverse" : "row",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: th.textPrimary }}>{t("conv_camera")}</span>

            <div
              style={{
                display: "flex",
                gap: 4,
                background: isDark ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.04)",
                padding: 4,
                borderRadius: 10,
              }}
            >
              {[
                { key: "letter", label: "🔤 Letter by Letter" },
                { key: "word", label: "💬 Word to Sentence" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setDetectionMode(m.key)}
                  style={{
                    border: "none",
                    padding: "7px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 12,
                    background: detectionMode === m.key ? (isDark ? "rgba(102,126,234,0.32)" : "white") : "transparent",
                    color: detectionMode === m.key ? "#667eea" : th.textSecondary,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              position: "relative",
              overflow: "hidden",
              background: "#000",
              minHeight: "420px",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)",
                display: isRunning ? "block" : "none",
              }}
            />
            <canvas ref={overlayCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {!isRunning && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isDark ? "#0a0a0a" : "#1a1a1a",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>{t("conv_cam_disabled")}</p>
              </div>
            )}

            {isRunning && (
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  [isRTL ? "left" : "right"]: 12,
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 20,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: isDetecting ? "#f7971e" : "#56ab2f",
                    display: "inline-block",
                    animation: isDetecting ? "pulse 1s ease infinite" : "none",
                  }}
                />
                {isDetecting ? t("conv_analyzing") : t("conv_listening")}
              </div>
            )}

            {flash && <div style={{ position: "absolute", inset: 0, border: "3px solid #56ab2f", animation: "flashGreen 0.3s ease", pointerEvents: "none" }} />}
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderTop: `1px solid ${th.border}`,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxHeight: "340px",
              overflowY: "auto",
            }}
          >
            <button
              className="cv-btn"
              onClick={isRunning ? stopCamera : startCamera}
              style={{
                padding: "11px",
                borderRadius: 10,
                border: "none",
                background: isRunning ? "linear-gradient(135deg, #e52d27, #b31217)" : "linear-gradient(135deg, #56ab2f, #a8e063)",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                {isRunning ? <rect x="4" y="4" width="16" height="16" rx="2" /> : <path d="M8 5v14l11-7z" />}
              </svg>
              {isRunning ? t("conv_stop_cam") : t("conv_start_cam")}
            </button>

            {detectionMode === "letter" &&
              card(
                <>
                  {sectionLabel("Letter Detection")}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 78,
                        height: 78,
                        borderRadius: 12,
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${th.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 50,
                        fontWeight: 900,
                        fontFamily: "monospace",
                        color: confidence > 0 ? confColor(confidence) : th.textMuted,
                      }}
                    >
                      {detectedLetter && detectedLetter !== "nothing" ? detectedLetter : "?"}
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 7, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${confidence}%`, background: confColor(confidence), transition: "width 0.3s" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: confColor(confidence), minWidth: 44 }}>{confidence.toFixed(1)}%</span>
                      </div>

                      {top3.map((item, i) => (
                        <div key={`${item.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, minWidth: 24, color: i === 0 ? "#667eea" : th.textSecondary }}>{item.label}</span>
                          <div style={{ flex: 1, height: 5, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${item.confidence}%`, background: i === 0 ? "#667eea" : "rgba(102,126,234,0.38)", transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: 11, color: th.textSecondary, minWidth: 34, textAlign: "right" }}>{item.confidence.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className="cv-btn"
                    onClick={addLetter}
                    disabled={!detectedLetter || detectedLetter === "nothing"}
                    style={{
                      width: "100%",
                      marginTop: 12,
                      padding: "9px",
                      borderRadius: 9,
                      border: "none",
                      background:
                        !detectedLetter || detectedLetter === "nothing"
                          ? isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.04)"
                          : "linear-gradient(135deg, #667eea, #764ba2)",
                      color: !detectedLetter || detectedLetter === "nothing" ? th.textMuted : "white",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: !detectedLetter || detectedLetter === "nothing" ? "not-allowed" : "pointer",
                    }}
                  >
                    Add this letter
                  </button>

                  <button
                    className="cv-btn"
                    onClick={addWord}
                    disabled={!currentWord.trim()}
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "9px",
                      borderRadius: 9,
                      border: `1.5px solid ${currentWord.trim() ? "#56ab2f" : th.border}`,
                      background: currentWord.trim() ? "rgba(86,171,47,0.1)" : "transparent",
                      color: currentWord.trim() ? "#56ab2f" : th.textMuted,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: currentWord.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Add word to sentence
                  </button>

                  <div
                    onClick={() => setAutoMode((p) => !p)}
                    style={{
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 12,
                      color: autoMode ? "#56ab2f" : th.textSecondary,
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 16,
                        borderRadius: 10,
                        background: autoMode ? "#56ab2f" : "rgba(127,127,127,0.4)",
                        position: "relative",
                        display: "inline-block",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: autoMode ? 16 : 2,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: "#fff",
                        }}
                      />
                    </span>
                    {autoMode ? "Auto commit ON" : "Auto commit OFF"}
                  </div>
                </>
              )}

            {detectionMode === "word" &&
              card(
                <>
                  {sectionLabel("Word Detection")}
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      color: confidence > 0 ? confColor(confidence) : th.textMuted,
                      marginBottom: 8,
                      minHeight: 42,
                    }}
                  >
                    {predictedWord || "..."}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 8, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${confidence}%`, background: confColor(confidence), transition: "width 0.25s" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: confColor(confidence) }}>{confidence.toFixed(1)}%</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {top3.map((item, i) => (
                      <div key={`${item.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ minWidth: 62, fontSize: 12, fontWeight: i === 0 ? 800 : 700, color: i === 0 ? "#00c2ff" : th.textSecondary }}>{item.label}</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 4, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${item.confidence}%`, background: i === 0 ? "#00c2ff" : "rgba(0,194,255,0.4)", transition: "width 0.25s" }} />
                        </div>
                        <span style={{ fontSize: 11, color: th.textSecondary, minWidth: 36, textAlign: "right" }}>{item.confidence.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: th.textSecondary, marginBottom: 4 }}>
                      Hold still to commit ({stillCount}/{stillNeeded})
                    </div>
                    <div style={{ height: 9, borderRadius: 99, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                      <div style={{ width: `${stillProgress * 100}%`, height: "100%", background: "linear-gradient(90deg, #00c2ff, #3ad6ff)", transition: "width 0.2s linear" }} />
                    </div>
                    <div style={{ fontSize: 11, marginTop: 5, color: !handPresent ? "#e52d27" : stillCount >= stillNeeded ? "#56ab2f" : th.textSecondary }}>
                      {!handPresent ? "No hand detected" : stillCount >= stillNeeded ? "Ready to commit" : "Keep your hand steady"}
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: th.textSecondary, marginBottom: 4 }}>
                      Fast commit ({rapidCount}/{rapidNeeded})
                    </div>
                    <div style={{ height: 9, borderRadius: 99, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${(Math.min(rapidCount, rapidNeeded) / Math.max(rapidNeeded, 1)) * 100}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #56ab2f, #a8e063)",
                          transition: "width 0.12s linear",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, marginTop: 5, color: !handPresent ? "#e52d27" : rapidCount >= rapidNeeded ? "#56ab2f" : th.textSecondary }}>
                      {!handPresent ? "No hand detected" : rapidCount >= rapidNeeded ? "Fast commit ready" : "Sign confidently to commit quickly"}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: th.textSecondary, marginBottom: 10 }}>
                    buf: {bufLen}/{bufSize}
                  </div>

                  <div style={{ fontSize: 12, color: "#4aa8ff", marginBottom: 12, minHeight: 18 }}>
                    {glossText ? `Signs: ${glossText}` : "Signs: ..."}
                  </div>

                  <div style={{ fontSize: 11, color: commitMode === "rapid" ? "#56ab2f" : th.textSecondary, marginBottom: 8 }}>
                    Last commit mode: {commitMode}
                  </div>

                  <div style={{ fontSize: 11, color: th.textSecondary, marginBottom: 12 }}>
                    {ollamaEnabled === null ? "Sentence AI: checking..." : ollamaEnabled ? "Sentence AI: Ollama ON" : "Sentence AI: fallback mode"}
                    {sentencePending ? " (generating...)" : sentenceSource === "ollama" ? " (improved)" : ""}
                  </div>

                  <button
                    className="cv-btn"
                    onClick={clearAll}
                    style={{
                      width: "100%",
                      padding: "9px",
                      borderRadius: 9,
                      border: `1px solid ${th.border}`,
                      background: "transparent",
                      color: th.textSecondary,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                </>
              )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${th.border}`, flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: th.textPrimary }}>{t("conv_builder")}</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                gap: 4,
                background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)",
                borderRadius: 10,
                padding: 4,
                flexDirection: isRTL ? "row-reverse" : "row",
              }}
            >
              {[
                { val: "asl", label: t("conv_mode_asl") },
                { val: "keyboard", label: t("conv_mode_keyboard") },
                { val: "speech", label: t("conv_mode_speech") },
              ].map((m) => (
                <button
                  key={m.val}
                  onClick={() => {
                    setInputMode(m.val);
                    if (m.val !== "speech") stopListening();
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 4px",
                    borderRadius: 7,
                    border: "none",
                    background: inputMode === m.val ? (isDark ? "rgba(102,126,234,0.28)" : "white") : "transparent",
                    color: inputMode === m.val ? "#667eea" : th.textSecondary,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {inputMode !== "speech" && (inputMode === "keyboard" || (inputMode === "asl" && detectionMode === "letter")) &&
              card(
                <>
                  {sectionLabel(t("conv_current_word"))}
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      letterSpacing: 3,
                      minHeight: 40,
                      marginBottom: 14,
                      color: th.textPrimary,
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: "wrap",
                      direction: "ltr",
                    }}
                  >
                    {currentWord ? (
                      currentWord.split("").map((ch, i) => (
                        <span key={`${ch}-${i}`} style={{ animation: "fadeIn 0.2s ease" }}>
                          {ch}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: th.textMuted, fontSize: 16, fontWeight: 400, letterSpacing: 0 }}>{t("conv_type_letters")}</span>
                    )}
                    <span style={{ color: "#667eea", animation: "blink 1s step-end infinite" }}>|</span>
                  </div>

                  {inputMode === "keyboard" && (
                    <div
                      style={{
                        background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                        border: `1px solid ${th.border}`,
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: 7 }}>
                        {ALPHABET.map((letter) => (
                          <button
                            key={letter}
                            className="key-btn"
                            onClick={() => setCurrentWord((p) => p + letter)}
                            style={{
                              padding: "7px 2px",
                              borderRadius: 6,
                              border: `1px solid ${th.border}`,
                              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                              color: th.textPrimary,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 7 }}>
                        {SPECIAL.map((num) => (
                          <button
                            key={num}
                            className="key-btn"
                            onClick={() => setCurrentWord((p) => p + num)}
                            style={{
                              flex: 1,
                              padding: "6px 2px",
                              borderRadius: 6,
                              border: `1px solid ${th.border}`,
                              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                              color: th.textSecondary,
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="cv-btn"
                          onClick={() => setCurrentWord((p) => p.slice(0, -1))}
                          style={{
                            flex: 1,
                            padding: "7px",
                            borderRadius: 7,
                            border: "none",
                            background: isDark ? "rgba(229,45,39,0.15)" : "rgba(229,45,39,0.08)",
                            color: "#e52d27",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {t("conv_delete")}
                        </button>
                        <button
                          className="cv-btn"
                          onClick={() => setCurrentWord("")}
                          style={{
                            flex: 1,
                            padding: "7px",
                            borderRadius: 7,
                            border: `1px solid ${th.border}`,
                            background: "transparent",
                            color: th.textSecondary,
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {t("conv_clear")}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    className="cv-btn"
                    onClick={addWord}
                    disabled={!currentWord.trim()}
                    style={{
                      width: "100%",
                      padding: "9px",
                      borderRadius: 9,
                      border: `1.5px solid ${currentWord.trim() ? "#667eea" : th.border}`,
                      background: currentWord.trim() ? (isDark ? "rgba(102,126,234,0.15)" : "rgba(102,126,234,0.07)") : "transparent",
                      color: currentWord.trim() ? "#667eea" : th.textMuted,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: currentWord.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    {t("conv_add_word")}
                  </button>
                </>
              )}

            {inputMode === "speech" &&
              card(
                <>
                  {!sttSupported && (
                    <div
                      style={{
                        background: isDark ? "rgba(229,45,39,0.1)" : "rgba(229,45,39,0.06)",
                        border: "1px solid rgba(229,45,39,0.25)",
                        borderRadius: 9,
                        padding: "10px 14px",
                        marginBottom: 14,
                        fontSize: 13,
                        color: "#e52d27",
                        fontWeight: 600,
                      }}
                    >
                      {t("conv_no_browser")}
                    </div>
                  )}

                  {sectionLabel(t("conv_lang_label"))}
                  <div style={{ display: "flex", gap: 7, marginBottom: 18, flexDirection: isRTL ? "row-reverse" : "row" }}>
                    {SPEECH_LANGS.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setSpeechLang(lang.code);
                          if (isListening) {
                            stopListening();
                            setTimeout(startListening, 200);
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: "9px 6px",
                          borderRadius: 9,
                          border: `1.5px solid ${speechLang === lang.code ? "#667eea" : th.border}`,
                          background: speechLang === lang.code ? (isDark ? "rgba(102,126,234,0.2)" : "rgba(102,126,234,0.07)") : th.bgCard,
                          color: speechLang === lang.code ? "#667eea" : th.textSecondary,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{lang.flag}</span>
                        <span style={{ fontSize: 11 }}>{lang.label}</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "8px 0 16px" }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isListening &&
                        [0, 0.3, 0.6].map((delay) => (
                          <div
                            key={delay}
                            style={{
                              position: "absolute",
                              width: 80,
                              height: 80,
                              borderRadius: "50%",
                              border: "2px solid #e52d27",
                              animation: `ripple 1.5s ease-out ${delay}s infinite`,
                              pointerEvents: "none",
                            }}
                          />
                        ))}
                      <button
                        className="mic-btn"
                        onClick={toggleListening}
                        disabled={!sttSupported}
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: "50%",
                          border: "none",
                          background: isListening ? "linear-gradient(135deg, #e52d27, #b31217)" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                          color: isListening ? "white" : th.textSecondary,
                          cursor: sttSupported ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
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
                      <div
                        style={{
                          background: isDark ? "rgba(229,45,39,0.1)" : "rgba(229,45,39,0.06)",
                          border: "1px solid rgba(229,45,39,0.25)",
                          borderRadius: 9,
                          padding: "9px 13px",
                          fontSize: 12,
                          color: "#e52d27",
                          fontWeight: 600,
                          textAlign: "center",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        {speechError}
                      </div>
                    )}
                  </div>

                  {interimText && (
                    <div
                      style={{
                        background: isDark ? "rgba(229,45,39,0.07)" : "rgba(229,45,39,0.04)",
                        border: "1px dashed rgba(229,45,39,0.3)",
                        borderRadius: 9,
                        padding: "9px 13px",
                        marginBottom: 12,
                        fontSize: 13,
                        color: th.textSecondary,
                        fontStyle: "italic",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#e52d27", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                        {t("conv_recognizing")}
                      </span>
                      {interimText}
                    </div>
                  )}

                  <button
                    className="cv-btn"
                    onClick={sendSpeechMessage}
                    disabled={!sentence.trim()}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 9,
                      border: "none",
                      background: sentence.trim() ? "linear-gradient(135deg, #667eea, #764ba2)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      color: sentence.trim() ? "white" : th.textMuted,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: sentence.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    {t("conv_send_speech")}
                  </button>
                </>
              )}

            {card(
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexDirection: isRTL ? "row-reverse" : "row" }}>
                  {sectionLabel("PHRASE COMPLETE")}
                  {activeSentence && (
                    <button
                      onClick={() => {
                        setSentence("");
                        if (detectionMode === "word") setWordSentence("");
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: th.textMuted, fontSize: 18, padding: 0, lineHeight: 1, marginBottom: 10 }}
                    >
                      x
                    </button>
                  )}
                </div>

                {inputMode === "asl" && detectionMode === "word" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#4aa8ff", lineHeight: 1.4 }}>
                      <strong>Signs:</strong> {glossText || "..."}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#26d3ff", lineHeight: 1.35, minHeight: 54 }}>
                      {activeSentence || t("conv_sentence_ph")}
                    </div>
                    {sentenceAlternatives.length > 1 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {sentenceAlternatives.slice(0, 4).map((alt, i) => (
                          <button
                            key={`${alt}-${i}`}
                            onClick={() => {
                              setSentence(alt);
                              setWordSentence(alt);
                            }}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 999,
                              border: `1px solid ${th.border}`,
                              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                              color: th.textSecondary,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 17, fontWeight: 600, minHeight: 46, lineHeight: 1.6, color: activeSentence ? th.textPrimary : th.textMuted, wordBreak: "break-word" }}>
                    {activeSentence || (interimText ? <span style={{ fontStyle: "italic" }}>{interimText}...</span> : t("conv_sentence_ph"))}
                  </div>
                )}
              </>
            )}

            {inputMode !== "speech" && (
              <div style={{ display: "flex", gap: 10, flexDirection: isRTL ? "row-reverse" : "row" }}>
                <button
                  className="cv-btn"
                  onClick={sendSentence}
                  disabled={!getActiveSentence() || isSpeaking}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: 10,
                    border: "none",
                    background: getActiveSentence() && !isSpeaking ? "linear-gradient(135deg, #56ab2f, #a8e063)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    color: getActiveSentence() && !isSpeaking ? "white" : th.textMuted,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: getActiveSentence() && !isSpeaking ? "pointer" : "not-allowed",
                  }}
                >
                  {isSpeaking ? t("conv_reading") : t("conv_send_read")}
                </button>
                <button
                  className="cv-btn"
                  onClick={clearAll}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: `1px solid ${th.border}`,
                    background: "transparent",
                    color: th.textSecondary,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {t("conv_clear")}
                </button>
              </div>
            )}

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
                      <p style={{ color: th.textMuted, fontSize: 12, margin: 0 }}>{t("conv_no_messages")}</p>
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <div
                        key={`${m.time}-${i}`}
                        style={{
                          background: m.type === "speech" ? (isDark ? "rgba(86,171,47,0.1)" : "rgba(86,171,47,0.07)") : isDark ? "rgba(102,126,234,0.12)" : "rgba(102,126,234,0.07)",
                          borderRadius: 9,
                          padding: "9px 13px",
                          border: `1px solid ${m.type === "speech" ? "rgba(86,171,47,0.2)" : "rgba(102,126,234,0.18)"}`,
                          animation: "fadeIn 0.3s ease",
                          direction: isRTL ? "rtl" : "ltr",
                        }}
                      >
                        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: th.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: 20,
                              background: m.type === "speech" ? "rgba(86,171,47,0.15)" : "rgba(102,126,234,0.15)",
                              color: m.type === "speech" ? "#56ab2f" : "#667eea",
                            }}
                          >
                            {m.type === "speech" ? t("conv_mode_speech") : "ASL"}
                          </span>
                          <span style={{ fontSize: 11, color: th.textMuted }}>{m.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
