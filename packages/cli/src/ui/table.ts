/**
 * @license Apache-2.0
 * ShellMind Terminal Table Formatter
 */

export function renderTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    for (const r of rows) {
      if (r[i] && r[i].length > max) {
        max = r[i].length;
      }
    }
    return max + 2;
  });

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');
  const divider = colWidths.map(w => '-'.repeat(w)).join('-+-');
  const rowLines = rows
    .map(r => r.map((c, i) => (c || '').padEnd(colWidths[i])).join(' | '))
    .join('\n');

  return `\n${headerLine}\n${divider}\n${rowLines}\n`;
}
