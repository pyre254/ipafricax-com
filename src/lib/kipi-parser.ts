import { normalizeNumber } from "./ip-verification";

export type ParsedRecord = { number: string; category: "patent"|"utility_model"|"industrial_design"|"trademark"; applicant: string|null; title: string|null; status: string; text: string; confidence: number };
/** Conservative INID parsing: preserve the verbatim passage; never infer grant. */
export function parseJournalPage(text: string, priorCategory: ParsedRecord["category"] = "patent") {
  let category = priorCategory;
  const heading = text.match(/(?:^|\n)\s*(?:\d+(?:\.\d+)?\s*)?(PATENTS|UTILITY MODELS|INDUSTRIAL DESIGNS|TRADE\s*MARKS)\s*(?:\n|$)/i)?.[1]?.toUpperCase();
  if (heading?.includes("UTILITY")) category = "utility_model";
  else if (heading?.includes("DESIGN")) category = "industrial_design";
  else if (heading?.includes("MARK")) category = "trademark";
  else if (heading?.includes("PATENT")) category = "patent";
  const starts = [...text.matchAll(/(?:\(\s*(21|11|210|111)\s*\)|\b(210|111))\s*[:.]?\s*([A-Z]{0,4}[\s\/-]*\d[\d\s\/-]{2,32})/g)];
  const records: ParsedRecord[] = [];
  for (let i=0;i<starts.length;i++) {
    const match = starts[i]; if (!match) continue;
    const start = match.index ?? 0, end = starts[i+1]?.index ?? text.length;
    const passage = text.slice(start,end).trim();
    const number = (match[3] ?? "").trim().replace(/\s+/g," ");
    if (!number || normalizeNumber(number).length < 3 || passage.length < 40 || /Application Number|Number of the document/i.test(passage.slice(0,120))) continue;
    const field = (code: string) => passage.match(new RegExp(`(?:\\(\\s*${code}\\s*\\)|\\b${code})\\s*[:.]?\\s*([\\s\\S]*?)(?=\\(\\s*\\d{2,3}\\s*\\)|\\b(?:210|220|511|540|730|740)\\s*:|$)`))?.[1]?.trim().replace(/\s+/g," ") || null;
    // Addresses and wrapped names are preserved rather than guessed away.
    const applicant = field(category === "trademark" ? "730" : "71") || field("73");
    const title = field(category === "trademark" ? "540" : "54");
    const status = /ACCEPTED FOR REGISTRATION|APPLICATION|NATIONAL PHASE/i.test(text) ? "application_publication" : /RENEW/i.test(text.slice(0,start)) ? "renewal_publication" : "publication";
    records.push({ number, category, applicant, title, status, text: passage.slice(0,10000), confidence: applicant ? 75 : 55 });
  }
  return { category, records, requiresOcr: text.replace(/\s/g,"").length < 70 };
}