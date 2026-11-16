export const unitPrice = (n: number) => (n >= 100 ? '₹' + Math.round(n).toLocaleString('en-IN') : '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
