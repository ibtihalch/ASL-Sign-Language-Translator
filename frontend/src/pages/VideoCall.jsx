import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { useTheme } from "../context/ThemeContext";
import { themes } from "../context/themes";

const APP_ID   = "d2443500d47744458deee64100cd7179";
const API_BASE = "http://localhost:5000/api";

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

function apiFetch(path, opts = {}) {
  const token = localStorage.getItem("token");
  return fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
    ...opts,
  });
}

export default function VideoCall({ friend, channelName, onClose }) {
  const { theme } = useTheme();
  const th        = themes[theme];

  const [joined,      setJoined]      = useState(false);
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [micOn,       setMicOn]       = useState(true);
  const [camOn,       setCamOn]       = useState(true);
  const [sharing,     setSharing]     = useState(false);
  const [screenTrack, setScreenTrack] = useState(null);
  const [duration,    setDuration]    = useState(0);
  const [status,      setStatus]      = useState("Connexion…");

  const localRef  = useRef(null);
  const timerRef  = useRef(null);
  const notifSent = useRef(false);

  const me      = JSON.parse(localStorage.getItem("user") || "{}");
  const channel = channelName || `asl_${[me.id, friend?.id].sort().join("_")}`;

  useEffect(() => {
    let videoTrack, audioTrack;

    const join = async () => {
      try {
        setStatus("Connexion au serveur…");
        await client.join(APP_ID, channel, null, null);

        setStatus("Accès à la caméra…");
        [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();

        if (localRef.current) videoTrack.play(localRef.current);
        await client.publish([audioTrack, videoTrack]);

        setLocalTracks({ video: videoTrack, audio: audioTrack });
        setJoined(true);
        setStatus("Appel en cours");
        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

        // ── Notif appel entrant → ami (une seule fois) ──
        if (!notifSent.current && friend?.id) {
          notifSent.current = true;
          apiFetch("/notifications/call", {
            method: "POST",
            body: JSON.stringify({ to_id: friend.id, channel }),
          }).catch(() => {});
        }
      } catch (err) {
        setStatus("Erreur : " + err.message);
      }
    };

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "video") {
        setRemoteUsers((prev) =>
          prev.find((u) => u.uid === user.uid) ? prev : [...prev, user]
        );
        setTimeout(() => {
          const el = document.getElementById(`remote-${user.uid}`);
          if (el) user.videoTrack?.play(el);
        }, 200);
      }
      if (mediaType === "audio") user.audioTrack?.play();
    });

    client.on("user-unpublished", (user) => setRemoteUsers((p) => p.filter((u) => u.uid !== user.uid)));
    client.on("user-left",        (user) => setRemoteUsers((p) => p.filter((u) => u.uid !== user.uid)));

    join();

    return () => {
      clearInterval(timerRef.current);
      videoTrack?.close();
      audioTrack?.close();
      screenTrack?.close();
      client.leave();
      client.removeAllListeners();
    };
    // eslint-disable-next-line
  }, []);

  const toggleMic = async () => {
    if (!localTracks.audio) return;
    await localTracks.audio.setEnabled(!micOn);
    setMicOn((v) => !v);
  };

  const toggleCam = async () => {
    if (!localTracks.video) return;
    await localTracks.video.setEnabled(!camOn);
    setCamOn((v) => !v);
  };

  const toggleScreen = async () => {
    if (sharing) {
      screenTrack?.close();
      await client.unpublish(screenTrack);
      if (localTracks.video) {
        await client.publish(localTracks.video);
        if (localRef.current) localTracks.video.play(localRef.current);
      }
      setScreenTrack(null);
      setSharing(false);
    } else {
      try {
        const track = await AgoraRTC.createScreenVideoTrack();
        await client.unpublish(localTracks.video);
        await client.publish(track);
        if (localRef.current) track.play(localRef.current);
        setScreenTrack(track);
        setSharing(true);
        track.on("track-ended", async () => {
          track.close();
          await client.unpublish(track);
          if (localTracks.video) {
            await client.publish(localTracks.video);
            if (localRef.current) localTracks.video.play(localRef.current);
          }
          setScreenTrack(null);
          setSharing(false);
        });
      } catch {}
    }
  };

  const endCall = async () => {
    clearInterval(timerRef.current);
    localTracks.video?.close();
    localTracks.audio?.close();
    screenTrack?.close();
    await client.leave();
    onClose?.();
  };

  const fmt       = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const hasRemote = remoteUsers.length > 0;

  return (
    <>
      <style>{`
        @import url("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css");
        .vc-btn{width:48px;height:48px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all 0.2s;flex-shrink:0;}
        .vc-btn:hover{transform:scale(1.08);}
        .vc-btn-off{background:rgba(255,255,255,0.15);color:white;}
        .vc-btn-off:hover{background:rgba(255,255,255,0.25);}
        .vc-btn-muted{background:rgba(239,68,68,0.25);color:#ef4444;border:1px solid rgba(239,68,68,0.4);}
        .vc-btn-end{width:56px;height:56px;background:#ef4444;color:white;}
        .vc-btn-end:hover{background:#dc2626;}
        .vc-btn-screen{background:${sharing?"rgba(37,99,235,0.35)":"rgba(255,255,255,0.15)"};color:${sharing?"#60a5fa":"white"};border:1px solid ${sharing?"rgba(37,99,235,0.5)":"transparent"};}
        .vc-btn-screen:hover{background:rgba(37,99,235,0.25);}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .pulse{animation:pulse 2s infinite;}
      `}</style>

      <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:"min(900px,96vw)",height:"min(600px,90vh)",background:"#0f172a",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 24px 80px rgba(0,0,0,0.6)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* Header */}
          <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <img src={friend?.photo||`https://ui-avatars.com/api/?name=${encodeURIComponent(friend?.name||"?")}&background=2563eb&color=fff&size=36`}
                alt="" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}}/>
              <div>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:"white"}}>{friend?.name||"Appel"}</p>
                <p style={{margin:0,fontSize:12,color:joined?(hasRemote?"#4ade80":"#facc15"):"#94a3b8"}}>
                  {joined
                    ? <><span className={hasRemote?"":"pulse"}>● </span>{hasRemote?fmt(duration):"En attente…"}</>
                    : status}
                </p>
              </div>
            </div>
            {sharing && (
              <span style={{fontSize:11,fontWeight:700,color:"#60a5fa",background:"rgba(37,99,235,0.2)",padding:"3px 10px",borderRadius:20,border:"1px solid rgba(37,99,235,0.4)"}}>
                <i className="bi bi-display"/> Partage actif
              </span>
            )}
          </div>

          {/* Video */}
          <div style={{flex:1,position:"relative",background:"#080f1e",overflow:"hidden"}}>
            {hasRemote ? remoteUsers.map((u) => (
              <div key={u.uid} id={`remote-${u.uid}`} style={{width:"100%",height:"100%",background:"#0a1628"}}/>
            )) : (
              <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
                <img src={friend?.photo||`https://ui-avatars.com/api/?name=${encodeURIComponent(friend?.name||"?")}&background=1e3a5f&color=60a5fa&size=80`}
                  alt="" style={{width:80,height:80,borderRadius:"50%",opacity:0.6}}/>
                <p style={{color:"rgba(255,255,255,0.4)",fontSize:14,margin:0}} className="pulse">
                  En attente de {friend?.name}…
                </p>
              </div>
            )}
            {/* PiP local */}
            <div style={{position:"absolute",bottom:16,right:16,width:160,height:110,borderRadius:12,overflow:"hidden",border:"2px solid rgba(37,99,235,0.5)",background:"#0a1628",boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
              <div ref={localRef} style={{width:"100%",height:"100%"}}/>
              {!camOn && (
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0a1628"}}>
                  <i className="bi bi-camera-video-off" style={{color:"rgba(255,255,255,0.3)",fontSize:22}}/>
                </div>
              )}
              <div style={{position:"absolute",bottom:4,left:6,fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:600}}>Vous</div>
            </div>
          </div>

          {/* Controls */}
          <div style={{padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,borderTop:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)"}}>
            <button className={`vc-btn ${micOn?"vc-btn-off":"vc-btn-muted"}`} onClick={toggleMic}>
              <i className={`bi bi-${micOn?"mic-fill":"mic-mute-fill"}`}/>
            </button>
            <button className={`vc-btn ${camOn?"vc-btn-off":"vc-btn-muted"}`} onClick={toggleCam}>
              <i className={`bi bi-${camOn?"camera-video-fill":"camera-video-off-fill"}`}/>
            </button>
            <button className="vc-btn vc-btn-screen" onClick={toggleScreen}>
              <i className={`bi bi-${sharing?"stop-circle-fill":"display"}`}/>
            </button>
            <button className="vc-btn vc-btn-end" onClick={endCall}>
              <i className="bi bi-telephone-x-fill"/>
            </button>
          </div>

        </div>
      </div>
    </>
  );
}