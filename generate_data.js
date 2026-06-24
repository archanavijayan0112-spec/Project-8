const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");

const regions = ["North", "South", "East", "West"];
const products = [
  { name: "Laptop", category: "Electronics", basePrice: 780, costRate: 0.68 },
  { name: "Headphones", category: "Electronics", basePrice: 92, costRate: 0.55 },
  { name: "Office Chair", category: "Furniture", basePrice: 210, costRate: 0.62 },
  { name: "Standing Desk", category: "Furniture", basePrice: 430, costRate: 0.66 },
  { name: "Notebook Set", category: "Stationery", basePrice: 18, costRate: 0.42 },
  { name: "Pen Pack", category: "Stationery", basePrice: 11, costRate: 0.38 },
  { name: "Coffee Maker", category: "Appliances", basePrice: 125, costRate: 0.58 },
  { name: "Air Purifier", category: "Appliances", basePrice: 260, costRate: 0.63 }
];
const channels = ["Online", "Retail Store", "Partner"];

let seed = 42;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function seasonalMultiplier(month) {
  if ([11, 12].includes(month)) return 1.35;
  if ([6, 7, 8].includes(month)) return 1.12;
  if ([1, 2].includes(month)) return 0.88;
  return 1;
}

function discountFor(channel, month) {
  const base = channel === "Online" ? 0.08 : channel === "Partner" ? 0.06 : 0.04;
  const promo = [3, 7, 11].includes(month) ? 0.04 : 0;
  return Number((base + promo + random() * 0.04).toFixed(2));
}

function createRows() {
  const rows = [];
  let orderId = 10001;

  for (let month = 1; month <= 12; month += 1) {
    const ordersThisMonth = 55 + Math.round(random() * 25);

    for (let i = 0; i < ordersThisMonth; i += 1) {
      const product = pick(products);
      const region = pick(regions);
      const channel = pick(channels);
      const day = 1 + Math.floor(random() * 28);
      const units = Math.max(1, Math.round((1 + random() * 5) * seasonalMultiplier(month)));
      const discountRate = discountFor(channel, month);
      const priceNoise = 0.9 + random() * 0.22;
      const unitPrice = Number((product.basePrice * priceNoise).toFixed(2));
      const revenue = Number((units * unitPrice * (1 - discountRate)).toFixed(2));
      const cost = Number((units * unitPrice * product.costRate).toFixed(2));
      const profit = Number((revenue - cost).toFixed(2));
      const satisfaction = Math.min(5, Math.max(1, Number((3.4 + random() * 1.4 - discountRate).toFixed(1))));

      rows.push({
        order_id: `ORD-${orderId}`,
        order_date: `2025-${pad(month)}-${pad(day)}`,
        region,
        category: product.category,
        product: product.name,
        channel,
        units,
        unit_price: unitPrice,
        discount_rate: discountRate,
        revenue,
        cost,
        profit,
        customer_satisfaction: satisfaction
      });
      orderId += 1;
    }
  }

  return rows;
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => row[header]).join(","));
  }
  return `${lines.join("\n")}\n`;
}

fs.mkdirSync(dataDir, { recursive: true });
const rows = createRows();
fs.writeFileSync(path.join(dataDir, "sales_data.csv"), toCsv(rows));
fs.writeFileSync(
  path.join(dataDir, "sales_data.js"),
  `window.SALES_DATA = ${JSON.stringify(rows, null, 2)};\n`
);

console.log(`Generated ${rows.length} sales records in ${dataDir}`);
