const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.defaultConfig = null;
    this.themes = new Map();
    this.loadDefaults();
  }

  loadDefaults() {
    // Load default configuration
    const defaultPath = path.join(__dirname, '../config/default.json');
    this.defaultConfig = this.loadJSON(defaultPath);

    // Load all themes
    const themesDir = path.join(__dirname, '../config/themes');
    if (fs.existsSync(themesDir)) {
      const themeFiles = fs.readdirSync(themesDir).filter(f => f.endsWith('.json'));
      for (const themeFile of themeFiles) {
        const themePath = path.join(themesDir, themeFile);
        const theme = this.loadJSON(themePath);
        if (theme) {
          this.themes.set(theme.name, theme);
        }
      }
    }
  }

  loadJSON(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Warning: Could not load config from ${filePath}: ${error.message}`);
    }
    return null;
  }

  // Get configuration from multiple sources with precedence:
  // 1. Command line options (highest priority)
  // 2. Project config file (md2pdf.config.json in current directory)
  // 3. User config file (~/.md2pdf/config.json)
  // 4. Default config (lowest priority)
  getConfig(cliOptions = {}) {
    let config = { ...this.defaultConfig };

    // Load user config
    const userConfigPath = path.join(os.homedir(), '.md2pdf', 'config.json');
    const userConfig = this.loadJSON(userConfigPath);
    if (userConfig) {
      config = this.mergeConfig(config, userConfig);
    }

    // Load project config
    const projectConfigPath = path.join(process.cwd(), 'md2pdf.config.json');
    const projectConfig = this.loadJSON(projectConfigPath);
    if (projectConfig) {
      config = this.mergeConfig(config, projectConfig);
    }

    // Load specified config file
    if (cliOptions.config) {
      const specifiedConfig = this.loadJSON(cliOptions.config);
      if (specifiedConfig) {
        config = this.mergeConfig(config, specifiedConfig);
      }
    }

    // Apply theme if specified
    if (cliOptions.theme || config.theme?.name) {
      const themeName = cliOptions.theme || config.theme.name;
      const theme = this.themes.get(themeName);
      if (theme) {
        config.theme = this.mergeConfig(config.theme, theme);
      } else {
        console.warn(`Warning: Theme '${themeName}' not found. Using default theme.`);
      }
    }

    // Override with CLI options
    config = this.mergeConfig(config, this.cliToConfig(cliOptions));

    // Resolve template variables
    config = this.resolveVariables(config);

    return config;
  }

  mergeConfig(base, override) {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfig(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  cliToConfig(cliOptions) {
    const config = {};

    // Map CLI options to config structure
    if (cliOptions.input) config.input = cliOptions.input;
    if (cliOptions.output) config.output = cliOptions.output;
    if (cliOptions.theme) config.theme = { name: cliOptions.theme };
    if (cliOptions.title) config.document = { ...config.document, title: cliOptions.title };
    if (cliOptions.author) config.document = { ...config.document, author: cliOptions.author };
    if (cliOptions.pageNumbers) config.footer = { ...config.footer, enabled: true };
    if (cliOptions.toc) config.toc = { ...config.toc, enabled: true };
    if (cliOptions.coverPage) config.coverPage = { ...config.coverPage, enabled: true };

    return config;
  }

  resolveVariables(config) {
    const variables = {
      date: new Date().toLocaleDateString(),
      datetime: new Date().toLocaleString(),
      year: new Date().getFullYear(),
      pageNumber: '{{pageNumber}}', // Will be resolved by PDF generator
      totalPages: '{{totalPages}}', // Will be resolved by PDF generator
      document: config.document || {}
    };

    const resolved = JSON.parse(JSON.stringify(config));
    
    function resolveValue(obj) {
      if (typeof obj === 'string') {
        return obj.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          const keys = key.split('.');
          let value = variables;
          for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
          }
          return value !== undefined ? value : match;
        });
      } else if (Array.isArray(obj)) {
        return obj.map(resolveValue);
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = resolveValue(value);
        }
        return result;
      }
      return obj;
    }

    return resolveValue(resolved);
  }

  getAvailableThemes() {
    return Array.from(this.themes.keys());
  }

  getTheme(name) {
    return this.themes.get(name);
  }

  // Create a sample config file
  createSampleConfig(filePath) {
    const sampleConfig = {
      theme: {
        name: "github"
      },
      document: {
        title: "My Document",
        author: "Your Name"
      },
      footer: {
        enabled: true,
        content: {
          left: "{{document.author}}",
          center: "",
          right: "Page {{pageNumber}} of {{totalPages}}"
        }
      },
      toc: {
        enabled: true,
        title: "Table of Contents",
        maxDepth: 3
      }
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(sampleConfig, null, 2));
      return true;
    } catch (error) {
      console.error(`Error creating sample config: ${error.message}`);
      return false;
    }
  }
}

module.exports = ConfigManager;