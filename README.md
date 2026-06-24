# ☀️ Solar Plant Break-Even Calculator

A fully interactive React app for planning solar farm investments — with EMI calculation, monthly income projection, payback period, and a 25-year cumulative cash flow chart.

**Live Demo:** [https://shakti-singh1.github.io/solar-breakeven-calculator/](https://shakti-singh1.github.io/solar-breakeven-calculator/)

---

## Features

- **Plant Config** — Set capacity (kW), cost per kW (or manual total), sun hours, performance ratio, degradation rate, and maintenance %
- **Revenue Settings** — Rate per unit (₹/kWh) with live generation preview (monthly & annual kWh + income)
- **Financing** — Your investment (down payment), auto-calculated loan amount, interest rate & tenure → EMI
- **Monthly Cash Flow** — Gross income, minus EMI, minus maintenance = net monthly position
- **Break-Even Analysis** — Exact month/year when cumulative income crosses total project cost
- **25-Year Area Chart** — Cumulative Income vs Cumulative Cost with break-even reference line
- **Year-by-Year Table** — All 25 years: monthly income, annual income, EMI, maintenance, net annual, cumulative net
- **25-Year ROI** — Total return on capital invested

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| React 18 | UI framework |
| Vite 5 | Build tool |
| Tailwind CSS 3 | Utility styling |
| Recharts | Area chart |
| GitHub Actions | CI/CD |
| GitHub Pages | Hosting |

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173/solar-breakeven-calculator/](http://localhost:5173/solar-breakeven-calculator/)

## Build

```bash
npm run build
```

---

## Financial Formulas

| Metric | Formula |
|--------|---------|
| EMI | `P × r(1+r)ⁿ / ((1+r)ⁿ − 1)` |
| Monthly Units | `kW × Sun Hours × 30 × Performance Ratio` |
| Panel Degradation | `(1 − rate%)^year` compounded |
| Break-Even | When `Cumulative Income ≥ Capex + Cumulative Maintenance` |

---

> ⚠️ For investment planning reference only. Consult a certified financial advisor for actual investment decisions.
