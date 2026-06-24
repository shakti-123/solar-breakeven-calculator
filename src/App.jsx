import { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (val) => {
  if (val === null || val === undefined) return "₹0";
  const abs = Math.abs(val);
  const sign = val < 0 ? "−" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(2)} L`;
  if (abs >= 1_000)      return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
  return `${sign}₹${Math.round(abs)}`;
};
const fmtK = (v) => {
  const abs = Math.abs(v);
  if (abs >= 10_000_000) return `${v < 0 ? "−" : ""}${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${v < 0 ? "−" : ""}${(abs / 100_000).toFixed(0)}L`;
  return `${v < 0 ? "−" : ""}${(abs / 1_000).toFixed(0)}K`;
};

const calcEMI = (P, annualRate, tenureMonths) => {
  if (P <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return P / tenureMonths;
  return (P * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min, max, step = 1, unit, hint, color = "#f59e0b" }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</span>
        <span className="text-sm font-bold text-white">
          {typeof value === "number" && value >= 1000 && unit === "₹"
            ? fmt(value)
            : value}
          {unit !== "₹" && <span className="text-xs text-slate-400 ml-1">{unit}</span>}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #1e293b ${pct}%, #1e293b 100%)`,
          }}
        />
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1 italic">{hint}</p>}
    </div>
  );
}

function NumInput({ label, value, onChange, unit, min = 0, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold tracking-wide text-slate-400 uppercase mb-1">{label}</label>
      <div className="relative flex items-center">
        {unit === "₹" && <span className="absolute left-3 text-amber-400 font-bold text-sm">₹</span>}
        <input
          type="number"
          value={value}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
          style={{ paddingLeft: unit === "₹" ? "1.75rem" : "0.75rem", paddingRight: unit !== "₹" ? "2.5rem" : "0.75rem" }}
        />
        {unit !== "₹" && (
          <span className="absolute right-3 text-xs text-amber-400 font-semibold">{unit}</span>
        )}
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1 italic">{hint}</p>}
    </div>
  );
}

function KpiCard({ label, value, sub, accent = "amber", icon }) {
  const accents = {
    amber:  { border: "border-amber-500/20",  bg: "from-amber-500/10",  text: "text-amber-400" },
    green:  { border: "border-emerald-500/20", bg: "from-emerald-500/10", text: "text-emerald-400" },
    blue:   { border: "border-sky-500/20",    bg: "from-sky-500/10",    text: "text-sky-400" },
    red:    { border: "border-rose-500/20",   bg: "from-rose-500/10",   text: "text-rose-400" },
    violet: { border: "border-violet-500/20", bg: "from-violet-500/10", text: "text-violet-400" },
    teal:   { border: "border-teal-500/20",   bg: "from-teal-500/10",   text: "text-teal-400" },
  };
  const a = accents[accent];
  return (
    <div className={`rounded-2xl border ${a.border} bg-gradient-to-br ${a.bg} to-transparent p-4`}>
      {icon && <div className="text-xl mb-1">{icon}</div>}
      <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1">{label}</div>
      <div className={`text-lg font-bold leading-tight ${a.text}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-amber-400 font-bold mb-2">Year {label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SolarCalculator() {
  // Plant
  const [capacity, setCapacity]   = useState(100);    // kW
  const [costPerKw, setCostPerKw] = useState(60000);  // ₹/kW
  const [useManual, setUseManual] = useState(false);
  const [manualCost, setManualCost] = useState(6000000);
  const [sunHours, setSunHours]   = useState(5);      // hrs/day
  const [perfRatio, setPerfRatio] = useState(80);     // %
  const [ratePerUnit, setRatePerUnit] = useState(7);  // ₹/kWh
  const [degrad, setDegrad]       = useState(0.5);    // %/yr
  const [maintPct, setMaintPct]   = useState(1);      // %/yr of cost

  // Finance
  const [ownInvestment, setOwnInvestment] = useState(1500000);
  const [interestRate, setInterestRate]   = useState(9);   // % p.a.
  const [tenure, setTenure]               = useState(10);  // years

  const [activeTab, setActiveTab] = useState("plant");

  const c = useMemo(() => {
    const totalCost   = useManual ? manualCost : capacity * costPerKw;
    const equity      = Math.min(ownInvestment, totalCost);
    const loan        = Math.max(0, totalCost - equity);
    const months      = tenure * 12;
    const emi         = Math.round(calcEMI(loan, interestRate, months));
    const totalEmiPaid = emi * months;
    const totalInterest = Math.max(0, totalEmiPaid - loan);

    const monthlyUnits  = capacity * sunHours * 30 * (perfRatio / 100);
    const monthlyIncome = monthlyUnits * ratePerUnit;
    const monthlyMaint  = (totalCost * maintPct) / 100 / 12;
    const netCashFlow   = monthlyIncome - emi - monthlyMaint;

    // Build 25-year chart data (every 6 months)
    const chartData = [];
    let cumIncome = 0;
    let cumCost   = totalCost;
    let breakMonth = null;

    for (let m = 0; m <= 300; m++) {
      if (m > 0) {
        const yr = Math.floor((m - 1) / 12);
        const df = Math.pow(1 - degrad / 100, yr);
        cumIncome += monthlyIncome * df;
        cumCost   += monthlyMaint;
        if (cumIncome - cumCost >= 0 && breakMonth === null) breakMonth = m;
      }
      if (m % 6 === 0) {
        chartData.push({
          year: (m / 12).toFixed(m === 0 ? 0 : 1),
          income: Math.round(cumIncome),
          cost:   Math.round(cumCost),
          net:    Math.round(cumIncome - cumCost),
        });
      }
    }

    const last   = chartData[chartData.length - 1];
    const roi25  = totalCost > 0 ? (((last.income - last.cost) / totalCost) * 100).toFixed(1) : 0;
    const equityPct = totalCost > 0 ? ((equity / totalCost) * 100).toFixed(1) : 0;

    // Year-by-year table rows
    const tableRows = Array.from({ length: 25 }, (_, i) => {
      const yr = i + 1;
      const df = Math.pow(1 - degrad / 100, i);
      const annIncome = monthlyIncome * df * 12;
      const annEmi    = yr <= tenure ? emi * 12 : 0;
      const annMaint  = monthlyMaint * 12;
      const netAnn    = annIncome - annEmi - annMaint;

      let cumInc = 0;
      for (let y = 0; y < yr; y++) {
        cumInc += monthlyIncome * Math.pow(1 - degrad / 100, y) * 12;
      }
      const cumCostTot = totalCost + monthlyMaint * 12 * yr;
      const cumNet     = cumInc - cumCostTot;
      return { yr, annIncome, annEmi, annMaint, netAnn, cumNet };
    });

    return {
      totalCost, equity, loan, emi, months, totalInterest,
      monthlyUnits: Math.round(monthlyUnits),
      monthlyIncome: Math.round(monthlyIncome),
      monthlyMaint: Math.round(monthlyMaint),
      netCashFlow: Math.round(netCashFlow),
      breakMonth,
      breakYears: breakMonth ? (breakMonth / 12).toFixed(1) : null,
      chartData, roi25, equityPct, tableRows,
      annualIncome: Math.round(monthlyIncome * 12),
      annualUnits: Math.round(monthlyUnits * 12),
    };
  }, [capacity, costPerKw, useManual, manualCost, sunHours, perfRatio,
      ratePerUnit, degrad, maintPct, ownInvestment, interestRate, tenure]);

  const tabs = [
    { id: "plant",   label: "Plant",   icon: "⚡" },
    { id: "revenue", label: "Revenue", icon: "💰" },
    { id: "finance", label: "Finance", icon: "🏦" },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "#060b18", color: "#e2e8f0" }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #0d1a2e 0%, #0f2040 50%, #131e30 100%)", borderBottom: "1px solid #1e3a5f", padding: "1.5rem 1rem 1rem" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%, #fcd34d, #f59e0b, #b45309)", boxShadow: "0 0 24px #f59e0b66", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>☀️</div>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#fef3c7" }}>Solar Break-Even Calculator</h1>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" }}>Plant sizing · EMI · Payback · 25-year ROI</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "1rem" }}>

        {/* ── KPI Strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem", marginBottom: "1rem" }}>
          {[
            { label: "Total Capex",     value: fmt(c.totalCost),       accent: "#f59e0b" },
            { label: "Loan Amount",     value: fmt(c.loan),            accent: "#38bdf8" },
            { label: "Monthly EMI",     value: fmt(c.emi),             accent: "#818cf8" },
            { label: "Monthly Income",  value: fmt(c.monthlyIncome),   accent: "#34d399" },
            { label: "Net Cash Flow",   value: fmt(c.netCashFlow),     accent: c.netCashFlow >= 0 ? "#34d399" : "#f87171" },
            { label: "Break-Even",      value: c.breakYears ? `${c.breakYears} Yrs` : ">25 Yrs", accent: "#fcd34d" },
          ].map((k) => (
            <div key={k.label} style={{ background: "#0d1929", border: "1px solid #1e2d42", borderRadius: 14, padding: "0.6rem 0.75rem" }}>
              <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: k.accent, lineHeight: 1.2 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: "1rem", alignItems: "start" }}>

          {/* ── Left Panel: Inputs ── */}
          <div>
            {/* Tab bar */}
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    flex: 1, border: "none", borderRadius: 10, padding: "0.5rem 0.25rem",
                    fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                    background: activeTab === t.id ? "#f59e0b" : "#0d1929",
                    color: activeTab === t.id ? "#0a0f1e" : "#64748b",
                    transition: "all 0.15s",
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div style={{ background: "#0d1929", border: "1px solid #1e2d42", borderRadius: 18, padding: "1.1rem" }}>

              {/* Plant Tab */}
              {activeTab === "plant" && (
                <>
                  <Slider label="Plant Capacity" value={capacity} onChange={setCapacity} min={1} max={1000} step={5} unit="kW" hint="Total installed solar capacity" />
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Setup Cost Mode</span>
                      <button onClick={() => setUseManual(!useManual)} style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem", borderRadius: 8, border: "none", cursor: "pointer", background: useManual ? "#f59e0b" : "#1e2d42", color: useManual ? "#0a0f1e" : "#94a3b8", fontWeight: 700 }}>
                        {useManual ? "Manual ₹" : "Auto (₹/kW)"}
                      </button>
                    </div>
                    {!useManual
                      ? <><Slider label="Cost per kW" value={costPerKw} onChange={setCostPerKw} min={20000} max={150000} step={5000} unit="₹" hint={`Total: ${fmt(capacity * costPerKw)}`} />
                      </>
                      : <NumInput label="Total Setup Cost" value={manualCost} onChange={setManualCost} unit="₹" hint="Enter full project cost" />
                    }
                  </div>
                  <Slider label="Daily Sun Hours" value={sunHours} onChange={setSunHours} min={3} max={9} step={0.5} unit="hrs" hint="Avg peak sun hours (India: 4.5–6)" />
                  <Slider label="System Performance Ratio" value={perfRatio} onChange={setPerfRatio} min={60} max={95} unit="%" hint="Typical 75–85% after losses" />
                  <Slider label="Annual Degradation" value={degrad} onChange={setDegrad} min={0} max={2} step={0.1} unit="%" hint="Panels lose ~0.5% efficiency/year" color="#818cf8" />
                  <Slider label="Annual Maintenance" value={maintPct} onChange={setMaintPct} min={0.5} max={5} step={0.1} unit="% of cost" hint="Usually 1–2% of capex/year" color="#f87171" />
                </>
              )}

              {/* Revenue Tab */}
              {activeTab === "revenue" && (
                <>
                  <div style={{ background: "#0a1525", border: "1px solid #1e3a5f", borderRadius: 12, padding: "0.9rem", marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Generation Preview</div>
                    {[
                      ["Monthly Units", `${c.monthlyUnits.toLocaleString("en-IN")} kWh`],
                      ["Annual Units", `${c.annualUnits.toLocaleString("en-IN")} kWh`],
                      ["Annual Income", fmt(c.annualIncome)],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{k}</span>
                        <span style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <NumInput label="Rate per Unit (₹/kWh)" value={ratePerUnit} onChange={setRatePerUnit} unit="₹" min={1} hint="DISCOM / commercial tariff rate" />
                  <div style={{ background: "#0a1525", border: "1px solid #1e3a5f", borderRadius: 12, padding: "0.9rem", marginTop: "0.75rem" }}>
                    <p style={{ fontSize: "0.72rem", color: "#475569", margin: 0, lineHeight: 1.6 }}>
                      💡 <strong style={{ color: "#94a3b8" }}>Tip:</strong> Commercial tariffs in India range ₹5.50–₹9/kWh. Net metering adds value for grid-tied systems. Solar RPO compliance may improve effective rate.
                    </p>
                  </div>
                </>
              )}

              {/* Finance Tab */}
              {activeTab === "finance" && (
                <>
                  <div style={{ background: "#0a1525", border: "1px solid #1e3a5f", borderRadius: 12, padding: "0.9rem", marginBottom: "1rem" }}>
                    {[
                      ["Total Project Cost", fmt(c.totalCost), "#f59e0b"],
                      ["Your Investment",    fmt(c.equity),    "#34d399"],
                      ["Loan Required",      fmt(c.loan),      "#38bdf8"],
                      ["Equity Share",       `${c.equityPct}%`, "#818cf8"],
                    ].map(([k, v, col]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid #1e2d42" }}>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{k}</span>
                        <span style={{ fontSize: "0.8rem", color: col, fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <NumInput label="Your Investment (Down Payment)" value={ownInvestment} onChange={setOwnInvestment} unit="₹" hint="Amount you're investing from own funds" />
                  <Slider label="Annual Interest Rate" value={interestRate} onChange={setInterestRate} min={5} max={20} step={0.25} unit="% p.a." hint="Bank / NBFC solar loan rate" color="#818cf8" />
                  <Slider label="Loan Tenure" value={tenure} onChange={setTenure} min={1} max={20} unit="years" hint="Repayment period" color="#38bdf8" />

                  <div style={{ background: "#0a1525", border: "1px solid #1e3a5f", borderRadius: 12, padding: "0.9rem", marginTop: "0.5rem" }}>
                    <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Loan Summary</div>
                    {[
                      ["Monthly EMI",        fmt(c.emi)],
                      ["Total EMI Paid",      fmt(c.emi * c.months)],
                      ["Total Interest",      fmt(c.totalInterest)],
                      ["Cost of Credit",      `${c.loan > 0 ? ((c.totalInterest / c.loan) * 100).toFixed(1) : 0}%`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{k}</span>
                        <span style={{ fontSize: "0.8rem", color: "#e2e8f0", fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Right Panel: Results ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

            {/* Monthly Flow Card */}
            <div style={{ background: "#0d1929", border: "1px solid #1e2d42", borderRadius: 18, padding: "1.1rem" }}>
              <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Monthly Cash Flow Breakdown</div>
              {[
                { label: "⚡ Power Generated",   value: `${c.monthlyUnits.toLocaleString("en-IN")} kWh`, color: "#fcd34d", bar: 1 },
                { label: "💰 Income (Gross)",     value: fmt(c.monthlyIncome),  color: "#34d399", bar: 1 },
                { label: "🏦 Loan EMI",           value: `− ${fmt(c.emi)}`,     color: "#f87171", bar: c.monthlyIncome > 0 ? c.emi / c.monthlyIncome : 0 },
                { label: "🔧 Maintenance",        value: `− ${fmt(c.monthlyMaint)}`, color: "#f87171", bar: c.monthlyIncome > 0 ? c.monthlyMaint / c.monthlyIncome : 0 },
              ].map((row) => (
                <div key={row.label} style={{ marginBottom: "0.7rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{row.label}</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: row.color }}>{row.value}</span>
                  </div>
                  {row.bar < 1 && (
                    <div style={{ height: 4, borderRadius: 99, background: "#1e2d42" }}>
                      <div style={{ height: "100%", width: `${Math.min(row.bar * 100, 100)}%`, borderRadius: 99, background: row.color, opacity: 0.6 }} />
                    </div>
                  )}
                </div>
              ))}
              <div style={{ marginTop: "0.5rem", padding: "0.75rem", borderRadius: 12, background: c.netCashFlow >= 0 ? "#052e16" : "#2d0e0e", border: `1px solid ${c.netCashFlow >= 0 ? "#166534" : "#991b1b"}` }}>
                <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>Net Monthly (Income − EMI − Maintenance)</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: c.netCashFlow >= 0 ? "#34d399" : "#f87171", marginTop: 2 }}>{fmt(c.netCashFlow)}</div>
              </div>
            </div>

            {/* Break-even + ROI */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div style={{ background: "#0d1929", border: "1px solid #1e2d42", borderRadius: 14, padding: "0.9rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Break-Even</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#fcd34d", lineHeight: 1 }}>
                  {c.breakYears ?? ">25"}
                </div>
                <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Years</div>
                {c.breakMonth && <div style={{ fontSize: "0.65rem", color: "#475569", marginTop: 2 }}>Month {c.breakMonth}</div>}
              </div>
              <div style={{ background: "#0d1929", border: "1px solid #1e2d42", borderRadius: 14, padding: "0.9rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>25-Year ROI</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: parseFloat(c.roi25) >= 0 ? "#34d399" : "#f87171", lineHeight: 1 }}>{c.roi25}%</div>
                <div style={{ fontSize: "0.7rem", color: "#64748b" }}>on Capex</div>
              </div>
            </div>

            {/* Funding split visual */}
            <div style={{ background: "#0d1929", border: "1px solid #1e2d42", borderRadius: 18, padding: "1rem" }}>
              <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.6rem" }}>Funding Split</div>
              <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", marginBottom: "0.5rem" }}>
                <div style={{ flex: c.equity, background: "#34d399" }} />
                <div style={{ flex: c.loan, background: "#38bdf8" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.75rem", color: "#34d399" }}>🟢 Equity {fmt(c.equity)} ({c.equityPct}%)</span>
                <span style={{ fontSize: "0.75rem", color: "#38bdf8" }}>🔵 Loan {fmt(c.loan)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Chart ── */}
        <div style={{ background: "#0d1929", border: "1px solid #1e2d42", borderRadius: 18, padding: "1.1rem", marginTop: "1rem" }}>
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.9rem" }}>📈 25-Year Cumulative Cash Flow</div>
            <div style={{ fontSize: "0.7rem", color: "#475569" }}>Cumulative income vs cumulative cost (capex + maintenance). Break-even = where lines cross.</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={c.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.30} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" />
              <XAxis dataKey="year" stroke="#334155" tick={{ fontSize: 11, fill: "#475569" }}
                label={{ value: "Years", position: "insideBottom", offset: -12, fill: "#475569", fontSize: 11 }} />
              <YAxis stroke="#334155" tick={{ fontSize: 10, fill: "#475569" }} tickFormatter={fmtK}
                label={{ value: "₹", angle: -90, position: "insideLeft", offset: 10, fill: "#475569", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.5rem" }} />
              {c.breakYears && (
                <ReferenceLine x={c.breakYears}
                  stroke="#fcd34d" strokeDasharray="6 4" strokeWidth={1.5}
                  label={{ value: `Break-Even ${c.breakYears}yr`, fill: "#fcd34d", fontSize: 10, position: "top" }}
                />
              )}
              <Area type="monotone" dataKey="cost"   name="Cumulative Cost"   stroke="#f59e0b" fill="url(#gCost)"   strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="income" name="Cumulative Income" stroke="#34d399" fill="url(#gIncome)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Year Table ── */}
        <div style={{ background: "#0d1929", border: "1px solid #1e2d42", borderRadius: 18, padding: "1.1rem", marginTop: "1rem" }}>
          <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.9rem", marginBottom: "0.75rem" }}>📅 Year-by-Year Projection</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ color: "#475569", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {["Year", "Monthly Income", "Annual Income", "Annual EMI", "Maintenance", "Net Annual", "Cumulative Net"].map((h) => (
                    <th key={h} style={{ textAlign: "right", padding: "0.5rem 0.6rem", borderBottom: "1px solid #1e2d42" }}
                      className={h === "Year" ? "text-left" : ""}
                    >{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.tableRows.map(({ yr, annIncome, annEmi, annMaint, netAnn, cumNet }) => {
                  const df = Math.pow(1 - degrad / 100, yr - 1);
                  const mInc = c.monthlyIncome * df;
                  return (
                    <tr key={yr} style={{ background: cumNet >= 0 ? "rgba(52,211,153,0.04)" : "transparent", borderBottom: "1px solid #0f1c2d" }}>
                      <td style={{ padding: "0.45rem 0.6rem", color: "#94a3b8", fontWeight: 700, textAlign: "left" }}>Y{yr}</td>
                      <td style={{ padding: "0.45rem 0.6rem", color: "#e2e8f0", textAlign: "right" }}>{fmt(mInc)}</td>
                      <td style={{ padding: "0.45rem 0.6rem", color: "#34d399", fontWeight: 700, textAlign: "right" }}>{fmt(annIncome)}</td>
                      <td style={{ padding: "0.45rem 0.6rem", color: annEmi > 0 ? "#818cf8" : "#475569", textAlign: "right" }}>{annEmi > 0 ? `− ${fmt(annEmi)}` : "—"}</td>
                      <td style={{ padding: "0.45rem 0.6rem", color: "#f87171", textAlign: "right" }}>− {fmt(annMaint)}</td>
                      <td style={{ padding: "0.45rem 0.6rem", fontWeight: 700, color: netAnn >= 0 ? "#34d399" : "#f87171", textAlign: "right" }}>{fmt(netAnn)}</td>
                      <td style={{ padding: "0.45rem 0.6rem", fontWeight: 800, color: cumNet >= 0 ? "#34d399" : "#f87171", textAlign: "right" }}>
                        {cumNet >= 0 && "✓ "}{fmt(cumNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "1rem 0", color: "#334155", fontSize: "0.7rem" }}>
          ☀️ Calculations assume constant tariff, with solar degradation applied. Consult a financial advisor for investment decisions.
        </div>
      </div>
    </div>
  );
}
