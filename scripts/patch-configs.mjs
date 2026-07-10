import fs from 'node:fs';
const file = 'apps/web/app/einvoice/configs/page.tsx';
let src = fs.readFileSync(file, 'utf8');
const re = new RegExp(
  '<div className="flex items-end justify-between">\\s*' +
  '<div>\\s*' +
  '<h1 className="text-2xl font-semibold tracking-tight">MyInvois Configuration</h1>\\s*' +
  '<p className="text-sm text-slate-500">\\s*' +
  '([^<]+)\\s*' +
  '</p>\\s*' +
  '</div>\\s*' +
  '([\\s\\S]*?)' +
  '</div>',
  ''
);
const m = src.match(re);
if (!m) { console.log('FAIL'); process.exit(1); }
const desc = m[1].replace(/\s+/g, ' ').trim();
const actionsRaw = m[2];
const replacement =
  '<PageHeader\n' +
  '        title="MyInvois Configuration"\n' +
  '        description="' + desc + '"\n' +
  '        actions={\n' +
  '          <>\n' +
  actionsRaw.split('\n').map(l => l.length > 0 ? '            ' + l.replace(/^[ \t]+/, '') : l).join('\n') + '\n' +
  '          </>\n' +
  '        }\n' +
  '      />';
src = src.replace(re, replacement);
if (!src.includes("from '../../../components/ui/PageHeader'")) {
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImport = i;
    else if (lastImport >= 0 && lines[i].trim() !== '' && !/^import\s/.test(lines[i])) break;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import { PageHeader } from '../../../components/ui/PageHeader';");
    src = lines.join('\n');
  }
}
fs.writeFileSync(file, src, 'utf8');
console.log('OK');
