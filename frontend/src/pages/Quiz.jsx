import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";
import signsWords from "../data/signsWords.json";

const accent = "#6366f1";

// ── Génère les questions depuis signsWords par catégorie ──────────────────────
function generateQuestions(lesson) {
  const lessonWordLabels = lesson.words.map((w) =>
    typeof w === "string" ? w : w.word
  );

  // Mots de la leçon qui ont une vidéo dans signsWords
  const wordsWithVideo = signsWords.filter((sw) =>
    lessonWordLabels.some((lw) => lw.toLowerCase() === sw.word.toLowerCase())
  );

  // Catégories présentes
  const categories = [...new Set(wordsWithVideo.map((w) => w.category))];

  // Tous les mots de même catégorie pour les faux choix
  const sameCategory = signsWords.filter((sw) =>
    categories.includes(sw.category)
  );

  if (wordsWithVideo.length >= 2) {
    // ── Mode vidéo ──
    return wordsWithVideo
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map((wordObj) => {
        const wrong = sameCategory
          .filter((sw) => sw.word !== wordObj.word)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((sw) => sw.word);

        // Complète si pas assez de faux choix
        let extra = signsWords.filter(
          (sw) => sw.word !== wordObj.word && !wrong.includes(sw.word)
        );
        while (wrong.length < 3 && extra.length > 0) {
          wrong.push(extra.shift().word);
        }

        const choices = [...wrong, wordObj.word].sort(() => Math.random() - 0.5);

        return {
          type     : "video",
          word     : wordObj.word,
          youtubeId: wordObj.youtubeId,
          answer   : wordObj.word,
          choices,
        };
      });
  } else {
    // ── Mode texte fallback ──
    return lessonWordLabels
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map((word) => {
        const wrong = lessonWordLabels
          .filter((w) => w !== word)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        const choices = [...wrong, word].sort(() => Math.random() - 0.5);
        return { type: "text", word, answer: word, choices };
      });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Quiz({ lesson, onClose, onComplete }) {
  const { theme } = useTheme();
  const th        = themes[theme];
  const isDark    = theme === "dark";

  const [questions]             = useState(() => generateQuestions(lesson));
  const [current, setCurrent]   = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore]       = useState(0);
  const [done, setDone]         = useState(false);
  const [results, setResults]   = useState([]);
  const [xpResult, setXpResult] = useState(null);
  const [videoKey, setVideoKey] = useState(0);

  const q     = questions[current];
  const total = questions.length;

  const handleAnswer = (choice) => {
    if (answered) return;
    setSelected(choice);
    setAnswered(true);
    const correct = choice === q.answer;
    if (correct) setScore((s) => s + 1);
    setResults((r) => [...r, { word: q.word, correct, chosen: choice, answer: q.answer }]);
  };

  const handleNext = async () => {
    if (current + 1 >= total) {
      setDone(true);
      await submitQuiz();
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setAnswered(false);
      setVideoKey((k) => k + 1);
    }
  };

  const submitQuiz = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/stats/quiz", {
        method : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body   : JSON.stringify({ lesson_id: lesson.id, correct: score, total }),
      });
      const data = await res.json();
      setXpResult(data);
      if (onComplete) onComplete(data);
    } catch (err) {
      console.error("Quiz submit error:", err);
    }
  };

  const percentage = Math.round((score / total) * 100);
  const scoreColor = percentage === 100 ? "#10b981" : percentage >= 60 ? "#f59e0b" : "#ef4444";

  // ── Pas de questions disponibles ──
  if (questions.length === 0) {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "400px", background: th.bgCard, borderRadius: "24px", border: `1.5px solid ${th.border}`, padding: "32px", textAlign: "center", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎬</div>
          <h2 style={{ fontSize: "18px", fontWeight: "900", color: th.textPrimary, margin: "0 0 8px" }}>No Videos Yet</h2>
          <p style={{ fontSize: "13px", color: th.textSecondary, margin: "0 0 20px", lineHeight: "1.6" }}>
            Add individual word videos in <strong>signsWords.json</strong> for the <strong>{lesson.title}</strong> lesson to enable the video quiz.
          </p>
          <button onClick={onClose} style={{ padding: "12px 28px", borderRadius: "12px", border: "none", background: accent, color: "white", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "500px", background: th.bgCard, borderRadius: "24px", border: `1.5px solid ${th.border}`, padding: "28px", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>

        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", width: "30px", height: "30px", borderRadius: "50%", border: `1px solid ${th.border}`, background: "transparent", color: th.textSecondary, fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>×</button>

        {!done ? (
          <>
            {/* Progress */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: accent, textTransform: "uppercase", letterSpacing: "1px" }}>
                  {lesson.emoji} {lesson.title} — Quiz
                </span>
                <span style={{ fontSize: "12px", fontWeight: "700", color: th.textSecondary }}>{current + 1} / {total}</span>
              </div>
              <div style={{ height: "6px", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${((current + 1) / total) * 100}%`, background: accent, borderRadius: "10px", transition: "width 0.3s ease" }} />
              </div>
            </div>

            {/* Score */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
              <div style={{ flex: 1, padding: "8px", borderRadius: "10px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#10b981" }}>{score}</div>
                <div style={{ fontSize: "10px", fontWeight: "600", color: th.textSecondary }}>Correct</div>
              </div>
              <div style={{ flex: 1, padding: "8px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#ef4444" }}>{current - score}</div>
                <div style={{ fontSize: "10px", fontWeight: "600", color: th.textSecondary }}>Wrong</div>
              </div>
            </div>

            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "20px", background: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)", border: `1px solid rgba(99,102,241,0.2)`, marginBottom: "14px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: accent }}>
                {q.type === "video" ? "🎬 Watch & Identify" : "🔤 Multiple Choice"}
              </span>
            </div>

            {/* Vidéo */}
            {q.type === "video" && (
              <div style={{ marginBottom: "18px" }}>
                <p style={{ fontSize: "13px", fontWeight: "700", color: th.textPrimary, margin: "0 0 10px" }}>
                  🎬 Watch this sign carefully, then choose the correct answer:
                </p>
                <div style={{ borderRadius: "14px", overflow: "hidden", background: "#000", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", position: "relative" }}>
                  {/* Bandeau noir qui cache le titre YouTube en haut */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "42px", background: "#000", zIndex: 10, borderRadius: "14px 14px 0 0" }} />
                  <iframe
                    key={`${videoKey}-${current}`}
                    width="100%" height="260"
                    src={`https://www.youtube.com/embed/${q.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                    title="Sign to identify"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen style={{ display: "block", border: "none" }}
                  />
                </div>
              </div>
            )}

            {/* Texte fallback */}
            {q.type === "text" && (
              <p style={{ fontSize: "16px", fontWeight: "700", color: th.textPrimary, lineHeight: "1.5", marginBottom: "18px" }}>
                Which word belongs to "{lesson.title}"?
              </p>
            )}

            {/* Choix 2x2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              {q.choices.map((choice) => {
                const isSelected = selected === choice;
                const isCorrect  = choice === q.answer;
                let bg, border, color;
                if (!answered) {
                  bg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"; border = th.border; color = th.textPrimary;
                } else if (isCorrect) {
                  bg = "rgba(16,185,129,0.15)"; border = "#10b981"; color = "#10b981";
                } else if (isSelected) {
                  bg = "rgba(239,68,68,0.15)"; border = "#ef4444"; color = "#ef4444";
                } else {
                  bg = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"; border = th.border; color = th.textSecondary;
                }
                return (
                  <button key={choice} onClick={() => handleAnswer(choice)}
                    style={{ padding: "14px 12px", borderRadius: "12px", border: `1.5px solid ${border}`, background: bg, color, fontSize: "14px", fontWeight: "800", cursor: answered ? "default" : "pointer", textAlign: "center", transition: "all 0.15s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    {answered && <span>{isCorrect ? "✅" : isSelected ? "❌" : ""}</span>}
                    {choice}
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {answered && (
              <div style={{ padding: "12px", borderRadius: "10px", background: selected === q.answer ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${selected === q.answer ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, marginBottom: "14px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: selected === q.answer ? "#10b981" : "#ef4444" }}>
                  {selected === q.answer ? "🎉 Correct!" : `❌ The answer was: ${q.answer}`}
                </p>
              </div>
            )}

            {answered && (
              <button onClick={handleNext} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "none", background: accent, color: "white", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
                {current + 1 >= total ? "See Results 🎯" : "Next →"}
              </button>
            )}
          </>
        ) : (
          /* Résultats */
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "52px", marginBottom: "10px" }}>
              {percentage === 100 ? "🏆" : percentage >= 60 ? "🌟" : "💪"}
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: "900", color: th.textPrimary, margin: "0 0 4px" }}>
              {percentage === 100 ? "Perfect Score!" : percentage >= 60 ? "Good Job!" : "Keep Practicing!"}
            </h2>
            <p style={{ fontSize: "13px", color: th.textSecondary, margin: "0 0 16px" }}>{lesson.emoji} {lesson.title}</p>
            <div style={{ fontSize: "52px", fontWeight: "900", color: scoreColor, lineHeight: 1, marginBottom: "4px" }}>{score}/{total}</div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: scoreColor, marginBottom: "20px" }}>{percentage}%</div>

            {xpResult && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "center" }}>
                <div style={{ padding: "10px 20px", borderRadius: "12px", background: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)", border: `1px solid rgba(99,102,241,0.25)` }}>
                  <div style={{ fontSize: "18px", fontWeight: "900", color: accent }}>+{xpResult.xp_earned} XP</div>
                  <div style={{ fontSize: "10px", color: th.textSecondary }}>Earned</div>
                </div>
                <div style={{ padding: "10px 20px", borderRadius: "12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <div style={{ fontSize: "18px", fontWeight: "900", color: "#f59e0b" }}>🔥 {xpResult.streak}</div>
                  <div style={{ fontSize: "10px", color: th.textSecondary }}>Streak</div>
                </div>
              </div>
            )}

            <div style={{ textAlign: "left", marginBottom: "20px" }}>
              {results.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: `1px solid ${th.border}` }}>
                  <span>{r.correct ? "✅" : "❌"}</span>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "700", color: th.textPrimary, margin: "0 0 2px" }}>{r.word}</p>
                    {!r.correct && <p style={{ fontSize: "11px", color: "#10b981", margin: 0, fontWeight: "600" }}>Answer: {r.answer}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `1.5px solid ${th.border}`, background: "transparent", color: th.textPrimary, fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Close</button>
              <button onClick={() => { setCurrent(0); setScore(0); setSelected(null); setAnswered(false); setDone(false); setResults([]); setXpResult(null); setVideoKey((k) => k + 1); }}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: accent, color: "white", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                Retry 🔄
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}