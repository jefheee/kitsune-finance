/**
 * Utilitário de Geração e Exportação de Documentos Oficiais - Kitsune Finance
 * Suporta: Download PDF formatado, Word (.doc/docx compatível), Google Docs (com rich-paste) e Markdown.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Converte Markdown simples para HTML estruturado para exportação e impressão
 */
export function simpleMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Bloco de cabeçalho
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 700; color: #111827; margin-top: 18px; margin-bottom: 8px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 19px; font-weight: 700; color: #111827; margin-top: 24px; margin-bottom: 10px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size: 24px; font-weight: 800; color: #111827; margin-top: 28px; margin-bottom: 14px; letter-spacing: -0.02em;">$1</h1>');

  // Negrito e Itálico
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong style="color: #111827; font-weight: 700;">$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em style="color: #4B5563;">$1</em>');

  // Listas
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom: 4px; color: #374151;">$1</li>');
  html = html.replace(/^\s*\*\s+(.*$)/gim, '<li style="margin-bottom: 4px; color: #374151;">$1</li>');
  html = html.replace(/(<li.*<\/li>)/gim, '<ul style="margin: 8px 0 14px 20px; padding: 0;">$1</ul>');

  // Tabelas Markdown simples
  html = html.replace(/\|(.+)\|/gim, (match) => {
    const cells = match.split("|").filter((c) => c.trim().length > 0);
    if (cells.some((c) => c.includes("---"))) return ""; // separator
    const isHeader = !match.includes("R$") && !match.includes("0");
    const tag = isHeader ? "th" : "td";
    const bg = isHeader ? "background: #F3F4F6; font-weight: 700;" : "background: #FFFFFF;";
    const inner = cells
      .map(
        (c) =>
          `<${tag} style="border: 1px solid #E5E7EB; padding: 8px 12px; text-align: left; font-size: 13px; ${bg}">${c.trim()}</${tag}>`
      )
      .join("");
    return `<tr style="border-bottom: 1px solid #E5E7EB;">${inner}</tr>`;
  });
  html = html.replace(/(<tr[\s\S]*<\/tr>)/gim, '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #E5E7EB;">$1</table>');

  // Parágrafos
  html = html.replace(/\n\n+/g, "</p><p style='margin-bottom: 12px; color: #374151; line-height: 1.65; font-size: 14px;'>");
  html = `<p style='margin-bottom: 12px; color: #374151; line-height: 1.65; font-size: 14px;'>${html}</p>`;

  return html;
}

/**
 * Cria template HTML oficial Kitsune para download e impressão
 */
function buildFullDocumentHtml(title: string, markdown: string, userName?: string): string {
  const contentHtml = simpleMarkdownToHtml(markdown);
  const nowStr = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 20mm; size: A4; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1F2937;
      background: #FFFFFF;
      margin: 0;
      padding: 24px;
      line-height: 1.6;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #E11D48;
      padding-bottom: 14px;
      margin-bottom: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #111827;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 2px;
    }
    .doc-meta {
      text-align: right;
      font-size: 11px;
      color: #6B7280;
    }
    .content {
      font-size: 14px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 14px;
      border-top: 1px solid #E5E7EB;
      font-size: 11px;
      color: #9CA3AF;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div>
        <h1 class="brand-title">Kitsune Finance</h1>
        <div class="brand-sub">Wealth OS • Relatório Oficial de Auditoria & Planejamento</div>
      </div>
    </div>
    <div class="doc-meta">
      <div><strong>Titular:</strong> ${escapeHtml(userName || "Titular")}</div>
      <div><strong>Emissão:</strong> ${nowStr}</div>
      <div style="color: #E11D48; font-weight: 600;">Auditoria Open Finance Brasil</div>
    </div>
  </div>

  <div class="content">
    ${contentHtml}
  </div>

  <div class="footer">
    <span>Kitsune Finance • Documento confidencial gerado com isolamento de dados RLS</span>
    <span>Página 1 de 1</span>
  </div>
</body>
</html>`;
}

/**
 * Dispara download de arquivo genérico no navegador
 */
export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. Download como Markdown (.md)
 */
export function downloadMarkdownFile(title: string, markdown: string) {
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const filename = `${cleanTitle}-${new Date().toISOString().split("T")[0]}.md`;
  triggerFileDownload(filename, markdown, "text/markdown;charset=utf-8");
}

/**
 * 2. Download como Documento Word / Docs (.doc)
 * O formato HTML formatado com MIME `application/msword` abre perfeitamente no Word e no Google Drive.
 */
export function downloadWordDoc(title: string, markdown: string, userName?: string) {
  const fullHtml = buildFullDocumentHtml(title, markdown, userName);
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const filename = `${cleanTitle}-${new Date().toISOString().split("T")[0]}.doc`;
  triggerFileDownload(filename, fullHtml, "application/msword;charset=utf-8");
}

/**
 * 3. Salvar como PDF via Janela de Impressão Estilizada
 */
export function exportToPrintPdf(title: string, markdown: string, userName?: string) {
  const fullHtml = buildFullDocumentHtml(title, markdown, userName);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // Fallback: faz download como documento Word
    downloadWordDoc(title, markdown, userName);
    return;
  }

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();

  // Dá tempo para carregar fontes e dispara o diálogo de impressão
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
}

/**
 * 4. Abrir no Google Docs com Rich-Text Formatado
 * Copia o HTML formatado para a área de transferência e abre o Google Docs para colar com 1 toque.
 */
export async function openInGoogleDocs(markdown: string): Promise<boolean> {
  const html = simpleMarkdownToHtml(markdown);

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.ClipboardItem) {
      const textBlob = new Blob([markdown], { type: "text/plain" });
      const htmlBlob = new Blob([html], { type: "text/html" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": textBlob,
          "text/html": htmlBlob,
        }),
      ]);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(markdown);
    }
  } catch (err) {
    console.warn("Clipboard rich copy failed, fallback:", err);
  }

  window.open("https://docs.google.com/document/create", "_blank");
  return true;
}
