// Arabic yeh/kaf → Persian, strip harakat, ZWNJ/tatweel → space, digits → Latin.
export function normalizePersian(input: string): string {
  return input
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[\u200C\u0640]/g, " ")
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
