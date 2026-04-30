import { useState, useEffect, useRef } from "react";

const DB_URL = "https://cd0509vet-default-rtdb.firebaseio.com/queue.json";

const defaultState = {
  current: 0,
  total: 0,
  isOpen: true,
};

// ── helpers ──────────────────────────────────────────────────────────────────
async function loadState() {
  try {
    const r = await fetch(DB_URL);
    const data = await r.json();
    return data ? { ...defaultState, ...data } : defaultState;
  } catch {
    return defaultState;
  }
}

async function saveState(s) {
  try {
    await fetch(DB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
  } catch (e) {
    console.error(e);
  }
}

// ── paw print SVG ────────────────────────────────────────────────────────────
function Paw({ size = 32, color = "currentColor", opacity = 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill={color} opacity={opacity}>
      <ellipse cx="18" cy="14" rx="7" ry="9" />
      <ellipse cx="46" cy="14" rx="7" ry="9" />
      <ellipse cx="9"  cy="30" rx="6" ry="8" />
      <ellipse cx="55" cy="30" rx="6" ry="8" />
      <path d="M32 22 C18 22 10 34 12 46 C14 54 22 58 32 58 C42 58 50 54 52 46 C54 34 46 22 32 22Z" />
    </svg>
  );
}

// ── decorative background paws ───────────────────────────────────────────────
const bgPaws = [
  { top:"6%",  left:"3%",  size:48, rot:-20 },
  { top:"15%", left:"88%", size:36, rot:15  },
  { top:"40%", left:"92%", size:28, rot:30  },
  { top:"62%", left:"2%",  size:40, rot:-10 },
  { top:"80%", left:"85%", size:32, rot:25  },
  { top:"90%", left:"15%", size:24, rot:-35 },
];

function BgPaws() {
  return (
    <>
      {bgPaws.map((p, i) => (
        <div key={i} style={{
          position:"fixed", top:p.top, left:p.left,
          transform:`rotate(${p.rot}deg)`,
          pointerEvents:"none", zIndex:0,
          color:"#d4b896", opacity:0.18,
        }}>
          <Paw size={p.size} color="currentColor" />
        </div>
      ))}
    </>
  );
}

// ── CUSTOMER VIEW ────────────────────────────────────────────────────────────
function CustomerView({ state, myNumber, onTakeNumber }) {
  const current  = Number(state.current);
  const mine     = Number(myNumber);
  const waiting  = mine > 0 ? Math.max(0, mine - current - 1) : null;
  const isMyTurn = mine > 0 && current === mine;
  const isNext   = mine > 0 && waiting === 0 && !isMyTurn;
  const isDone   = mine > 0 && current > mine;

  return (
    <div style={{
      minHeight:"100vh", background:"#fdf6ee",
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", gap:24, padding:"32px 20px",
      fontFamily:"'Noto Serif TC', Georgia, serif",
      position:"relative", overflow:"hidden",
    }}>
      <BgPaws />

      {/* header */}
      <div style={{ textAlign:"center", zIndex:1 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
          <Paw size={44} color="#c07a3a" />
        </div>
        <h1 style={{ margin:0, fontSize:22, color:"#5a3a1a", letterSpacing:2 }}>
          獸醫師義診
        </h1>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"#a07850" }}>
          新開店特別活動
        </p>
      </div>

      {/* current number display */}
      <div style={{
        background:"#fff", borderRadius:24,
        boxShadow:"0 4px 24px rgba(192,122,58,0.15)",
        padding:"28px 48px", textAlign:"center", zIndex:1,
        border:"2px solid #f0d9bc",
      }}>
        <p style={{ margin:"0 0 8px", fontSize:13, color:"#a07850", letterSpacing:1 }}>
          目前叫號
        </p>
        <div style={{
          fontSize:72, fontWeight:900, color:"#c07a3a",
          lineHeight:1, letterSpacing:-2,
        }}>
          {state.current === 0 ? "—" : String(state.current).padStart(3, "0")}
        </div>
        <p style={{ margin:"8px 0 0", fontSize:12, color:"#c0a080" }}>
          {state.isOpen ? `已取號 ${state.total} 人` : "今日義診已結束"}
        </p>
      </div>

      {/* my number */}
      {!myNumber ? (
        <button onClick={onTakeNumber} disabled={!state.isOpen} style={{
          background: state.isOpen ? "#c07a3a" : "#ccc",
          color:"#fff", border:"none", borderRadius:50,
          padding:"16px 40px", fontSize:18, fontWeight:700,
          cursor: state.isOpen ? "pointer" : "default",
          letterSpacing:1, zIndex:1,
          boxShadow:"0 4px 16px rgba(192,122,58,0.35)",
          transition:"transform 0.1s",
        }}
          onMouseDown={e => e.currentTarget.style.transform="scale(0.96)"}
          onMouseUp={e => e.currentTarget.style.transform="scale(1)"}
        >
          🐾 立即取號
        </button>
      ) : isDone ? (
        <div style={{
          background:"#fff", borderRadius:24, padding:"32px 40px",
          textAlign:"center", zIndex:1,
          border:"2px solid #f0d9bc",
          boxShadow:"0 4px 24px rgba(0,0,0,0.10)",
        }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🐾</div>
          <p style={{ margin:"0 0 8px", fontSize:20, fontWeight:700, color:"#5a3a1a" }}>
            感謝您今天的參與！
          </p>
          <p style={{ margin:0, fontSize:13, color:"#a07850" }}>
            祝毛孩健康平安 💛
          </p>
        </div>
      ) : (
        <div style={{
          background: isMyTurn ? "#2e7d32" : isNext ? "#e65100" : "#fff",
          borderRadius:24, padding:"24px 40px", textAlign:"center", zIndex:1,
          border: isMyTurn ? "2px solid #81c784" : isNext ? "2px solid #ffb74d" : "2px solid #f0d9bc",
          boxShadow:"0 4px 24px rgba(0,0,0,0.10)",
          transition:"background 0.5s",
        }}>
          <p style={{
            margin:"0 0 6px", fontSize:12,
            color: isMyTurn || isNext ? "#ffffffcc" : "#a07850",
            letterSpacing:1,
          }}>
            您的號碼
          </p>
          <div style={{
            fontSize:64, fontWeight:900, lineHeight:1,
            color: isMyTurn || isNext ? "#fff" : "#c07a3a",
          }}>
            {String(mine).padStart(3, "0")}
          </div>
          <p style={{
            margin:"10px 0 0", fontSize:15, fontWeight:600,
            color: isMyTurn || isNext ? "#fff" : "#7a5030",
          }}>
            {isMyTurn
              ? "🎉 輪到您了，請進！"
              : isNext
              ? "⚡ 下一位就是您，請準備！"
              : `前面還有 ${waiting} 位`}
          </p>
        </div>
      )}

      <p style={{ fontSize:11, color:"#c0a080", zIndex:1, textAlign:"center" }}>
        請留意本頁號碼變化，輪到您時請前往義診區
      </p>
    </div>
  );
}

// ── VET (ADMIN) VIEW ─────────────────────────────────────────────────────────
function VetView({ state, onNext, onReset, onToggle, saving }) {
  return (
    <div style={{
      minHeight:"100vh", background:"#1a1008",
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", gap:24, padding:"32px 20px",
      fontFamily:"'Noto Serif TC', Georgia, serif",
      position:"relative", overflow:"hidden",
    }}>
      <BgPaws />

      <div style={{ textAlign:"center", zIndex:1 }}>
        <Paw size={36} color="#c07a3a" />
        <h1 style={{ margin:"8px 0 0", fontSize:20, color:"#f0d9bc", letterSpacing:2 }}>
          獸醫師操作台
        </h1>
      </div>

      {/* stats row */}
      <div style={{
        display:"flex", gap:16, zIndex:1,
      }}>
        {[
          { label:"目前叫號", value: state.current === 0 ? "—" : String(state.current).padStart(3,"0") },
          { label:"總取號數", value: String(state.total).padStart(3,"0") },
          { label:"待診人數", value: String(Math.max(0, state.total - state.current)).padStart(3,"0") },
        ].map(s => (
          <div key={s.label} style={{
            background:"#2a1a08", borderRadius:16, padding:"16px 20px",
            textAlign:"center", border:"1px solid #4a2e10",
          }}>
            <div style={{ fontSize:32, fontWeight:900, color:"#c07a3a" }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#a07850", marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* next button */}
      <button
        onClick={onNext}
        disabled={saving}
        style={{
          background: saving ? "#3a2510" : "#c07a3a",
          color: saving ? "#6a4a20" : "#fff",
          border:"none", borderRadius:60,
          padding:"22px 60px", fontSize:22, fontWeight:900,
          cursor: saving ? "default" : "pointer",
          letterSpacing:1, zIndex:1,
          boxShadow:"0 6px 28px rgba(192,122,58,0.4)",
          transition:"transform 0.1s, background 0.2s",
        }}
        onMouseDown={e => { if(!saving) e.currentTarget.style.transform="scale(0.95)" }}
        onMouseUp={e => e.currentTarget.style.transform="scale(1)"}
      >
        {saving ? "更新中…" : "➡ 下一位"}
      </button>

      {/* secondary actions */}
      <div style={{ display:"flex", gap:12, zIndex:1 }}>
        <button onClick={onToggle} style={{
          background:"transparent", color: state.isOpen ? "#e07030" : "#50a060",
          border:`1px solid ${state.isOpen ? "#e07030" : "#50a060"}`,
          borderRadius:24, padding:"10px 20px", fontSize:13,
          cursor:"pointer", fontFamily:"inherit",
        }}>
          {state.isOpen ? "⏸ 暫停取號" : "▶ 開放取號"}
        </button>
        <button onClick={onReset} style={{
          background:"transparent", color:"#806050",
          border:"1px solid #4a2e10",
          borderRadius:24, padding:"10px 20px", fontSize:13,
          cursor:"pointer", fontFamily:"inherit",
        }}>
          🔄 重置號碼
        </button>
      </div>

      <p style={{ fontSize:11, color:"#6a4a20", zIndex:1 }}>
        此頁面為獸醫師專用，請勿分享給客人
      </p>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [isVet,    setIsVet]    = useState(
    new URLSearchParams(window.location.search).get("mode") === "vet"
  );
  const [state,    setState]    = useState(defaultState);
  const [myNumber, setMyNumber] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [loaded,   setLoaded]   = useState(false);
  const stateRef = useRef(defaultState);

  // keep ref in sync
  useEffect(() => { stateRef.current = state; }, [state]);

  // poll Firebase every 2s
  useEffect(() => {
    loadState().then(s => { setState(s); setLoaded(true); });
    const id = setInterval(() => {
      loadState().then(s => setState(s));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const takeNumber = async () => {
    const s = await loadState();
    const next = { ...s, total: s.total + 1 };
    setMyNumber(next.total);
    setState(next);
    await saveState(next);
  };

  const callNext = async () => {
    setSaving(true);
    const s = await loadState();
    const newTotal = Math.max(s.total, s.current + 1);
    const next = { ...s, total: newTotal, current: s.current + 1 };
    setState(next);
    await saveState(next);
    setSaving(false);
  };

  const resetQueue = async () => {
    if (!window.confirm("確定重置所有號碼？")) return;
    setState(defaultState);
    setMyNumber(null);
    await saveState(defaultState);
  };

  const toggleOpen = async () => {
    const s = await loadState();
    const next = { ...s, isOpen: !s.isOpen };
    setState(next);
    await saveState(next);
  };

  if (!loaded) return (
    <div style={{
      minHeight:"100vh", background:"#fdf6ee",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"Georgia, serif", color:"#c07a3a", fontSize:16,
    }}>
      載入中…
    </div>
  );

  if (isVet) return <VetView state={state} onNext={callNext} onReset={resetQueue} onToggle={toggleOpen} saving={saving} />;
  return <CustomerView state={state} myNumber={myNumber} onTakeNumber={takeNumber} />;
}
