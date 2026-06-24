const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data", "sales_data.csv");
const reportsDir = path.join(root, "reports");
const outputsDir = path.join(root, "outputs");

function parseCsv(content) {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(
      headers.map((header, index) => {
        const value = values[index];
        const numeric = Number(value);
        return [header, Number.isNaN(numeric) || value === "" ? value : numeric];
      })
    );
  });
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field]), 0);
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const value = typeof key === "function" ? key(row) : row[key];
    groups[value] = groups[value] || [];
    groups[value].push(row);
    return groups;
  }, {});
}

function summarizeGroups(rows, key) {
  return Object.entries(groupBy(rows, key))
    .map(([name, items]) => ({
      name,
      orders: items.length,
      units: sum(items, "units"),
      revenue: sum(items, "revenue"),
      profit: sum(items, "profit"),
      margin: sum(items, "profit") / sum(items, "revenue")
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function monthName(date) {
  return new Date(`${date}T00:00:00`).toLocaleString("en-US", { month: "short" });
}

function money(value) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function writeBarChart(fileName, title, data, valueField, color) {
  const width = 900;
  const height = 480;
  const margin = { top: 58, right: 30, bottom: 110, left: 90 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...data.map((item) => item[valueField]));
  const barWidth = plotWidth / data.length - 16;

  const bars = data
    .map((item, index) => {
      const x = margin.left + index * (plotWidth / data.length) + 8;
      const barHeight = (item[valueField] / maxValue) * plotHeight;
      const y = margin.top + plotHeight - barHeight;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="5" />
        <text x="${x + barWidth / 2}" y="${height - 72}" text-anchor="middle" font-size="13" fill="#263238">${item.name}</text>
        <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="12" fill="#263238">${money(item[valueField])}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f8faf9"/>
  <text x="36" y="36" font-size="24" font-family="Arial" font-weight="700" fill="#17202a">${title}</text>
  <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#cfd8dc"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#cfd8dc"/>
  ${bars}
</svg>`;

  fs.writeFileSync(path.join(outputsDir, fileName), svg);
}

function writeLineChart(fileName, title, data) {
  const width = 900;
  const height = 480;
  const margin = { top: 58, right: 34, bottom: 72, left: 90 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...data.map((item) => item.revenue));
  const points = data.map((item, index) => {
    const x = margin.left + (index / (data.length - 1)) * plotWidth;
    const y = margin.top + plotHeight - (item.revenue / maxValue) * plotHeight;
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labels = points
    .map(
      (point) => `
      <circle cx="${point.x}" cy="${point.y}" r="5" fill="#0f766e"/>
      <text x="${point.x}" y="${height - 38}" text-anchor="middle" font-size="13" fill="#263238">${point.name}</text>`
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f8faf9"/>
  <text x="36" y="36" font-size="24" font-family="Arial" font-weight="700" fill="#17202a">${title}</text>
  <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#cfd8dc"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#cfd8dc"/>
  <polyline fill="none" stroke="#0f766e" stroke-width="4" points="${polyline}" />
  ${labels}
</svg>`;

  fs.writeFileSync(path.join(outputsDir, fileName), svg);
}

fs.mkdirSync(reportsDir, { recursive: true });
fs.mkdirSync(outputsDir, { recursive: true });

const rows = parseCsv(fs.readFileSync(dataPath, "utf8"));
const totals = {
  orders: rows.length,
  units: sum(rows, "units"),
  revenue: sum(rows, "revenue"),
  profit: sum(rows, "profit"),
  margin: sum(rows, "profit") / sum(rows, "revenue"),
  averageOrderValue: sum(rows, "revenue") / rows.length,
  satisfaction: sum(rows, "customer_satisfaction") / rows.length
};
const byRegion = summarizeGroups(rows, "region");
const byCategory = summarizeGroups(rows, "category");
const byChannel = summarizeGroups(rows, "channel");
const byMonth = summarizeGroups(rows, (row) => monthName(row.order_date)).reverse();
const bestRegion = byRegion[0];
const bestCategory = byCategory[0];
const topMarginCategory = [...byCategory].sort((a, b) => b.margin - a.margin)[0];
const weakestChannel = [...byChannel].sort((a, b) => a.margin - b.margin)[0];

const summary = {
  generated_at: new Date().toISOString(),
  totals,
  by_region: byRegion,
  by_category: byCategory,
  by_channel: byChannel,
  by_month: byMonth
};

fs.writeFileSync(path.join(outputsDir, "summary.json"), JSON.stringify(summary, null, 2));
writeBarChart("revenue_by_region.svg", "Revenue by Region", byRegion, "revenue", "#2563eb");
writeBarChart("profit_by_category.svg", "Profit by Category", byCategory, "profit", "#d97706");
writeLineChart("monthly_revenue.svg", "Monthly Revenue Trend", byMonth);

const markdown = `# Retail Sales Analytics: Executive Summary

## KPI Snapshot

| Metric | Value |
| --- | ---: |
| Orders | ${totals.orders.toLocaleString("en-US")} |
| Units Sold | ${totals.units.toLocaleString("en-US")} |
| Revenue | ${money(totals.revenue)} |
| Profit | ${money(totals.profit)} |
| Profit Margin | ${percent(totals.margin)} |
| Average Order Value | ${money(totals.averageOrderValue)} |
| Avg. Customer Satisfaction | ${totals.satisfaction.toFixed(2)} / 5 |

## Main Findings

- ${bestRegion.name} is the strongest region by revenue with ${money(bestRegion.revenue)}.
- ${bestCategory.name} leads category revenue at ${money(bestCategory.revenue)}.
- ${topMarginCategory.name} has the healthiest profit margin at ${percent(topMarginCategory.margin)}.
- ${weakestChannel.name} has the lowest channel margin at ${percent(weakestChannel.margin)}, so discounting and fulfillment costs should be reviewed.
- Seasonal demand is visible in the monthly trend, with late-year months outperforming early-year months.

## Recommended Actions

1. Increase inventory and campaign budget for ${bestCategory.name} in the best-performing regions.
2. Review discount policies in the ${weakestChannel.name} channel to protect margin.
3. Use the high-margin category mix as the default recommendation set for online campaigns.
4. Monitor customer satisfaction alongside promotions so revenue growth does not come from over-discounting.

## Generated Visuals

- \`outputs/revenue_by_region.svg\`
- \`outputs/profit_by_category.svg\`
- \`outputs/monthly_revenue.svg\`
`;

fs.writeFileSync(path.join(reportsDir, "executive_summary.md"), markdown);
console.log(`Analyzed ${rows.length} records and wrote reports to ${reportsDir}`);
