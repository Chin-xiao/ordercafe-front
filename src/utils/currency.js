const rielFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

export const formatRiel = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${rielFormatter.format(amount)}៛` : '—';
};
