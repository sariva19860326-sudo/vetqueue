import { useState, useEffect, useRef } from "react";

const DB_BASE = "https://cd0509vet-default-rtdb.firebaseio.com";

const QUEUES = {
  vet:    { key: "vet",    label: "獸醫師義診",    emoji: "🩺", desc: "專業獸醫師現場義診",    mins: 10 },
  beauty: { key: "beauty", label: "寵物美容體驗", emoji: "✂️", desc: "剪指甲・剃腳底毛",       mins: 10 },
};

const ACTIVITY_SESSIONS = [
  { start: "10:00", end: "13:00" },
  { start: "14:00", end: "17:00" },
];

const BREAK = { startH: 13, startM: 0, endH: 14, endM: 0 };

function isBreakTime() {
  const now = new Date();
  const tot = now.getHours() * 60 + now.getMinutes();
  return tot >= BREAK.startH * 60 + BREAK.startM && tot < BREAK.endH * 60 + BREAK.endM;
}

const defaultState = { current: 0, total: 0, isOpen: true };

// ── Firebase ──────────────────────────────────────────────────────────────────
async function loadQueue(key) {
  try {
    const r = await fetch(`${DB_BASE}/${key}.json`);
    const d = await r.json();
    return d ? { ...defaultState, ...d } : { ...defaultState };
  } catch { return { ...defaultState }; }
}
async function saveQueue(key, s) {
  try {
    await fetch(`${DB_BASE}/${key}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s),
    });
  } catch(e) { console.error(e); }
}

// ── Device ID ─────────────────────────────────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem("device-id");
  if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem("device-id", id); }
  return id;
}
async function loadMyNumbers(deviceId) {
  try {
    const r = await fetch(`${DB_BASE}/devices/${deviceId}.json`);
    const d = await r.json();
    return d || {};
  } catch { return {}; }
}
async function saveMyNumbers(deviceId, nums) {
  try {
    await fetch(`${DB_BASE}/devices/${deviceId}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nums),
    });
  } catch(e) { console.error(e); }
}

// ── Audio / Vibrate ───────────────────────────────────────────────────────────
let sharedCtx = null;
function getAudioCtx() {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (sharedCtx.state === "suspended") sharedCtx.resume();
  return sharedCtx;
}
function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    const buf = ctx.createBuffer(1,1,22050);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination); src.start(0);
  } catch(e) {}
}
function playAlert() {
  try {
    const ctx = getAudioCtx();
    [0, 0.35, 0.7].forEach(delay => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.5, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.45);
      osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.45);
    });
  } catch(e) {}
}
function vibrate() {
  try { if (navigator.vibrate) navigator.vibrate([400,200,400,200,800]); } catch(e) {}
}

// ── Paw SVG ───────────────────────────────────────────────────────────────────
function Paw({ size=32, color="currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill={color}>
      <ellipse cx="18" cy="14" rx="7" ry="9" />
      <ellipse cx="46" cy="14" rx="7" ry="9" />
      <ellipse cx="9"  cy="30" rx="6" ry="8" />
      <ellipse cx="55" cy="30" rx="6" ry="8" />
      <path d="M32 22 C18 22 10 34 12 46 C14 54 22 58 32 58 C42 58 50 54 52 46 C54 34 46 22 32 22Z" />
    </svg>
  );
}
const bgPaws = [
  {top:"6%",left:"3%",size:48,rot:-20},{top:"15%",left:"88%",size:36,rot:15},
  {top:"40%",left:"92%",size:28,rot:30},{top:"62%",left:"2%",size:40,rot:-10},
  {top:"80%",left:"85%",size:32,rot:25},{top:"90%",left:"15%",size:24,rot:-35},
];
function BgPaws({ color="#d4b896" }) {
  return <>{bgPaws.map((p,i) => (
    <div key={i} style={{ position:"fixed",top:p.top,left:p.left,transform:`rotate(${p.rot}deg)`,pointerEvents:"none",zIndex:0,color,opacity:0.18 }}>
      <Paw size={p.size} color="currentColor" />
    </div>
  ))}</>;
}

// ── Wait time estimate ────────────────────────────────────────────────────────
function WaitEstimate({ waiting, mins }) {
  if (waiting === null || waiting < 0) return null;
  const total = waiting * mins;
  const text  = total === 0 ? "即將輪到您" : total < 60 ? `約 ${total} 分鐘` : `約 ${Math.round(total/60)} 小時`;
  return (
    <div style={{ fontSize:14, color:"#1a1817", marginTop:3 }}>
      ⏱ 預估等候 {text}
    </div>
  );
}

// ── Queue Card ────────────────────────────────────────────────────────────────
function QueueCard({ qKey, state, myNumber, onTake, onRetake }) {
  const q       = QUEUES[qKey];
  const current = Number(state.current);
  const mine    = myNumber ? Number(typeof myNumber === "object" ? myNumber.number : myNumber) : 0;
  // 計算前面還有幾個人 (例如我是 5 號，目前叫 2 號，前面還有 5-2-1 = 2 個人)
  const waiting = mine > 0 ? Math.max(0, mine - current - 1) : null;
  const isMyTurn = mine > 0 && current === mine;
  const isNext   = mine > 0 && waiting === 0 && !isMyTurn;
  const isDone   = mine > 0 && current > mine;
  const prevTurn = useRef(false);

  useEffect(() => {
    if (isMyTurn && !prevTurn.current) { playAlert(); vibrate(); }
    prevTurn.current = isMyTurn;
  }, [isMyTurn]);

  const cardBg     = isMyTurn ? "#2e7d32" : isNext ? "#e65100" : "#fff";
  const cardBorder = isMyTurn ? "#81c784" : isNext ? "#ffb74d" : "#f0d9bc";
  const textColor  = (isMyTurn || isNext) && !isDone ? "#fff" : "#5a3a1a";
  const subColor   = (isMyTurn || isNext) && !isDone ? "#ffffffcc" : "#a07850";

  return (
    <div style={{ background: isDone ? "#fff" : cardBg, borderRadius:20, border:`2px solid ${isDone ? "#f0d9bc" : cardBorder}`, boxShadow:"0 4px 20px rgba(192,122,58,0.12)", padding:"20px 24px", zIndex:1, transition:"background 0.4s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:22 }}>{q.emoji}</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color: textColor }}>{q.label}</div>
          <div style={{ fontSize:11, color: subColor }}>{q.desc}</div>
        </div>
      </div>

      {isDone ? (
        <div style={{ textAlign:"center", padding:"8px 0" }}>
          <div style={{ fontSize:28, marginBottom:6 }}>🐾</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#5a3a1a" }}>感謝您今天的參與！</div>
          <div style={{ fontSize:12, color:"#a07850", marginTop:4 }}>祝毛孩健康平安 💛</div>
          {state.isOpen && (
            <button onClick={() => { unlockAudio(); onRetake(); }} style={{ marginTop:12, background:"#c07a3a", color:"#fff", border:"none", borderRadius:40, padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              🔄 重新取號
            </button>
          )}
        </div>
      ) : mine > 0 ? (
        <>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:11, color: subColor, marginBottom:2 }}>您的號碼</div>
              <div style={{ fontSize:48, fontWeight:900, lineHeight:1, color: isMyTurn || isNext ? "#fff" : "#c07a3a" }}>
                {String(mine).padStart(3,"0")}
              </div>
              {!isMyTurn && (
                <WaitEstimate 
                  // 這裡傳入剩餘人數。如果是 isNext，則傳入 1 代表快輪到他了
                  waiting={isNext ? 1 : waiting + 1} 
                  // 這裡直接傳入單次服務的基準分鐘數 (10)
                  mins={q.mins} 
                />
              )}
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11, color: subColor, marginBottom:2 }}>目前叫號</div>
              <div style={{ fontSize:32, fontWeight:700, color: isMyTurn || isNext ? "#ffffffcc" : "#a07850" }}>
                {current === 0 ? "—" : String(current).padStart(3,"0")}
              </div>
            </div>
          </div>
          <div style={{ marginTop:10, fontSize:13, fontWeight:600, textAlign:"center", color: isMyTurn || isNext ? "#fff" : "#7a5030" }}>
            {isMyTurn ? "🎉 輪到您了，請進！" : isNext ? "⚡ 下一位就是您，請準備！" : `前面還有 ${waiting} 位`}
          </div>
        </>
      ) : (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:12, color:"#a07850" }}>
            目前叫號：{current === 0 ? "—" : String(current).padStart(3,"0")}<br />
            已取號 {state.total} 人
          </div>
          <button onClick={() => { unlockAudio(); onTake(); }} disabled={!state.isOpen} style={{ background: state.isOpen ? "#c07a3a" : "#ccc", color:"#fff", border:"none", borderRadius:40, padding:"10px 20px", fontSize:14, fontWeight:700, cursor: state.isOpen ? "pointer" : "default" }}>
            {state.isOpen ? "🐾 取號" : "已暫停"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── CUSTOMER VIEW ─────────────────────────────────────────────────────────────
function CustomerView({ states, myNumbers, onTake, onRetake }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n+1), 30000);
    return () => clearInterval(id);
  }, []);

  const onBreak    = isBreakTime();

  return (
    <div style={{ minHeight:"100vh", background:"#fdf6ee", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, padding:"32px 20px", fontFamily:"'Noto Serif TC', Georgia, serif", position:"relative", overflow:"hidden" }}>
      <BgPaws />

      {/* header */}
      <div style={{ textAlign:"center", zIndex:1 }}>
        <Paw size={44} color="#c07a3a" />
        <h1 style={{ margin:"8px 0 0", fontSize:20, color:"#5a3a1a", letterSpacing:2 }}>百分百寵物生活館</h1>
        <p style={{ margin:"4px 0 0", fontSize:12, color:"#a07850" }}>永和中山店開幕限定活動</p>
      </div>

      {/* activity time */}
      <div style={{ zIndex:1, background:"#fff", borderRadius:14, border:"1px solid #f0d9bc", padding:"10px 20px", textAlign:"center" }}>
        <div style={{ fontSize:11, color:"#a07850", marginBottom:4, letterSpacing:1 }}>獸醫師義診/美容師體驗活動時間</div>
        {ACTIVITY_SESSIONS.map((s,i) => (
          <div key={i} style={{ fontSize:14, fontWeight:700, color:"#c07a3a" }}>{s.start} – {s.end}</div>
        ))}
      </div>

      {/* break banner */}
      {onBreak && (
        <div style={{ width:"100%", maxWidth:360, zIndex:1, background:"#fff3e0", borderRadius:16, border:"2px solid #ffb74d", padding:"16px 20px", textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:6 }}>☕</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#5a3a1a" }}>獸醫師與美容師的休息時間</div>
          <div style={{ fontSize:13, color:"#a07850", marginTop:4 }}>
            13:00 – 14:00<br />休息結束後恢復服務，請稍候 🐾
          </div>
        </div>
      )}

      {/* queue cards */}
      <div style={{ width:"100%", maxWidth:360, display:"flex", flexDirection:"column", gap:14, zIndex:1 }}>
        {Object.keys(QUEUES).map(key => (
          <QueueCard key={key} qKey={key} state={states[key]} myNumber={myNumbers[key]} onTake={() => onTake(key)} onRetake={() => onRetake(key)} />
        ))}
      </div>

      <p style={{ fontSize:11, color:"#c0a080", zIndex:1, textAlign:"center" }}>請留意號碼變化，輪到您時請前往對應區域</p>
    </div>
  );
}

// ── VET ADMIN VIEW ────────────────────────────────────────────────────────────
function VetView({ qKey, state, onNext, onReset, onToggle, saving }) {
  const q = QUEUES[qKey];
  const onBreak = isBreakTime();
  return (
    <div style={{ minHeight:"100vh", background:"#1a1008", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, padding:"32px 20px", fontFamily:"'Noto Serif TC', Georgia, serif", position:"relative", overflow:"hidden" }}>
      <BgPaws color="#c07a3a" />

      <div style={{ textAlign:"center", zIndex:1 }}>
        <span style={{ fontSize:40 }}>{q.emoji}</span>
        <h1 style={{ margin:"8px 0 0", fontSize:20, color:"#f0d9bc", letterSpacing:2 }}>{q.label}</h1>
        <p style={{ margin:"4px 0 0", fontSize:12, color:"#a07850" }}>操作台</p>
      </div>

      {onBreak && (
        <div style={{ zIndex:1, background:"#2a1a00", borderRadius:12, padding:"10px 20px", textAlign:"center", border:"1px solid #ffb74d" }}>
          <span style={{ fontSize:13, color:"#ffb74d" }}>☕ 獸醫師與美容師的休息時間 13:00–14:00</span>
        </div>
      )}

      <div style={{ display:"flex", gap:16, zIndex:1 }}>
        {[
          { label:"目前叫號", value: state.current === 0 ? "—" : String(state.current).padStart(3,"0") },
          { label:"總取號數", value: String(state.total).padStart(3,"0") },
          { label:"待診人數", value: String(Math.max(0, state.total - state.current)).padStart(3,"0") },
        ].map(s => (
          <div key={s.label} style={{ background:"#2a1a08", borderRadius:16, padding:"16px 20px", textAlign:"center", border:"1px solid #4a2e10" }}>
            <div style={{ fontSize:32, fontWeight:900, color:"#c07a3a" }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#a07850", marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <button onClick={onNext} disabled={saving} style={{ background: saving ? "#3a2510" : "#c07a3a", color: saving ? "#6a4a20" : "#fff", border:"none", borderRadius:60, padding:"22px 60px", fontSize:22, fontWeight:900, cursor: saving ? "default" : "pointer", letterSpacing:1, zIndex:1, boxShadow:"0 6px 28px rgba(192,122,58,0.4)", transition:"transform 0.1s, background 0.2s" }}
        onMouseDown={e => { if(!saving) e.currentTarget.style.transform="scale(0.95)" }}
        onMouseUp={e => e.currentTarget.style.transform="scale(1)"}
      >
        {saving ? "更新中…" : "➡ 下一位"}
      </button>

      <div style={{ display:"flex", gap:12, zIndex:1, flexWrap:"wrap", justifyContent:"center" }}>
        <button onClick={onToggle} style={{ background:"transparent", color: state.isOpen ? "#e07030" : "#50a060", border:`1px solid ${state.isOpen ? "#e07030" : "#50a060"}`, borderRadius:24, padding:"10px 20px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
          {state.isOpen ? "⏸ 暫停取號" : "▶ 開放取號"}
        </button>
        <button onClick={onReset} style={{ background:"transparent", color:"#806050", border:"1px solid #4a2e10", borderRadius:24, padding:"10px 20px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
          🔄 重置號碼
        </button>
      </div>

      <p style={{ fontSize:11, color:"#6a4a20", zIndex:1 }}>此頁面為工作人員專用</p>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const mode   = params.get("mode");

  const [states,    setStates]    = useState({ vet:{...defaultState}, beauty:{...defaultState} });
  const [myNumbers, setMyNumbers] = useState({});
  const [saving,    setSaving]    = useState(false);
  const [loaded,    setLoaded]    = useState(false);
  const deviceId = useRef(getDeviceId());

  useEffect(() => {
    async function init() {
      const [vetS, beautyS, rawNums] = await Promise.all([loadQueue("vet"), loadQueue("beauty"), loadMyNumbers(deviceId.current)]);
      const queues = { vet: vetS, beauty: beautyS };
      const nums   = {};
      for (const key of Object.keys(QUEUES)) {
        const entry   = rawNums[key];
        if (!entry) continue;
        const takenAt = typeof entry === "object" ? entry.takenAt : 0;
        const number  = typeof entry === "object" ? entry.number  : entry;
        const resetAt = queues[key].resetAt || 0;
        if (takenAt > resetAt) nums[key] = { number, takenAt };
      }
      setStates(queues);
      setMyNumbers(nums);
      setLoaded(true);
    }
    init();
    const id = setInterval(async () => {
      const [vetS, beautyS] = await Promise.all([loadQueue("vet"), loadQueue("beauty")]);
      setStates({ vet: vetS, beauty: beautyS });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const handleTake = async (key) => {
    const s    = await loadQueue(key);
    const next = { ...s, total: s.total + 1 };
    const nums = { ...myNumbers, [key]: { number: next.total, takenAt: Date.now() } };
    setStates(prev => ({ ...prev, [key]: next }));
    setMyNumbers(nums);
    await Promise.all([saveQueue(key, next), saveMyNumbers(deviceId.current, nums)]);
  };

  const handleRetake = async (key) => {
    const nums = { ...myNumbers };
    delete nums[key];
    setMyNumbers(nums);
    await saveMyNumbers(deviceId.current, nums);
    await handleTake(key);
  };

  const handleNext = async (key) => {
    setSaving(true);
    const s        = await loadQueue(key);
    const newTotal = Math.max(s.total, s.current + 1);
    const next     = { ...s, total: newTotal, current: s.current + 1 };
    setStates(prev => ({ ...prev, [key]: next }));
    await saveQueue(key, next);
    setSaving(false);
  };

  const handleReset = async (key) => {
    if (!window.confirm(`確定重置「${QUEUES[key].label}」的所有號碼？\n客人的取號記錄也會一併清除。`)) return;
    const next = { ...defaultState, resetAt: Date.now() };
    setStates(prev => ({ ...prev, [key]: next }));
    await saveQueue(key, next);
  };

  const handleToggle = async (key) => {
    const s    = await loadQueue(key);
    const next = { ...s, isOpen: !s.isOpen };
    setStates(prev => ({ ...prev, [key]: next }));
    await saveQueue(key, next);
  };

  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:"#fdf6ee", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia, serif", color:"#c07a3a", fontSize:16 }}>
      載入中…
    </div>
  );

  if (mode === "vet")    return <VetView qKey="vet"    state={states.vet}    onNext={() => handleNext("vet")}    onReset={() => handleReset("vet")}    onToggle={() => handleToggle("vet")}    saving={saving} />;
  if (mode === "beauty") return <VetView qKey="beauty" state={states.beauty} onNext={() => handleNext("beauty")} onReset={() => handleReset("beauty")} onToggle={() => handleToggle("beauty")} saving={saving} />;
  return <CustomerView states={states} myNumbers={myNumbers} onTake={handleTake} onRetake={handleRetake} />;
}
