export function fmtDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function points(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString()} ${amount === 1 ? "pt" : "pts"}`;
}

export function pct(value) {
  return `${Math.round(Number(value || 0))}%`;
}
