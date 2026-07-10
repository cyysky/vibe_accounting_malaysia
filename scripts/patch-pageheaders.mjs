// Line-based parser v3: indent fixes
import fs from 'node:fs';
import path from 'node:path';

const root = 'apps/web/app';

const pages = [
  { file: 'dashboard/books/page.tsx', importPath: '../../../components/ui/PageHeader' },
  { file: 'dashboard/journal/page.tsx', importPath: '../../../components/ui/PageHeader' },
  { file: 'einvoice/configs/page.tsx', importPath: '../../../components/ui/PageHeader' },
  { file: 'einvoice/submissions/page.tsx', importPath: '../../../components/ui/PageHeader' },
  { file: 'payables/page.tsx', importPath: '../../components/ui/PageHeader' },
  { file: 'purchase/page.tsx', importPath: '../../components/ui/PageHeader' },
  { file: 'receivables/page.tsx', importPath: '../../components/ui/PageHeader' },
  { file: 'sales/page.tsx', importPath: '../../components/ui/PageHeader' },
  { file: 'settings/books/page.tsx', importPath: '../../../components/ui/PageHeader' },
  { file: 'settings/fiscal-years/page.tsx', importPath: '../../../components/ui/PageHeader' },
  { file: 'settings/tax-codes/page.tsx', importPath: '../../../components/ui/PageHeader' },
  { file: 'stock/page.tsx', importPath: '../../components/ui/PageHeader' },
];

let touched = 0, failed = 0;
for (const p of pages) {
  const filePath = path.join(root, p.file);
  const src = fs.readFileSync(filePath, 'utf8');
  if (src.includes("from '" + p.importPath + "'")) {
    console.log('SKIP ' + p.file + ' (already patched)');
    continue;
  }
  const lines = src.split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*<div className="flex items-end justify-between">\s*$/.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) { console.log('FAIL ' + p.file + ' (no start)'); failed++; continue; }
  const startIndent = lines[startIdx].match(/^(\s*)/)[1];
  const childIndent = startIndent + '  ';
  // Find matching </div>
  let depth = 1, endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    const opens = (l.match(/<div\b/g) || []).length;
    const closes = (l.match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (depth === 0) { endIdx = i; break; }
  }
  if (endIdx < 0) { console.log('FAIL ' + p.file + ' (no end)'); failed++; continue; }
  const block = lines.slice(startIdx, endIdx + 1);
  const titleLine = block.find(l => l.includes('text-2xl font-semibold tracking-tight'));
  if (!titleLine) { console.log('FAIL ' + p.file + ' (no h1)'); failed++; continue; }
  const titleMatch = titleLine.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (!titleMatch) { console.log('FAIL ' + p.file + ' (no h1 content)'); failed++; continue; }
  const title = titleMatch[1];
  let pContent = '', foundP = false;
  for (let i = 0; i < block.length; i++) {
    const l = block[i];
    if (!foundP) {
      if (/<p className="text-sm text-slate-500">/.test(l)) {
        const after = l.slice(l.indexOf('>', l.indexOf('<p')) + 1);
        const closeIdx = after.indexOf('</p>');
        if (closeIdx >= 0) { pContent = after.slice(0, closeIdx); foundP = true; break; }
        else { pContent = after; foundP = true; }
      }
    } else {
      const closeIdx = l.indexOf('</p>');
      if (closeIdx >= 0) { pContent += '\n' + l.slice(0, closeIdx); break; }
      pContent += '\n' + l;
    }
  }
  if (!foundP) { console.log('FAIL ' + p.file + ' (no p)'); failed++; continue; }
  const desc = pContent.replace(/\s+/g, ' ').trim();
  // Inner </div> detection
  let ddepth = 1, innerCloseInBlock = -1;
  for (let i = 1; i < block.length; i++) {
    const l = block[i];
    ddepth += (l.match(/<div\b/g) || []).length;
    ddepth -= (l.match(/<\/div>/g) || []).length;
    if (ddepth === 1) { innerCloseInBlock = i; break; }
  }
  if (innerCloseInBlock < 0) { console.log('FAIL ' + p.file + ' (no inner close)'); failed++; continue; }
  const actionsBlock = block.slice(innerCloseInBlock + 1, block.length - 1);
  const innerActionIndent = startIndent + '  ';
  const reindentedActions = actionsBlock.map(l => {
    if (l.trim() === '') return l;
    if (l.startsWith(innerActionIndent)) return startIndent + '  ' + l.slice(innerActionIndent.length);
    if (l.startsWith(startIndent)) return startIndent + '  ' + l.slice(startIndent.length);
    return l;
  });
  const replacement = [
    startIndent + '<PageHeader',
    childIndent + 'title="' + title + '"',
    childIndent + 'description="' + desc + '"',
    childIndent + 'actions={',
    childIndent + '  <>',
    ...reindentedActions,
    childIndent + '  </>',
    childIndent + '}',
    startIndent + '/>',
  ];
  const newLines = [
    ...lines.slice(0, startIdx),
    ...replacement,
    ...lines.slice(endIdx + 1),
  ];
  let lastImport = -1;
  for (let i = 0; i < newLines.length; i++) {
    if (/^import\s/.test(newLines[i])) lastImport = i;
    else if (lastImport >= 0 && newLines[i].trim() !== '' && !/^import\s/.test(newLines[i])) break;
  }
  if (lastImport >= 0) {
    newLines.splice(lastImport + 1, 0, "import { PageHeader } from '" + p.importPath + "';");
  }
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
  console.log('OK   ' + p.file);
  touched++;
}
console.log('Touched: ' + touched + ', Failed: ' + failed);
