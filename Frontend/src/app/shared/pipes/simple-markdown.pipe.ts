import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'simpleMarkdown',
  standalone: true,
})
export class SimpleMarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustHtml(this.toHtml(value));
  }

  private toHtml(value: string): string {
    const lines: string[] = [];
    const sourceLines = this.escape(value.replace(/<br\s*\/?>/gi, '\n')).split(/\r?\n/);
    let inList = false;
    let inOrderedList = false;

    const closeList = () => {
      if (inList) {
        lines.push('</ul>');
        inList = false;
      }
      if (inOrderedList) {
        lines.push('</ol>');
        inOrderedList = false;
      }
    };

    const closeOrderedList = () => {
      if (inOrderedList) {
        lines.push('</ol>');
        inOrderedList = false;
      }
    };

    const closeUnorderedList = () => {
      if (inList) {
        lines.push('</ul>');
        inList = false;
      }
    };

    for (let index = 0; index < sourceLines.length; index += 1) {
      const rawLine = sourceLines[index];
      const line = rawLine.trimEnd();
      const heading = line.match(/^#{2,3}\s+(.+)$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);
      const numbered = line.match(/^\d+\.\s+(.+)$/);

      if (heading) {
        closeList();
        lines.push(`<h4>${this.inline(heading[1])}</h4>`);
      } else if (this.isTableStart(sourceLines, index)) {
        closeList();
        const table = this.readTable(sourceLines, index);
        lines.push(table.html);
        index = table.endIndex;
      } else if (bullet) {
        closeOrderedList();
        if (!inList) {
          lines.push('<ul>');
          inList = true;
        }
        lines.push(`<li>${this.inline(bullet[1])}</li>`);
      } else if (numbered) {
        closeUnorderedList();
        if (!inOrderedList) {
          lines.push('<ol>');
          inOrderedList = true;
        }
        lines.push(`<li>${this.inline(numbered[1])}</li>`);
      } else if (line.trim()) {
        closeList();
        lines.push(`<p>${this.inline(line)}</p>`);
      } else {
        closeList();
      }
    }

    closeList();
    return lines.join('');
  }

  private isTableStart(lines: string[], index: number): boolean {
    const current = lines[index]?.trim() ?? '';
    const next = lines[index + 1]?.trim() ?? '';
    return this.isTableRow(current) && this.isTableSeparator(next);
  }

  private readTable(lines: string[], startIndex: number): { html: string; endIndex: number } {
    const headers = this.splitTableCells(lines[startIndex]);
    const rows: string[][] = [];
    let index = startIndex + 2;

    while (index < lines.length && this.isTableRow(lines[index].trim())) {
      rows.push(this.splitTableCells(lines[index]));
      index += 1;
    }

    const columnCount = Math.max(headers.length, ...rows.map((row) => row.length));
    const pad = (cells: string[]) =>
      Array.from({ length: columnCount }, (_, cellIndex) => cells[cellIndex] ?? '');

    const thead = pad(headers)
      .map((cell) => `<th>${this.inline(cell)}</th>`)
      .join('');
    const tbody = rows
      .map((row) => `<tr>${pad(row).map((cell) => `<td>${this.inline(cell)}</td>`).join('')}</tr>`)
      .join('');

    return {
      html: `<div class="markdown-table-shell"><button class="expand-table-btn" type="button">Agrandir le tableau</button><div class="markdown-table-wrap"><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div></div>`,
      endIndex: index - 1,
    };
  }

  private isTableRow(line: string): boolean {
    return line.includes('|') && this.splitTableCells(line).length >= 2;
  }

  private isTableSeparator(line: string): boolean {
    if (!this.isTableRow(line)) {
      return false;
    }

    return this.splitTableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  }

  private splitTableCells(line: string): string[] {
    return line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  private inline(value: string): string {
    return value
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
