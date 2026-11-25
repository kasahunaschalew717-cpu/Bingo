// Whole-santim to ETB formatting helpers (100 santim = 1 ETB)

export function formatETB(santim: number): string {
  if (!Number.isFinite(santim)) return '0';
  const etb = santim / 100;
  return santim % 100 === 0 ? etb.toFixed(0) : etb.toFixed(2);
}
