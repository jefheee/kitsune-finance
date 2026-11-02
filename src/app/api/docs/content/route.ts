import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  affectedFiles?: string;
  items: string[];
}

function readDocFileSafe(fileName: string): string {
  const targetPath = path.join(process.cwd(), 'docs', fileName);
  try {
    if (fs.existsSync(targetPath)) {
      return fs.readFileSync(targetPath, 'utf-8');
    }
  } catch (_) {}
  return '';
}

export async function GET() {
  try {
    const changelogRaw = readDocFileSafe('CHANGELOG.md');
    const projectStateRaw = readDocFileSafe('PROJECT_STATE.md');

    // Parse inteligente do CHANGELOG.md
    const changelogEntries: ChangelogEntry[] = [];
    const changelogBlocks = changelogRaw.split(/^##\s+/m).slice(1);

    for (const block of changelogBlocks) {
      const lines = block.split('\n');
      const headerLine = lines[0] || '';

      // Extrai [YYYY-MM-DD] - Título
      const headerMatch = headerLine.match(/\[(.*?)\]\s*(?:-\s*(.*))?/);
      const date = headerMatch ? headerMatch[1] : '';
      const title = headerMatch && headerMatch[2] ? headerMatch[2].trim() : headerLine.trim();

      let affectedFiles = '';
      const items: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('- **Arquivos Afetados:**') || line.startsWith('**Arquivos Afetados:**')) {
          affectedFiles = line.replace(/.*?\*\*Arquivos Afetados:\*\*\s*/, '').trim();
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          const itemText = line.replace(/^[-*]\s+/, '').trim();
          if (itemText && !itemText.startsWith('**Objetivo:**')) {
            items.push(itemText);
          }
        }
      }

      changelogEntries.push({
        version: date,
        date,
        title,
        affectedFiles,
        items: items.length > 0 ? items : ['Atualizações e melhorias implementadas no ecossistema.'],
      });
    }

    // Parse das seções de PROJECT_STATE.md
    const stateSections: Array<{ id: string; title: string; content: string }> = [];
    const stateBlocks = projectStateRaw.split(/^##\s+/m).slice(1);

    for (let idx = 0; idx < stateBlocks.length; idx++) {
      const block = stateBlocks[idx];
      const lines = block.split('\n');
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();

      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      stateSections.push({
        id: slug || `section-${idx + 1}`,
        title,
        content,
      });
    }

    return NextResponse.json({
      success: true,
      changelog: changelogEntries,
      projectState: stateSections,
    });
  } catch (error) {
    console.error('[API Docs Content error]:', error);
    return NextResponse.json(
      { error: 'Falha ao ler arquivos de documentação.' },
      { status: 500 }
    );
  }
}
