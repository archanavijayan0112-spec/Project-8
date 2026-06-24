const data = window.SALES_DATA || [];

const selectors = {
  region: document.querySelector("#regionFilter"),
  category: document.querySelector("#categoryFilter"),
  channel: document.querySelector("#channelFilter")
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key]), 0);
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const name = typeof key === "function" ? key(row) : row[key];
    groups[name] = groups[name] || [];
    groups[name].push(row);
    return groups;
  }, {});
}

function summarize(rows, key) {
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

function populateFilter(select, values) {
  select.innerHTML = ["All", ...values].map((value) => `<option value="${value}">${value}</option>`).join("");
}

function filteredRows() {
  return data.filter((row) => {
    return (
      (selectors.region.value === "All" || row.region === selectors.region.value) &&
      (selectors.category.value === "All" || row.category === selectors.category.value) &&
      (selectors.channel.value === "All" || row.channel === selectors.channel.value)
    );
  });
}

function barChart(target, rows, valueKey, color) {
  const width = 760;
  const height = 280;
  const margin = { top: 18, right: 14, bottom: 42, left: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const max = Math.max(...rows.map((row) => row[valueKey]), 1);
  const slot = plotWidth / rows.length;

  const bars = rows
    .map((row, index) => {
      const barWidth = Math.max(18, slot - 14);
      const x = margin.left + index * slot + (slot - barWidth) / 2;
      const barHeight = (row[valueKey] / max) * plotHeight;
      const y = margin.top + plotHeight - barHeight;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="5"></rect>
        <text x="${x + barWidth / 2}" y="${height - 14}" text-anchor="middle" font-size="12" fill="#60717d">${row.name}</text>`;
    })
    .join("");

  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#d8e0e5"></line>
    ${bars}
  </svg>`;
}

function renderTable(rows) {
  document.querySelector("#summaryTable").innerHTML = rows
    .map(
      (row) => `<tr>
        <td>${row.name}</td>
        <td>${row.orders.toLocaleString("en-US")}</td>
        <td>${row.units.toLocaleString("en-US")}</td>
        <td>${money.format(row.revenue)}</td>
        <td>${money.format(row.profit)}</td>
        <td>${(row.margin * 100).toFixed(1)}%</td>
      </tr>`
    )
    .join("");
}

function render() {
  const rows = filteredRows();
  const revenue = sum(rows, "revenue");
  const profit = sum(rows, "profit");
  const margin = profit / revenue || 0;
  const monthly = summarize(rows, (row) => monthName(row.order_date)).reverse();
  const regions = summarize(rows, "region");
  const categories = summarize(rows, "category");

  document.querySelector("#revenueKpi").textContent = money.format(revenue);
  document.querySelector("#profitKpi").textContent = money.format(profit);
  document.querySelector("#marginKpi").textContent = `${(margin * 100).toFixed(1)}%`;
  document.querySelector("#ordersKpi").textContent = rows.length.toLocaleString("en-US");
  document.querySelector("#rowCount").textContent = `${rows.length.toLocaleString("en-US")} records`;
  document.querySelector("#bestMonth").textContent = monthly.length ? `Best: ${[...monthly].sort((a, b) => b.revenue - a.revenue)[0].name}` : "";
  document.querySelector("#topRegion").textContent = regions.length ? `Top: ${regions[0].name}` : "";
  document.querySelector("#topCategory").textContent = categories.length ? `Top: ${categories[0].name}` : "";

  barChart(document.querySelector("#monthlyChart"), monthly, "revenue", "#0f766e");
  barChart(document.querySelector("#regionChart"), regions, "revenue", "#2563eb");
  barChart(document.querySelector("#categoryChart"), categories, "profit", "#d97706");
  renderTable(categories);
}

function init() {
  populateFilter(selectors.region, [...new Set(data.map((row) => row.region))].sort());
  populateFilter(selectors.category, [...new Set(data.map((row) => row.category))].sort());
  populateFilter(selectors.channel, [...new Set(data.map((row) => row.channel))].sort());
  Object.values(selectors).forEach((select) => select.addEventListener("change", render));
  render();
}

init();
