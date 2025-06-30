class ThemeEngine {
  constructor(config) {
    this.config = config;
  }

  generateCSS() {
    const theme = this.config.theme;
    const colors = theme.colors;
    const font = theme.font;
    const spacing = theme.spacing || {};
    const headings = theme.headings || {};

    return `
    @page {
      size: ${this.config.page.width} ${this.config.page.height};
      margin: 0;
    }
    
    * {
      page-break-inside: auto !important;
      page-break-after: auto !important;
      page-break-before: auto !important;
      break-inside: auto !important;
      break-after: auto !important;
      break-before: auto !important;
    }
    
    body {
      width: ${this.config.page.width};
      margin: 0;
      padding: ${this.config.page.margins.top} ${this.config.page.margins.right} ${this.config.page.margins.bottom} ${this.config.page.margins.left};
      font-family: ${font.family};
      font-size: ${font.size};
      line-height: ${font.lineHeight};
      color: ${colors.text};
      background: ${colors.background};
      box-sizing: border-box;
      overflow: visible;
      min-height: 100vh;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      color: ${colors.primary};
      margin: ${spacing.headingMargin || '1.5em 0 0.5em 0'};
      font-weight: 600;
    }

    ${this.generateHeadingStyles(headings)}

    /* Paragraphs and basic text */
    p {
      margin: ${spacing.paragraphMargin || '0.8em 0'};
    }

    /* Lists */
    ul, ol {
      margin: ${spacing.listMargin || '0.8em 0'};
      padding-left: 2em;
    }

    li {
      margin: 0.3em 0;
    }

    /* Links */
    a {
      color: ${colors.secondary};
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    /* Blockquotes */
    blockquote {
      border-left: 4px solid ${colors.blockquoteBorder || colors.secondary};
      margin: 1em 0;
      padding: 0.5em 1em;
      background: ${colors.code};
      color: ${colors.blockquote || colors.text};
      font-style: italic;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    th, td {
      border: 1px solid ${colors.border};
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: ${colors.code};
      font-weight: 600;
    }

    /* Code blocks */
    pre {
      background: ${colors.code};
      border: 1px solid ${colors.border};
      border-radius: 6px;
      padding: 1em;
      overflow-x: auto;
      font-family: ${this.config.code.fontFamily};
      font-size: ${this.config.code.fontSize};
      line-height: 1.4;
      margin: 1em 0;
    }

    code {
      background: ${colors.code};
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: ${this.config.code.fontFamily};
      font-size: ${this.config.code.fontSize};
      color: ${colors.codeText || colors.text};
    }

    pre code {
      background: none;
      padding: 0;
      border-radius: 0;
    }

    /* Mermaid diagrams */
    .mermaid {
      text-align: center;
      margin: 2em 0;
      min-height: 100px;
      background-color: ${this.config.mermaid.backgroundColor};
      padding: 1.5em;
      border: 1px solid ${colors.border};
      border-radius: 8px;
    }

    .mermaid svg {
      max-width: 100%;
      height: auto;
      background-color: ${this.config.mermaid.backgroundColor} !important;
    }

    /* High contrast for Mermaid elements */
    .mermaid svg rect,
    .mermaid svg path,
    .mermaid svg circle,
    .mermaid svg polygon,
    .mermaid svg ellipse,
    .mermaid svg line {
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .mermaid svg text {
      fill: #000000 !important;
      font-weight: 500 !important;
      font-family: ${this.config.mermaid.fontFamily} !important;
      font-size: ${this.config.mermaid.fontSize} !important;
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .mermaid svg [stroke] {
      stroke: #1f2937 !important;
      stroke-width: 2px !important;
    }

    .mermaid svg [fill]:not([fill="none"]):not([fill="transparent"]) {
      fill-opacity: 1 !important;
    }

    /* Utility classes */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .page-break { page-break-before: always; }

    /* Print optimizations */
    strong { font-weight: 600; }
    em { font-style: italic; }

    hr {
      border: none;
      border-top: 2px solid ${colors.border};
      margin: 2em 0;
    }

    /* Table of Contents */
    .toc {
      margin: 2em 0;
      padding: 1em;
      border: 1px solid ${colors.border};
      border-radius: 8px;
      background: ${colors.code};
    }

    .toc h2 {
      margin-top: 0;
      color: ${colors.primary};
      border-bottom: 2px solid ${colors.secondary};
      padding-bottom: 0.5em;
    }

    .toc ul {
      list-style: none;
      padding-left: 0;
    }

    .toc ul ul {
      padding-left: 1.5em;
    }

    .toc li {
      margin: 0.5em 0;
    }

    .toc a {
      text-decoration: none;
      color: ${colors.text};
      display: flex;
      justify-content: space-between;
    }

    .toc a:hover {
      color: ${colors.secondary};
    }

    .toc .page-number {
      color: ${colors.secondary};
      font-weight: 600;
    }
    `;
  }

  generateHeadingStyles(headings) {
    let styles = '';
    
    for (const [tag, style] of Object.entries(headings)) {
      if (style && typeof style === 'object') {
        styles += `
        ${tag} {
          ${Object.entries(style)
            .map(([prop, value]) => {
              // Convert camelCase to kebab-case
              const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              return `${cssProp}: ${value};`;
            })
            .join('\n          ')}
        }
        `;
      }
    }
    
    return styles;
  }

  generateHeaderFooterCSS() {
    const { header, footer } = this.config;
    
    if (!header.enabled && !footer.enabled) {
      return '';
    }

    // For infinite scroll PDFs, we'll use fixed positioning instead of @page
    return `
    ${header.enabled ? `
    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: ${header.margin};
      background: ${this.config.theme.colors.background};
      border-bottom: 1px solid ${this.config.theme.colors.border};
      display: flex;
      align-items: center;
      padding: 0 ${this.config.page.margins.left};
      font-size: ${header.fontSize};
      font-family: ${this.config.theme.font.family};
      z-index: 1000;
    }
    
    .header-left { flex: 1; text-align: left; }
    .header-center { flex: 1; text-align: center; }
    .header-right { flex: 1; text-align: right; }
    
    body { margin-top: ${header.margin}; }
    ` : ''}
    
    ${footer.enabled ? `
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: ${footer.margin};
      background: ${this.config.theme.colors.background};
      border-top: 1px solid ${this.config.theme.colors.border};
      display: flex;
      align-items: center;
      padding: 0 ${this.config.page.margins.left};
      font-size: ${footer.fontSize};
      font-family: ${this.config.theme.font.family};
      z-index: 1000;
    }
    
    .footer-left { flex: 1; text-align: left; }
    .footer-center { flex: 1; text-align: center; }
    .footer-right { flex: 1; text-align: right; }
    
    body { margin-bottom: ${footer.margin}; }
    ` : ''}
    `;
  }

  generateHeaderFooterHTML() {
    const { header, footer } = this.config;
    let html = '';

    if (header.enabled) {
      html += `
      <div class="header">
        <div class="header-left">${header.content.left}</div>
        <div class="header-center">${header.content.center}</div>
        <div class="header-right">${header.content.right}</div>
      </div>
      `;
    }

    if (footer.enabled) {
      html += `
      <div class="footer">
        <div class="footer-left">${footer.content.left}</div>
        <div class="footer-center">${footer.content.center}</div>
        <div class="footer-right">${footer.content.right}</div>
      </div>
      `;
    }

    return html;
  }
}

module.exports = ThemeEngine;