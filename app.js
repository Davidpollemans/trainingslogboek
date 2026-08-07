import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@19.1.1";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "https://esm.sh/recharts@3.1.2?external=react,react-dom";
const VERSION = 2;
const KEY = "trainer:state";
const LADDER = ["3x8", "4x8", "3x10", "4x10", "3x12", "4x12"];
const C = { ink: "#16150F", card: "#211F17", cardHi: "#2B2819", line: "#3C3826", ochre: "#E0A526", ochreDim: "#6E5722", bone: "#F2EDE0", muted: "#A9A28E", green: "#8DB567", red: "#D9786A" };
const SESSIONS = {
    A: [
        { id: "rot_a", name: "Schouderrotaties", group: "Rotatorenmanchet", fixed: "2 x 15 | 5 kg", rest: 0, cue: "Onderhoud. Niet zwaarder worden." },
        { id: "legpress", name: "Leg press", group: "Quadriceps | Hamstrings", weight: 60, unit: "kg", rung: 0, rest: 120 },
        { id: "chestpress", name: "Incline chest press", group: "Bovenkant borst | Triceps", weight: 20, unit: "kg per kant", rung: 2, rest: 90 },
        { id: "pulldown", name: "Convergent pull down", group: "Rug | Biceps", weight: 35, unit: "kg per kant", rung: 2, rest: 75, cue: "Beweging start in je schouders." },
        { id: "legcurl", name: "Leg curl", group: "Hamstrings", weight: null, unit: "kg", rung: 0, rest: 60, cue: "Nieuw: zoek je startgewicht." },
        { id: "triceps", name: "Triceps push down", group: "Triceps", weight: 24.5, unit: "kg", rung: 2, rest: 60 },
        { id: "plank", name: "Plank", group: "Rechte buikspieren", fixed: "3 x 40 sec", rest: 30 }
    ],
    B: [
        { id: "rot_b", name: "Schouderrotaties", group: "Rotatorenmanchet", fixed: "2 x 15 | 5 kg", rest: 0, cue: "Onderhoud. Niet zwaarder worden." },
        { id: "hipthrust", name: "Hip thrust", group: "Bilspieren | Hamstrings", weight: 40, unit: "kg", rung: 0, rest: 120, cue: "Kin naar borst, ribben omlaag." },
        { id: "arnold", name: "Arnold press", group: "Schouders | Triceps", weight: 12, unit: "kg", rung: 2, rest: 90, cue: "3x10 eerst schoon afmaken." },
        { id: "row", name: "Horizontal row", group: "Bovenrug | Biceps", weight: 23.5, unit: "kg", rung: 3, rest: 75, cue: "Ellebogen achter je torso." },
        { id: "split", name: "Split squat", group: "Quadriceps | Bilspieren", weight: null, unit: "kg", rung: 0, rest: 60, cue: "Nieuw: per been tellen." },
        { id: "curl", name: "Hammer curl", group: "Biceps", weight: 24.5, unit: "kg", rung: 0, rest: 60 },
        { id: "lateral", name: "Lateral raise", group: "Schouders", weight: 6, unit: "kg", rung: 0, rest: 45 },
        { id: "crunch", name: "Cable crunch", group: "Rechte buikspieren", weight: null, unit: "kg", rung: 0, rest: 45, cue: "Nieuw: buig vanuit je romp." }
    ]
};
const SLOTS = [
    { id: "di", label: "Di", name: "Kickboksen", gym: false }, { id: "wo", label: "Wo", name: "Sportschool", gym: true },
    { id: "do", label: "Do", name: "Krav maga", gym: false }, { id: "vr", label: "Vr", name: "Inhaaldag sportschool", gym: true, optional: true },
    { id: "za", label: "Za", name: "Sportschool", gym: true }, { id: "zo", label: "Zo", name: "Sportschool", gym: true }
];
const DAY_TO_SLOT = { 2: "di", 3: "wo", 4: "do", 5: "vr", 6: "za", 0: "zo" };
const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const fmt = iso => { if (!iso)
    return "-"; const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtFull = iso => { const d = new Date(iso); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const mondayOf = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(12, 0, 0, 0); return x; };
const weekKey = d => { const m = mondayOf(d); return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`; };
const parseNumber = v => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const nl = (v, d = 1) => v == null ? "-" : Number(v).toFixed(d).replace(".", ",");
const allItems = () => [...SESSIONS.A, ...SESSIONS.B];
const defaultExercises = () => Object.fromEntries(allItems().filter(x => !x.fixed).map(x => [x.id, { weight: x.weight, unit: x.unit, rung: x.rung }]));
const newState = () => ({ version: VERSION, exercises: defaultExercises(), meta: { last: null, lastDate: null }, weights: [], weeks: {}, history: [], baseline: { date: new Date().toISOString(), exercises: defaultExercises() }, settings: { weightGoal: 86, weeklyGymGoal: 3, restTimer: true } });
const storage = {
    async get(key) { if (window.storage?.get)
        return window.storage.get(key); const value = localStorage.getItem(key); return value ? { value } : null; },
    async set(key, value) { if (window.storage?.set)
        return window.storage.set(key, value); localStorage.setItem(key, value); }
};
function migrate(raw) {
    if (!raw)
        return newState();
    if (raw.version === VERSION)
        return { ...newState(), ...raw };
    const exercises = { ...defaultExercises(), ...(raw.exercises || raw.ex || {}) };
    return { ...newState(), ...raw, version: VERSION, exercises, baseline: raw.baseline ? { date: raw.baseline.date, exercises: raw.baseline.exercises || raw.baseline.ex || exercises } : { date: new Date().toISOString(), exercises }, history: raw.history || [] };
}
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function csvCell(v) { let s = String(v !== null && v !== void 0 ? v : ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[;"\n\r]/.test(s) ? `"${s.split('"').join('""')}"` : s; }
function nlCsv(v) { return v === null || v === undefined || v === "" ? "" : String(v).replace(".", ","); }
export default function Trainingslogboek() {
    const [data, setData] = useState(newState);
    const [loaded, setLoaded] = useState(false);
    const [tab, setTab] = useState("training");
    const [session, setSession] = useState("A");
    const [completed, setCompleted] = useState({});
    const [snapshots, setSnapshots] = useState({});
    const [status, setStatus] = useState("laden");
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [weekOffset, setWeekOffset] = useState(0);
    const [kgInput, setKgInput] = useState("");
    const [newWeightFor, setNewWeightFor] = useState(null);
    const [newWeight, setNewWeight] = useState("");
    const [timer, setTimer] = useState(null);
    const [undo, setUndo] = useState(null);
    const fileInput = useRef(null);
    useEffect(() => { (async () => { try {
        const r = await storage.get(KEY);
        const next = migrate(r?.value ? JSON.parse(r.value) : null);
        setData(next);
        setSession(next.meta.last === "A" ? "B" : "A");
    }
    catch {
        setError("Opgeslagen gegevens konden niet worden gelezen. Je kunt wel doorgaan en later een back-up importeren.");
    }
    finally {
        setLoaded(true);
        setStatus("klaar");
    } })(); }, []);
    useEffect(() => { if (!loaded)
        return; const id = setTimeout(async () => { try {
        setStatus("bewaren");
        await storage.set(KEY, JSON.stringify(data));
        setStatus("bewaard");
    }
    catch {
        setStatus("niet bewaard");
        setError("Opslaan is mislukt. Exporteer voor de zekerheid een back-up.");
    } }, 350); return () => clearTimeout(id); }, [data, loaded]);
    useEffect(() => { if (!timer)
        return; const id = setInterval(() => setTimer(t => !t || t.left <= 1 ? null : { ...t, left: t.left - 1 }), 1000); return () => clearInterval(id); }, [timer]);
    useEffect(() => { if ("serviceWorker" in navigator)
        navigator.serviceWorker.register("./sw.js").catch(() => { }); }, []);
    const patch = update => setData(d => typeof update === "function" ? update(d) : ({ ...d, ...update }));
    const current = data.exercises;
    const upNext = data.meta.last === "A" ? "B" : "A";
    const viewWeekDate = useMemo(() => { const d = mondayOf(new Date()); d.setDate(d.getDate() + weekOffset * 7); return d; }, [weekOffset]);
    const wkKey = weekKey(viewWeekDate), viewWeek = data.weeks[wkKey] || {};
    const performed = SESSIONS[session].filter(i => completed[i.id]).length;
    const weeklyAvgs = useMemo(() => { const m = {}; data.weights.forEach(w => { var _a; return ((m[_a = weekKey(new Date(`${w.d}T12:00:00`))] || (m[_a] = [])).push(w.kg)); }); return Object.keys(m).sort().map(key => ({ key, week: fmt(key), kg: m[key].reduce((a, b) => a + b, 0) / m[key].length })); }, [data.weights]);
    const weekBars = useMemo(() => Object.keys(data.weeks).sort().slice(-8).map(key => ({ week: fmt(key), sport: SLOTS.filter(s => s.gym && data.weeks[key][s.id]).length, vecht: SLOTS.filter(s => !s.gym && data.weeks[key][s.id]).length })), [data.weeks]);
    const progress = useMemo(() => allItems().filter(x => !x.fixed).map(item => { const b = data.baseline.exercises[item.id] || current[item.id]; const n = current[item.id] || b; const cycles = n.weight != null && b.weight != null && n.weight > b.weight ? 1 : 0; return { name: item.name, from: `${nl(b.weight)} ${b.unit} | ${LADDER[b.rung]}`, to: `${nl(n.weight)} ${n.unit} | ${LADDER[n.rung]}`, moments: Math.max(0, n.rung - b.rung + cycles * LADDER.length) }; }), [data.baseline, current]);
    const totalMoments = progress.reduce((a, p) => a + p.moments, 0);
    const weeksIn = Math.max(0, Math.floor((Date.now() - new Date(data.baseline.date).getTime()) / 6048e5));
    const setExercise = (id, values) => patch(d => ({ ...d, exercises: { ...d.exercises, [id]: { ...d.exercises[id], ...values } } }));
    const snapOf = (item, src) => item.fixed ? { weight: null, unit: null, target: item.fixed } : { weight: src.weight, unit: src.unit, target: LADDER[src.rung] };
    const markExercise = (item, result, snap) => {
        setCompleted(c => ({ ...c, [item.id]: result }));
        setSnapshots(p => result ? ({ ...p, [item.id]: snap || snapOf(item, current[item.id] || {}) }) : (() => { const q = { ...p }; delete q[item.id]; return q; })());
        if (result === "completed" && data.settings.restTimer && item.rest)
            setTimer({ name: item.name, left: item.rest });
    };
    const undoExercise = item => { const before = snapshots[item.id]; if (before && !item.fixed) {
        const rung = LADDER.indexOf(before.target);
        setExercise(item.id, rung >= 0 ? { rung, weight: before.weight, unit: before.unit } : { weight: before.weight, unit: before.unit });
    } markExercise(item, null); setError(""); };
    const stayOnRung = item => { if (completed[item.id])
        return; markExercise(item, "not_completed", snapOf(item, current[item.id] || {})); };
    const advance = item => { if (completed[item.id]) {
        setError("Deze oefening is al afgerond voor deze sessie.");
        return;
    } const cur = current[item.id]; if (cur.rung === LADDER.length - 1) {
        setNewWeightFor(item.id);
        setNewWeight("");
        return;
    } const done = snapOf(item, cur); setExercise(item.id, { rung: cur.rung + 1 }); markExercise(item, "completed", done); };
    const confirmNewWeight = item => { const n = parseNumber(newWeight); if (n == null || n <= Number(current[item.id].weight || 0)) {
        setError("Vul een nieuw gewicht in dat hoger is dan het huidige gewicht.");
        return;
    } const done = snapOf(item, current[item.id]); setExercise(item.id, { weight: n, rung: 0 }); setNewWeightFor(null); setError(""); markExercise(item, "completed", done); };
    const finishSession = () => {
        const missing = SESSIONS[session].filter(i => !completed[i.id]);
        if (missing.length) {
            setError(`Rond eerst alle oefeningen af. Nog te doen: ${missing.length}.`);
            return;
        }
        const before = data;
        const now = new Date();
        const slot = DAY_TO_SLOT[now.getDay()];
        const exercises = SESSIONS[session].map(item => { const snap = snapshots[item.id] || snapOf(item, current[item.id] || {}); const now2 = item.fixed ? null : current[item.id]; return ({ exerciseId: item.id, name: item.name, group: item.group, fixed: item.fixed || null, performedWeight: snap.weight, performedUnit: snap.unit, performedTarget: snap.target, result: completed[item.id], nextWeight: now2 ? now2.weight : null, nextTarget: now2 ? LADDER[now2.rung] : item.fixed }); });
        patch(d => ({ ...d, meta: { last: session, lastDate: now.toISOString() }, history: [...d.history, { id: crypto.randomUUID?.() || String(Date.now()), date: now.toISOString(), session, exercises }], weeks: { ...d.weeks, [weekKey(now)]: { ...(d.weeks[weekKey(now)] || {}), ...(slot ? { [slot]: true } : {}) } } }));
        setUndo(before);
        setCompleted({});
        setSnapshots({});
        setSession(session === "A" ? "B" : "A");
        setToast(`Sessie ${session} afgerond`);
        setError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => setToast(""), 5000);
    };
    const undoFinish = () => { if (undo) {
        setData(undo);
        setUndo(null);
        setToast("Afronding ongedaan gemaakt");
    } };
    const addWeight = () => { const n = parseNumber(kgInput); if (n == null || n < 30 || n > 250) {
        setError("Voer een lichaamsgewicht tussen 30 en 250 kg in.");
        return;
    } const d = new Date().toISOString().slice(0, 10); patch(x => ({ ...x, weights: [...x.weights.filter(w => w.d !== d), { d, kg: n }].sort((a, b) => a.d.localeCompare(b.d)) })); setKgInput(""); setError(""); };
    const exportJson = () => download(`trainingslogboek-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2), "application/json");
    const exportCsv = () => { const rows = [["datum", "tijd", "week", "sessie", "oefening", "spiergroep", "uitgevoerd gewicht", "eenheid", "uitgevoerde trede", "resultaat", "volgend gewicht", "volgende trede"]]; data.history.forEach(h => { const d = new Date(h.date); h.exercises.forEach(e => rows.push([d.toLocaleDateString("nl-NL"), d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }), fmt(weekKey(d)), h.session, e.name, e.group, nlCsv(e.performedWeight ?? e.weight), e.performedUnit ?? e.unit ?? "", e.performedTarget ?? e.target ?? "", e.result === "completed" ? "gehaald" : e.result === "not_completed" ? "niet gehaald" : String(e.result ?? ""), nlCsv(e.nextWeight), e.nextTarget ?? ""])); }); download(`trainingsanalyse-${new Date().toISOString().slice(0, 10)}.csv`, "\uFEFF" + rows.map(r => r.map(csvCell).join(";")).join("\r\n"), "text/csv;charset=utf-8"); };
    const importJson = e => { const f = e.target.files?.[0]; if (!f)
        return; const reader = new FileReader(); reader.onload = () => { try {
        const raw = JSON.parse(String(reader.result));
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
            throw new Error("geen object");
        if (!raw.exercises || typeof raw.exercises !== "object" || Array.isArray(raw.exercises))
            throw new Error("oefeningen ontbreken");
        if (raw.weights !== undefined && !Array.isArray(raw.weights))
            throw new Error("metingen kloppen niet");
        if (raw.history !== undefined && !Array.isArray(raw.history))
            throw new Error("historie klopt niet");
        if (raw.weeks !== undefined && (typeof raw.weeks !== "object" || Array.isArray(raw.weeks)))
            throw new Error("weken kloppen niet");
        if (typeof raw.version === "number" && raw.version > VERSION)
            throw new Error("deze back-up komt van een nieuwere versie van de app");
        const heeftGegevens = (data.history?.length || 0) + (data.weights?.length || 0) > 0;
        if (heeftGegevens && !window.confirm(`Deze back-up bevat ${(raw.history || []).length} sessies en ${(raw.weights || []).length} wegingen. Alles wat nu in de app staat wordt overschreven. Doorgaan?`))
            return;
        setData(migrate(raw));
        setToast("Back-up teruggezet");
        setError("");
    }
    catch (err) {
        setError(`Deze back-up kon niet worden teruggezet: ${err.message || "onleesbaar bestand"}.`);
    } }; reader.readAsText(f); e.target.value = ""; };
    const summary = `Trainingsoverzicht - ${fmtFull(new Date().toISOString())}\nGestart: ${fmt(data.baseline.date)} (${weeksIn} weken geleden)\nUitgevoerde sessies: ${data.history.length}\nProgressiemomenten: ${totalMoments}\nLaatste weekgemiddelde: ${weeklyAvgs.length ? `${nl(weeklyAvgs.at(-1).kg)} kg` : "nog geen metingen"}`;
    const copySummary = async () => { await navigator.clipboard.writeText(summary); setToast("Samenvatting gekopieerd"); };
    const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const ui = {
        panel: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 12 },
        label: { display: "block", fontSize: 11, color: C.muted, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 5 },
        input: { boxSizing: "border-box", width: "100%", minHeight: 44, background: C.cardHi, border: `1px solid ${C.line}`, borderRadius: 7, color: C.bone, font: `600 16px ${font}`, padding: "10px 11px" },
        primary: { minHeight: 46, background: C.ochre, color: C.ink, border: 0, borderRadius: 8, padding: "0 16px", font: `500 14px ${font}`, cursor: "pointer" },
        secondary: { minHeight: 46, background: "transparent", color: C.bone, border: `1px solid ${C.line}`, borderRadius: 8, padding: "0 14px", font: `700 13px ${font}`, cursor: "pointer" }
    };
    if (!loaded)
        return React.createElement("div", { style: { background: C.ink, color: C.bone, minHeight: "100vh", padding: 24, fontFamily: font } }, "Trainingslogboek laden...");
    return React.createElement("div", { style: { background: C.ink, color: C.bone, fontFamily: font, minHeight: "100vh", padding: "16px 12px 92px" } },
        React.createElement("style", null, `*{box-sizing:border-box}button,input,select,textarea{font:inherit}.tap{touch-action:manipulation}.tap:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid ${C.ochre};outline-offset:2px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}`),
        React.createElement("main", { style: { maxWidth: 540, margin: "0 auto" } },
            React.createElement("header", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 } },
                React.createElement("h1", { style: { fontSize: 20, margin: 0 } }, "Trainingslogboek"),
                React.createElement("span", { "aria-live": "polite", style: { fontSize: 11, color: status === "niet bewaard" ? C.red : C.muted, textTransform: "uppercase" } }, status)),
            error && React.createElement("div", { role: "alert", style: { ...ui.panel, borderColor: C.red, color: C.bone } },
                React.createElement("strong", null, "Let op"),
                React.createElement("div", { style: { marginTop: 4, fontSize: 13 } }, error),
                React.createElement("button", { className: "tap", onClick: () => setError(""), style: { ...ui.secondary, minHeight: 40, marginTop: 10 } }, "Sluiten")),
            timer && React.createElement("div", { role: "timer", style: { ...ui.panel, position: "sticky", top: 8, zIndex: 5, borderColor: C.ochre } },
                React.createElement("div", { style: ui.label },
                    "Rusttimer | ",
                    timer.name),
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    React.createElement("strong", { style: { fontSize: 28, color: C.ochre } },
                        Math.floor(timer.left / 60),
                        ":",
                        String(timer.left % 60).padStart(2, "0")),
                    React.createElement("button", { className: "tap", onClick: () => setTimer(null), style: ui.secondary }, "Stop"))),
            tab === "training" && React.createElement(React.Fragment, null,
                React.createElement("section", { style: { ...ui.panel, borderColor: C.ochreDim } },
                    React.createElement("div", { style: ui.label }, "Nu aan de beurt"),
                    React.createElement("div", { style: { fontSize: 23, fontWeight: 800, color: C.ochre } },
                        "Sessie ",
                        upNext),
                    React.createElement("div", { style: { color: C.muted, fontSize: 12, marginTop: 4 } }, data.meta.last ? `Laatst afgerond: sessie ${data.meta.last} op ${fmt(data.meta.lastDate)}` : "Nog geen sessie afgerond. Begin bij A.")),
                React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12 } }, ["A", "B"].map(k => React.createElement("button", { key: k, className: "tap", onClick: () => { setSession(k); setCompleted({}); setSnapshots({}); }, style: { ...ui.secondary, flex: 1, borderColor: session === k ? C.ochre : C.line, background: session === k ? C.ochre : "transparent", color: session === k ? C.ink : C.bone } },
                    "Sessie ",
                    k))),
                React.createElement("div", { style: { ...ui.panel, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    React.createElement("span", null,
                        performed,
                        " van ",
                        SESSIONS[session].length,
                        " oefeningen afgerond"),
                    React.createElement("strong", { style: { color: C.ochre } },
                        Math.round(performed / SESSIONS[session].length * 100),
                        "%")),
                SESSIONS[session].map(item => {
                    const st = current[item.id];
                    const done = completed[item.id];
                    return React.createElement("article", { key: item.id, style: { ...ui.panel, padding: 0, overflow: "hidden", borderColor: C.line, opacity: done ? .55 : 1 } },
                        React.createElement("div", { style: { padding: "13px 13px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 } },
                            React.createElement("strong", { style: { fontSize: 15, color: C.bone } }, item.name),
                            React.createElement("span", { style: { fontSize: 11, color: C.muted, textAlign: "right" } }, done ? "afgerond" : item.group)),
                        React.createElement("div", { style: { padding: 13 } }, item.fixed ? React.createElement(React.Fragment, null,
                            React.createElement("div", { style: { fontSize: 22, fontWeight: 800 } }, item.fixed),
                            React.createElement("div", { style: { color: C.muted, fontSize: 12, margin: "7px 0 12px" } }, item.cue),
                            React.createElement("button", { className: "tap", onClick: () => done ? undoExercise(item) : markExercise(item, "completed"), style: done ? { ...ui.secondary, width: "100%", color: C.muted } : { ...ui.primary, width: "100%" } }, done ? "Afgerond \u2014 tik om te wijzigen" : "Markeer als afgerond")) : React.createElement(React.Fragment, null,
                            React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" } },
                                React.createElement("strong", { style: { fontSize: 26, letterSpacing: "-0.02em" } }, LADDER[st.rung]),
                                React.createElement("span", { style: { color: C.line } }, "|"),
                                React.createElement("label", { htmlFor: `weight-${item.id}`, style: { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } }, `Gewicht voor ${item.name}`),
                                React.createElement("input", { id: `weight-${item.id}`, inputMode: "decimal", value: st.weight ?? "", placeholder: "\u2014", onChange: e => setExercise(item.id, { weight: e.target.value }), onBlur: () => setExercise(item.id, { weight: parseNumber(st.weight) }), style: { ...ui.input, width: 76, minHeight: 44, padding: "6px 8px", fontSize: 17, background: "transparent", borderColor: C.line } }),
                                React.createElement("select", { "aria-label": `Eenheid voor ${item.name}`, value: st.unit, onChange: e => setExercise(item.id, { unit: e.target.value }), style: { ...ui.input, width: "auto", minHeight: 44, padding: "0 6px", fontSize: 14, background: "transparent", border: 0, color: C.muted } },
                                    React.createElement("option", { value: "kg" }, "kg"),
                                    React.createElement("option", { value: "kg per kant" }, "kg/kant"),
                                    React.createElement("option", { value: "machine" }, "machine"))),
                            React.createElement("div", { style: { display: "flex", gap: 4, margin: "0 0 -4px" } }, LADDER.map((x, i) => React.createElement("button", { key: x, className: "tap", title: `Zet op ${x}`, "aria-label": `Zet ${item.name} op ${x}`, "aria-pressed": i === st.rung, onClick: () => setExercise(item.id, { rung: i }), style: { flex: 1, minHeight: 44, height: 44, padding: 0, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center" } }, React.createElement("span", { style: { width: "100%", height: 3, borderRadius: 2, background: i === st.rung ? C.ochre : i < st.rung ? C.ochreDim : C.line } })))),
                            React.createElement("div", { style: { color: C.muted, fontSize: 11.5, lineHeight: 1.5, marginBottom: 12 } },
                                `${LADDER[st.rung]} \u00b7 trede ${st.rung + 1} van ${LADDER.length} \u00b7 rust ${item.rest} sec`,
                                item.cue && ` \u00b7 ${item.cue.toLowerCase()}`),
                            newWeightFor === item.id ? React.createElement("div", { style: { background: C.cardHi, padding: 11, borderRadius: 8 } },
                                React.createElement("label", { htmlFor: `new-${item.id}`, style: ui.label },
                                    "Nieuw gewicht in ",
                                    st.unit),
                                React.createElement("input", { id: `new-${item.id}`, autoFocus: true, inputMode: "decimal", value: newWeight, onChange: e => setNewWeight(e.target.value), style: ui.input }),
                                React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
                                    React.createElement("button", { className: "tap", onClick: () => confirmNewWeight(item), style: { ...ui.primary, flex: 1 } }, "Start op 3x8"),
                                    React.createElement("button", { className: "tap", onClick: () => setNewWeightFor(null), style: ui.secondary }, "Annuleren"))) : done ? React.createElement("button", { className: "tap", onClick: () => undoExercise(item), style: { ...ui.secondary, width: "100%", color: C.muted } }, done === "completed" ? "Gehaald \u2014 tik om te wijzigen" : "Blijft staan \u2014 tik om te wijzigen") : React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 } },
                                React.createElement("button", { className: "tap", onClick: () => advance(item), style: { ...ui.primary } }, "Gehaald"),
                                React.createElement("button", { className: "tap", onClick: () => stayOnRung(item), style: { ...ui.secondary, minHeight: 46 } }, "Nog niet")))));
                }),
                React.createElement("button", { className: "tap", onClick: finishSession, style: { ...ui.primary, width: "100%", minHeight: 54 } },
                    "Sessie ",
                    session,
                    " afronden")),
            tab === "week" && React.createElement("section", { style: ui.panel },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } },
                    React.createElement("button", { className: "tap", "aria-label": "Vorige week", onClick: () => setWeekOffset(x => x - 1), style: ui.secondary }, "\u2190"),
                    React.createElement("div", { style: { textAlign: "center" } },
                        React.createElement("span", { style: ui.label }, weekOffset === 0 ? "Deze week" : "Week"),
                        React.createElement("strong", null,
                            "vanaf ",
                            fmt(wkKey))),
                    React.createElement("button", { className: "tap", "aria-label": "Volgende week", disabled: weekOffset >= 0, onClick: () => setWeekOffset(x => Math.min(0, x + 1)), style: ui.secondary }, "\u2192")),
                SLOTS.map(s => { const on = !!viewWeek[s.id]; return React.createElement("button", { key: s.id, className: "tap", "aria-pressed": on, onClick: () => patch(d => ({ ...d, weeks: { ...d.weeks, [wkKey]: { ...(d.weeks[wkKey] || {}), [s.id]: !on } } })), style: { ...ui.secondary, width: "100%", display: "flex", alignItems: "center", gap: 12, marginBottom: 8, background: on ? C.cardHi : "transparent", borderColor: on ? C.ochre : C.line } },
                    React.createElement("span", { style: { width: 24, color: on ? C.ochre : C.muted } }, on ? "✓" : "○"),
                    React.createElement("strong", { style: { width: 25 } }, s.label),
                    React.createElement("span", { style: { flex: 1, textAlign: "left" } },
                        s.name,
                        s.optional ? " (inhaaloptie)" : "")); }),
                React.createElement("p", { style: { color: C.muted, fontSize: 12 } },
                    "Sportschool: ",
                    SLOTS.filter(s => s.gym && viewWeek[s.id]).length,
                    " van ",
                    data.settings.weeklyGymGoal,
                    ".")),
            tab === "gewicht" && React.createElement(React.Fragment, null,
                React.createElement("section", { style: ui.panel },
                    React.createElement("h2", { style: { fontSize: 15, color: C.ochre } }, "Weging toevoegen"),
                    React.createElement("label", { htmlFor: "bodyweight", style: ui.label }, "Lichaamsgewicht in kg"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8 } },
                        React.createElement("input", { id: "bodyweight", inputMode: "decimal", value: kgInput, onChange: e => setKgInput(e.target.value), onKeyDown: e => e.key === "Enter" && addWeight(), placeholder: "88,5", style: ui.input }),
                        React.createElement("button", { className: "tap", onClick: addWeight, style: ui.primary }, "Bewaren"))),
                weeklyAvgs.length ? React.createElement("section", { style: ui.panel },
                    React.createElement("h2", { style: { fontSize: 15, color: C.ochre } }, "Weekgemiddelden"),
                    React.createElement("p", { style: { color: C.muted, fontSize: 12 } },
                        "Laatste gemiddelde: ",
                        React.createElement("strong", { style: { color: C.bone } },
                            nl(weeklyAvgs.at(-1).kg),
                            " kg"),
                        "."),
                    weeklyAvgs.map(w => React.createElement("div", { key: w.key, style: { display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.line}` } },
                        React.createElement("span", null,
                            "week van ",
                            w.week),
                        React.createElement("strong", null,
                            nl(w.kg),
                            " kg")))) : React.createElement("section", { style: ui.panel }, "Nog geen gewichtstrend. Voeg minimaal twee metingen toe om het verloop te zien."),
                data.weights.length > 1 && React.createElement("section", { style: ui.panel },
                    React.createElement("h2", { style: { fontSize: 15, color: C.ochre } }, "Verloop"),
                    React.createElement(ResponsiveContainer, { width: "100%", height: 220 },
                        React.createElement(LineChart, { data: data.weights.map(w => ({ d: fmt(w.d), kg: w.kg })) },
                            React.createElement(CartesianGrid, { stroke: C.line, vertical: false }),
                            React.createElement(XAxis, { dataKey: "d", stroke: C.muted }),
                            React.createElement(YAxis, { stroke: C.muted, domain: ["dataMin - 1.5", "dataMax + 1"] }),
                            React.createElement(Tooltip, null),
                            React.createElement(ReferenceLine, { y: data.settings.weightGoal, stroke: C.green }),
                            React.createElement(Line, { type: "monotone", dataKey: "kg", stroke: C.ochre, strokeWidth: 3 }))))),
            tab === "analyse" && React.createElement(React.Fragment, null,
                React.createElement("section", { style: ui.panel },
                    React.createElement("span", { style: ui.label }, "Sinds de start"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, textAlign: "center" } },
                        React.createElement("div", null,
                            React.createElement("strong", { style: { fontSize: 25 } }, weeksIn),
                            React.createElement("small", { style: { display: "block", color: C.muted } }, "weken")),
                        React.createElement("div", null,
                            React.createElement("strong", { style: { fontSize: 25, color: C.ochre } }, totalMoments),
                            React.createElement("small", { style: { display: "block", color: C.muted } }, "progressie")),
                        React.createElement("div", null,
                            React.createElement("strong", { style: { fontSize: 25 } }, data.history.length),
                            React.createElement("small", { style: { display: "block", color: C.muted } }, "sessies")))),
                weekBars.length ? React.createElement("section", { style: ui.panel },
                    React.createElement("h2", { style: { fontSize: 15, color: C.ochre } }, "Trainingen per week"),
                    React.createElement(ResponsiveContainer, { width: "100%", height: 200 },
                        React.createElement(BarChart, { data: weekBars },
                            React.createElement(CartesianGrid, { stroke: C.line, vertical: false }),
                            React.createElement(XAxis, { dataKey: "week", stroke: C.muted }),
                            React.createElement(YAxis, { stroke: C.muted, allowDecimals: false }),
                            React.createElement(Tooltip, null),
                            React.createElement(ReferenceLine, { y: data.settings.weeklyGymGoal, stroke: C.green }),
                            React.createElement(Bar, { dataKey: "sport", name: "Sportschool", fill: C.ochre, stackId: "a" }),
                            React.createElement(Bar, { dataKey: "vecht", name: "Vechtsport", fill: C.ochreDim, stackId: "a" })))) : React.createElement("section", { style: ui.panel }, "Rond je eerste trainingsweek af om hier een weekgrafiek te zien."),
                React.createElement("section", { style: ui.panel },
                    React.createElement("h2", { style: { fontSize: 15, color: C.ochre } }, "Progressie per oefening"),
                    progress.map(p => React.createElement("div", { key: p.name, style: { padding: "9px 0", borderBottom: `1px solid ${C.line}` } },
                        React.createElement("strong", null, p.name),
                        React.createElement("div", { style: { color: C.muted, fontSize: 12, marginTop: 3 } },
                            p.from,
                            " ",
                            React.createElement("span", { style: { color: C.ochre } }, "\u2192"),
                            " ",
                            p.to)))),
                React.createElement("section", { style: ui.panel },
                    React.createElement("h2", { style: { fontSize: 15, color: C.ochre } }, "Doelen en voorkeuren"),
                    React.createElement("label", { htmlFor: "goal-weight", style: ui.label }, "Gewichtsdoel"),
                    React.createElement("input", { id: "goal-weight", inputMode: "decimal", value: data.settings.weightGoal, onChange: e => patch(d => ({ ...d, settings: { ...d.settings, weightGoal: parseNumber(e.target.value) ?? "" } })), style: ui.input }),
                    React.createElement("label", { htmlFor: "goal-gym", style: { ...ui.label, marginTop: 12 } }, "Sportschoolsessies per week"),
                    React.createElement("input", { id: "goal-gym", type: "number", min: "1", max: "7", value: data.settings.weeklyGymGoal, onChange: e => patch(d => ({ ...d, settings: { ...d.settings, weeklyGymGoal: Number(e.target.value) } })), style: ui.input }),
                    React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 10, minHeight: 48, marginTop: 8 } },
                        React.createElement("input", { type: "checkbox", checked: data.settings.restTimer, onChange: e => patch(d => ({ ...d, settings: { ...d.settings, restTimer: e.target.checked } })) }),
                        " Rusttimer automatisch starten")),
                React.createElement("section", { style: ui.panel },
                    React.createElement("h2", { style: { fontSize: 15, color: C.ochre } }, "Gegevens beheren"),
                    React.createElement("p", { style: { color: C.muted, fontSize: 12, lineHeight: 1.5 } }, "Een analysebestand bevat trainingsdagen, oefeningen en lichaamsgewicht. Een JSON-bestand is een volledige herstelbare back-up."),
                    React.createElement("div", { style: { display: "grid", gap: 8 } },
                        React.createElement("button", { className: "tap", onClick: copySummary, style: ui.secondary }, "Samenvatting kopieren"),
                        React.createElement("button", { className: "tap", onClick: exportCsv, disabled: !data.history.length, style: { ...ui.primary, opacity: data.history.length ? 1 : .5 } }, "Analysebestand exporteren (.csv)"),
                        React.createElement("button", { className: "tap", onClick: exportJson, style: ui.secondary }, "Volledige back-up maken (.json)"),
                        React.createElement("button", { className: "tap", onClick: () => fileInput.current?.click(), style: ui.secondary }, "Back-up terugzetten"),
                        React.createElement("input", { ref: fileInput, hidden: true, type: "file", accept: "application/json,.json", onChange: importJson })),
                    React.createElement("textarea", { readOnly: true, value: summary, "aria-label": "Voorvertoning van de samenvatting", style: { ...ui.input, height: 130, marginTop: 10, fontFamily: "monospace", fontSize: 12 } })))),
        toast && React.createElement("div", { role: "status", style: { position: "fixed", left: 12, right: 12, bottom: 78, maxWidth: 516, margin: "auto", background: C.bone, color: C.ink, borderRadius: 9, padding: 13, zIndex: 20, display: "flex", justifyContent: "space-between", alignItems: "center" } },
            React.createElement("span", null, toast),
            undo && React.createElement("button", { className: "tap", onClick: undoFinish, style: { border: 0, background: "none", color: C.ochreDim, fontWeight: 800, minHeight: 44 } }, "Ongedaan maken")),
        React.createElement("nav", { "aria-label": "Hoofdnavigatie", style: { position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10, background: C.card, borderTop: `1px solid ${C.line}`, padding: "7px max(8px, env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom))" } },
            React.createElement("div", { style: { maxWidth: 540, margin: "auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 } }, [["training", "Training"], ["week", "Week"], ["gewicht", "Gewicht"], ["analyse", "Analyse"]].map(([k, l]) => React.createElement("button", { key: k, className: "tap", "aria-current": tab === k ? "page" : undefined, onClick: () => setTab(k), style: { minHeight: 48, border: 0, borderRadius: 7, background: tab === k ? C.ochre : "transparent", color: tab === k ? C.ink : C.muted, fontWeight: 750 } }, l)))));
}
