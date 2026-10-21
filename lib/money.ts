export const CURRENCY = "INR";

export function formatInr(paise: number) {
  const rupees = Math.floor(Math.abs(paise) / 100).toString();
  const fraction = String(Math.abs(paise) % 100).padStart(2, "0");
  const lastThree = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}` : lastThree;
  return `${paise < 0 ? "-" : ""}₹${grouped}.${fraction}`;
}

export function rupeesToPaise(value: string) {
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value.trim());
  return match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : null;
}

export function paiseToRupees(paise: number) {
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

export function percentToBps(percent: number) {
  return Math.round(percent * 100);
}
