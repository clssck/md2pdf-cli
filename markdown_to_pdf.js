#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { program } = require("commander");
const { marked } = require("marked");
const inquirer = require("inquirer").default || require("inquirer");
const chokidar = require("chokidar");
const chalk = require("chalk");
const ora = require("ora");
const glob = require("glob");
const ConfigManager = require("./lib/config");
const ThemeEngine = require("./lib/theme");

program
  .name("md2pdf")
  .description(
    "Convert Markdown (with Mermaid) to A4-wide, single-page, infinite-scroll PDF"
  )
  .version("1.0.0")
  .option("-i, --input <file>", "Input markdown file")
  .option("-o, --output <file>", "Output PDF file")
  .option("-c, --config <file>", "Config file path")
  .option("-t, --theme <name>", "Theme name (github, academic, corporate)")
  .option("-w, --watch", "Watch mode - regenerate PDF when markdown file changes")
  .option("-b, --batch <pattern>", "Batch process multiple files using glob pattern")
  .option("--interactive", "Interactive mode with prompts")
  .option("--title <title>", "Document title")
  .option("--author <author>", "Document author")
  .option("--page-numbers", "Enable page numbers")
  .option("--toc", "Generate table of contents")
  .option("--cover-page", "Generate cover page")
  .option("--init-config", "Create sample config file in current directory")
  .option("--list-themes", "List available themes")
  .parse(process.argv);

const options = program.opts();
const configManager = new ConfigManager();

// Handle special commands
if (options.listThemes) {
  console.log(chalk.blue('Available themes:'));
  configManager.getAvailableThemes().forEach(theme => {
    console.log(chalk.green(`  • ${theme}`));
  });
  process.exit(0);
}

if (options.initConfig) {
  const configPath = path.join(process.cwd(), 'md2pdf.config.json');
  if (configManager.createSampleConfig(configPath)) {
    console.log(chalk.green(`✅ Sample config created: ${configPath}`));
  } else {
    console.error(chalk.red('❌ Failed to create config file'));
    process.exit(1);
  }
  process.exit(0);
}

// Interactive mode or help when no arguments
async function runInteractiveMode() {
  console.log(chalk.blue.bold('\n📄 Welcome to md2pdf - Markdown to PDF Converter\n'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'input',
      message: 'Enter the path to your markdown file:',
      validate: (input) => {
        if (!input) return 'Please enter a file path';
        if (!fs.existsSync(input)) return 'File does not exist';
        if (!input.endsWith('.md') && !input.endsWith('.markdown')) {
          return 'Please select a markdown file (.md or .markdown)';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'output',
      message: 'Enter output PDF filename:',
      default: (answers) => {
        const baseName = path.basename(answers.input, path.extname(answers.input));
        return `${baseName}.pdf`;
      }
    },
    {
      type: 'confirm',
      name: 'watch',
      message: 'Enable watch mode (auto-regenerate on file changes)?',
      default: false
    }
  ]);
  
  return { ...answers, interactive: true };
}

async function main() {
  // Get merged configuration
  const config = configManager.getConfig(options);
  
  // Debug: show resolved footer content (optional)
  if (config.footer?.enabled && process.env.DEBUG) {
    console.log(chalk.gray(`Footer: "${config.footer.content.left}" | "${config.footer.content.right}"`));
  }
  
  let { input, output, watch, batch, interactive } = options;
  
  // If no input provided or interactive flag, run interactive mode
  if (!input || interactive) {
    const interactiveOptions = await runInteractiveMode();
    input = interactiveOptions.input;
    output = interactiveOptions.output;
    watch = interactiveOptions.watch;
  }
  
  // Handle batch processing
  if (batch) {
    const files = glob.sync(batch);
    if (files.length === 0) {
      console.error(chalk.red(`No files found matching pattern: ${batch}`));
      process.exit(1);
    }
    
    console.log(chalk.green(`Found ${files.length} files to process:`));
    files.forEach(file => console.log(chalk.gray(`  • ${file}`)));
    
    for (const file of files) {
      const outputFile = output || file.replace(/\.(md|markdown)$/i, '.pdf');
      await convertMarkdownToPdf(file, outputFile, config);
    }
    return;
  }
  
  // Validate single file input
  if (!input) {
    console.log(chalk.yellow('No input file specified. Use --help for usage information or run with --interactive'));
    process.exit(1);
  }
  
  if (!fs.existsSync(input)) {
    console.error(chalk.red(`Error: Input file not found - ${input}`));
    process.exit(1);
  }
  
  // Remove old config validation since we're using the new config system
  
  // Set default output filename
  if (!output) {
    const baseName = path.basename(input, path.extname(input));
    output = `${baseName}.pdf`;
  }
  
  // Initial conversion
  await convertMarkdownToPdf(input, output, config);
  
  // Watch mode
  if (watch) {
    console.log(chalk.blue(`\n👀 Watching ${input} for changes... (Press Ctrl+C to stop)`));
    
    const watcher = chokidar.watch(input, { ignoreInitial: true });
    watcher.on('change', async () => {
      console.log(chalk.yellow(`\n📝 File changed, regenerating PDF...`));
      await convertMarkdownToPdf(input, output, config);
    });
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log(chalk.blue('\n👋 Stopping watch mode...'));
      watcher.close();
      process.exit(0);
    });
  }
}

async function convertMarkdownToPdf(inputFile, outputFile, config) {
  const spinner = ora(`Converting ${chalk.cyan(inputFile)} to PDF...`).start();
  const themeEngine = new ThemeEngine(config);

// HTML template with Mermaid support
const htmlTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.document.title || 'Markdown to PDF'}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11.5.0/dist/mermaid.min.js"></script>
  <style>
    ${themeEngine.generateCSS()}
    ${themeEngine.generateHeaderFooterCSS()}
  </style>
</head>
<body>
  ${themeEngine.generateHeaderFooterHTML()}
  <div class="main-content">
    ${content}
  </div>
  <script>
    // Initialize Mermaid with high-contrast theme for better visibility
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      themeVariables: {
        // High contrast colors for better visibility
        primaryColor: '#f0f8ff',
        primaryTextColor: '#000000',
        primaryBorderColor: '#1f2937',
        lineColor: '#1f2937',
        secondaryColor: '#e0f2fe',
        tertiaryColor: '#fef3c7',
        background: '#ffffff',
        mainBkg: '#f0f8ff',
        secondBkg: '#e0f2fe',
        tertiaryBkg: '#fef3c7',
        // Strong borders and text
        nodeBorder: '#1f2937',
        clusterBkg: '#fef3c7',
        clusterBorder: '#d97706',
        defaultLinkColor: '#1f2937',
        titleColor: '#000000',
        edgeLabelBackground: '#ffffff',
        // Sequence diagram colors
        actorBkg: '#f0f8ff',
        actorBorder: '#1f2937',
        actorTextColor: '#000000',
        activationBorderColor: '#1f2937',
        activationBkgColor: '#e0f2fe',
        sequenceNumberColor: '#000000',
        // Flowchart colors
        nodeTextColor: '#000000',
        // Pie chart colors
        pie1: '#3b82f6',
        pie2: '#10b981',
        pie3: '#f59e0b',
        pie4: '#ef4444',
        pie5: '#8b5cf6',
        pie6: '#f97316',
        pie7: '#06b6d4',
        pie8: '#84cc16',
        pie9: '#ec4899',
        pie10: '#6366f1',
        pie11: '#14b8a6',
        pie12: '#f43f5e'
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      sequence: {
        useMaxWidth: true,
        actorMargin: 50,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35
      },
      gantt: {
        useMaxWidth: true
      },
      pie: {
        useMaxWidth: true
      },
      securityLevel: 'loose'
    });

    // Function to render all Mermaid diagrams
    async function renderMermaidDiagrams() {
      const mermaidElements = document.querySelectorAll('.mermaid');

      for (let i = 0; i < mermaidElements.length; i++) {
        const element = mermaidElements[i];
        const graphDefinition = element.textContent.trim();

        if (graphDefinition) {
          try {
            const { svg } = await mermaid.render(\`mermaid-\${i}\`, graphDefinition);
            element.innerHTML = svg;
            element.setAttribute('data-rendered', 'true');
          } catch (error) {
            console.error('Mermaid rendering error:', error);
            element.innerHTML = \`<div style="color: red; border: 1px solid red; padding: 10px;">Error rendering diagram: \${error.message}</div>\`;
            element.setAttribute('data-rendered', 'error');
          }
        }
      }
    }

    // Render diagrams when DOM is ready
    document.addEventListener('DOMContentLoaded', async function() {
      await renderMermaidDiagrams();
      // Signal that rendering is complete
      window.mermaidRenderingComplete = true;
    });
  </script>
</body>
</html>
`;

  try {
    // Read and process markdown
    const markdownContent = fs.readFileSync(inputFile, "utf8");

    // Configure marked with custom renderer for mermaid
    const renderer = new marked.Renderer();
    
    // Override code block rendering to handle mermaid
    renderer.code = function(code, language) {
      if (language === 'mermaid') {
        console.log("Creating mermaid div");
        return `<div class="mermaid">${code}</div>`;
      }
      
      // Default code block
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      
      return `<pre><code${language ? ` class="language-${language}"` : ''}>${escaped}</code></pre>`;
    };

    marked.setOptions({
      renderer: renderer,
      breaks: true,
      gfm: true,
    });

    const htmlContent = marked.parse(markdownContent);
    
    // Debug: check if Mermaid blocks were converted
    const mermaidMatches = htmlContent.match(/<div class="mermaid">/g);
    console.log(`Generated HTML contains ${mermaidMatches ? mermaidMatches.length : 0} mermaid blocks`);

    // Browser detection for cross-platform support
    async function findAvailableBrowser() {
      const browserPaths = {
        darwin: [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
        ],
        win32: [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
        ],
        linux: [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/microsoft-edge'
        ]
      };

      const platform = process.platform;
      const paths = browserPaths[platform] || browserPaths.linux;

      for (const browserPath of paths) {
        if (fs.existsSync(browserPath)) {
          console.log(`Found browser: ${path.basename(browserPath)}`);
          return browserPath;
        }
      }
      return null;
    }

    let browser;
    const detectedBrowser = await findAvailableBrowser();
    
    try {
      const launchOptions = {
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security"
        ]
      };

      // Use detected browser if found, otherwise let Puppeteer use bundled Chromium
      if (detectedBrowser) {
        launchOptions.executablePath = detectedBrowser;
      }

      browser = await puppeteer.launch(launchOptions);
    } catch (error) {
      spinner.fail(`Failed to launch browser.`);
      console.error(chalk.red(`\nError: ${error.message}`));
      console.error(chalk.yellow(`\nTroubleshooting:`));
      console.error(chalk.yellow(`1. Install Chrome, Edge, or Chromium`));
      console.error(chalk.yellow(`2. Run: npm install puppeteer (to get bundled Chromium)`));
      console.error(chalk.yellow(`3. Check: https://pptr.dev/troubleshooting`));
      throw error;
    }
    const page = await browser.newPage();

    // Ensure color rendering is enabled
    await page.emulateMediaType("print");

    // Set content and wait for Mermaid to render
    await page.setContent(htmlTemplate(htmlContent), {
      waitUntil: "networkidle0",
    });

    // Inject additional CSS to ensure color rendering and reduce background opacity
    await page.addStyleTag({
      content: `
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .mermaid {
          background: transparent !important;
          padding: 5px !important;
        }
        .mermaid svg {
          background: transparent !important;
        }
        .mermaid svg rect[fill],
        .mermaid svg path[fill],
        .mermaid svg circle[fill],
        .mermaid svg polygon[fill],
        .mermaid svg ellipse[fill] {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Force specific color rendering for common Mermaid elements */
        .mermaid svg .node rect,
        .mermaid svg .cluster rect {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `,
    });

    // Wait a moment for CSS to apply
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Wait for all Mermaid diagrams to render with improved detection
    try {
      console.log("Checking for Mermaid diagrams...");

      // Check if there are any mermaid elements
      const mermaidCount = await page.evaluate(() => {
        return document.querySelectorAll(".mermaid").length;
      });

      if (mermaidCount > 0) {
        console.log(`Found ${mermaidCount} Mermaid diagrams, waiting for rendering...`);
        
        // Wait longer for Mermaid to load and render
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force render any unrendered diagrams
        await page.evaluate(async () => {
          if (typeof mermaid !== 'undefined') {
            const mermaidElements = document.querySelectorAll(".mermaid:not([data-rendered])");
            for (let i = 0; i < mermaidElements.length; i++) {
              const element = mermaidElements[i];
              const graphDefinition = element.textContent.trim();
              
              if (graphDefinition) {
                try {
                  const { svg } = await mermaid.render(`diagram-${Date.now()}-${i}`, graphDefinition);
                  element.innerHTML = svg;
                  element.setAttribute('data-rendered', 'true');
                  console.log(`Rendered diagram ${i + 1}`);
                } catch (error) {
                  console.error('Mermaid rendering error:', error);
                  element.innerHTML = `<div style="color: red; border: 1px solid red; padding: 10px; border-radius: 4px;">❌ Diagram Error: ${error.message}</div>`;
                  element.setAttribute('data-rendered', 'error');
                }
              }
            }
          }
        });

        // Wait for rendering to complete
        await page.waitForFunction(
          () => {
            const mermaidElements = document.querySelectorAll(".mermaid");
            if (mermaidElements.length === 0) return true;
            
            return Array.from(mermaidElements).every(element => 
              element.hasAttribute("data-rendered")
            );
          },
          { timeout: 15000, polling: 500 }
        );

        // Additional verification - count rendered diagrams
        const diagramCount = await page.evaluate(() => {
          const elements = document.querySelectorAll(".mermaid");
          const rendered = document.querySelectorAll(".mermaid[data-rendered]");
          return { total: elements.length, rendered: rendered.length };
        });

        console.log(
          `Mermaid rendering complete: ${diagramCount.rendered}/${diagramCount.total} diagrams rendered`
        );

        // Post-process SVGs to enhance color rendering
        await page.evaluate(() => {
          const svgElements = document.querySelectorAll(".mermaid svg");
          svgElements.forEach((svg) => {
            // Force all fill attributes to be more vibrant
            const fillElements = svg.querySelectorAll("[fill]");
            fillElements.forEach((element) => {
              const fill = element.getAttribute("fill");
              if (fill && fill !== "none" && fill !== "transparent") {
                element.style.fill = fill;
                element.style.setProperty("fill", fill, "important");
              }
            });

            // Force stroke colors
            const strokeElements = svg.querySelectorAll("[stroke]");
            strokeElements.forEach((element) => {
              const stroke = element.getAttribute("stroke");
              if (stroke && stroke !== "none" && stroke !== "transparent") {
                element.style.stroke = stroke;
                element.style.setProperty("stroke", stroke, "important");
              }
            });
          });
        });
      } else {
        console.log("No Mermaid diagrams found");
      }
    } catch (e) {
      console.warn(
        "Warning: Mermaid diagrams may not have fully rendered:",
        e.message
      );

      // Fallback: try to render any remaining diagrams manually
      await page.evaluate(async () => {
        const unrenderedElements = document.querySelectorAll(
          ".mermaid:not([data-rendered])"
        );
        console.log(
          `Attempting to render ${unrenderedElements.length} remaining diagrams...`
        );

        for (let i = 0; i < unrenderedElements.length; i++) {
          const element = unrenderedElements[i];
          const graphDefinition = element.textContent.trim();

          if (graphDefinition) {
            try {
              const { svg } = await mermaid.render(
                `fallback-mermaid-${i}`,
                graphDefinition
              );
              element.innerHTML = svg;
              element.setAttribute("data-rendered", "true");
            } catch (error) {
              console.error("Fallback rendering failed:", error);
              element.setAttribute("data-rendered", "error");
            }
          }
        }
      });
    }

    // Calculate content height and page numbers for infinite scroll
    const { contentHeight, pageInfo } = await page.evaluate(() => {
      const height = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
      
      // Calculate approximate pages based on A4 height (297mm ≈ 1123px at 96dpi)
      const a4HeightPx = 1123;
      const totalPages = Math.ceil(height / a4HeightPx);
      
      return {
        contentHeight: height,
        pageInfo: {
          totalPages: totalPages,
          currentPage: 1 // For infinite scroll, we treat it as one continuous page
        }
      };
    });
    
    // Update header/footer content with page numbers
    if (config.header.enabled || config.footer.enabled) {
      await page.evaluate((pageInfo) => {
        const replacements = {
          '{{pageNumber}}': pageInfo.currentPage,
          '{{totalPages}}': pageInfo.totalPages
        };
        
        // Update header content
        document.querySelectorAll('.header-left, .header-center, .header-right').forEach(el => {
          let content = el.textContent;
          for (const [placeholder, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
          }
          el.textContent = content;
        });
        
        // Update footer content  
        document.querySelectorAll('.footer-left, .footer-center, .footer-right').forEach(el => {
          let content = el.textContent;
          for (const [placeholder, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
          }
          el.textContent = content;
        });
      }, pageInfo);
    }
    
    // Convert pixels to mm (at 96 DPI: 1px = 0.264583mm)
    const heightMm = Math.ceil(contentHeight * 0.264583);
    console.log(`Content height: ${contentHeight}px = ${heightMm}mm (≈${pageInfo.totalPages} A4 pages)`);

    // Generate infinite-scroll PDF with configured settings
    await page.pdf({
      path: outputFile,
      printBackground: config.output.printBackground,
      preferCSSPageSize: config.output.preferCSSPageSize,
      width: config.page.width,
      height: config.page.height === 'auto' ? `${heightMm}mm` : config.page.height,
      margin: config.page.margins,
      format: null, // Use custom dimensions
      displayHeaderFooter: config.output.displayHeaderFooter && (config.header.enabled || config.footer.enabled),
      omitBackground: config.output.omitBackground,
      timeout: config.output.timeout,
    });

    await browser.close();
    spinner.succeed(`PDF generated successfully: ${chalk.green(path.resolve(outputFile))}`);
  } catch (error) {
    spinner.fail(`Error generating PDF: ${error.message}`);
    console.error(chalk.red(error.stack));
    throw error;
  }
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});
