'use strict';
// Turns Claude Code tool calls into short Turkish labels for the island.
const fs = require('fs');
const path = require('path');

const base = (p) => (p ? path.basename(String(p).replace(/\\/g, '/')) : '');
const clip = (s, n) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

function describeTool(name, input = {}) {
  input = input || {};
  switch (name) {
    case 'Bash': return `$ ${clip(input.command, 60)}`;
    case 'PowerShell': return `PS ${clip(input.command, 60)}`;
    case 'Read': return `Okuyor · ${base(input.file_path)}`;
    case 'Edit':
    case 'MultiEdit': return `Düzenliyor · ${base(input.file_path)}`;
    case 'Write': return `Yazıyor · ${base(input.file_path)}`;
    case 'NotebookEdit': return `Notebook · ${base(input.notebook_path)}`;
    case 'Grep': return `Arıyor · ${clip(input.pattern, 40)}`;
    case 'Glob': return `Dosya arıyor · ${clip(input.pattern, 40)}`;
    case 'LS': return `Listeliyor · ${base(input.path)}`;
    case 'WebFetch': {
      try { return `Web · ${new URL(input.url).hostname}`; } catch { return 'Web sayfası okuyor'; }
    }
    case 'WebSearch': return `Web'de arıyor · ${clip(input.query, 40)}`;
    case 'Task':
    case 'Agent': return `Alt ajan · ${clip(input.description || input.subagent_type, 40)}`;
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate': return 'Görev listesini güncelliyor';
    case 'AskUserQuestion': return 'Sana bir soru soruyor';
    case 'ExitPlanMode': return 'Planı onayına sunuyor';
    default:
      if (name && name.startsWith('mcp__')) {
        const parts = name.split('__');
        return `${parts[1] || 'MCP'} · ${parts.slice(2).join(' ')}`;
      }
      return name || 'Çalışıyor';
  }
}

// Richer text for the permission card.
function permissionDetail(name, input = {}) {
  input = input || {};
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      return String(input.command || '').slice(0, 600);
    case 'Edit': {
      const o = String(input.old_string || '').split('\n').slice(0, 6).map((l) => '- ' + l);
      const n = String(input.new_string || '').split('\n').slice(0, 6).map((l) => '+ ' + l);
      return [input.file_path, ...o, ...n].join('\n').slice(0, 700);
    }
    case 'MultiEdit':
      return `${input.file_path}\n${(input.edits || []).length} değişiklik`;
    case 'Write':
      return `${input.file_path}\n${String(input.content || '').split('\n').slice(0, 8).join('\n')}`.slice(0, 700);
    case 'WebFetch':
      return String(input.url || '');
    case 'ExitPlanMode':
      return String(input.plan || '').slice(0, 700);
    default:
      try { return JSON.stringify(input, null, 1).slice(0, 500); } catch { return ''; }
  }
}

// Reads the tail of the transcript JSONL and returns the last assistant text.
function lastAssistantText(file) {
  if (!file) return '';
  try {
    const fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').filter(Boolean).reverse();
    for (const line of lines) {
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      if (j.type !== 'assistant' || !j.message) continue;
      const content = j.message.content;
      const text = Array.isArray(content)
        ? content.filter((c) => c.type === 'text').map((c) => c.text).join(' ')
        : String(content || '');
      if (text.trim()) return clip(text.replace(/[#*`_>]/g, ''), 220);
    }
  } catch { /* transcript not readable */ }
  return '';
}

module.exports = { describeTool, permissionDetail, lastAssistantText, clip };
