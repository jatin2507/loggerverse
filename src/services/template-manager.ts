import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';

/**
 * Template Manager for Handlebars templates
 */
export class TemplateManager {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private partials: Map<string, string> = new Map();
  private layouts: Map<string, HandlebarsTemplateDelegate> = new Map();
  private templateDir: string;
  private isDevelopment: boolean;

  constructor(isDevelopment: boolean = false) {
    this.isDevelopment = isDevelopment;

    // Get the directory path relative to the compiled JS file
    const currentDir = path.dirname(fileURLToPath(import.meta.url || 'file://' + __filename));
    this.templateDir = path.join(currentDir, '..', 'templates');

    this.initialize();
  }

  /**
   * Initialize templates, partials and layouts
   */
  private initialize(): void {
    // Register partials
    this.registerPartials();

    // Register helper functions
    this.registerHelpers();

    // Compile layouts
    this.compileLayouts();

    // Compile templates
    this.compileTemplates();
  }

  /**
   * Register Handlebars partials
   */
  private registerPartials(): void {
    try {
      const partialsDir = path.join(this.templateDir, 'partials');

      if (fs.existsSync(partialsDir)) {
        const files = fs.readdirSync(partialsDir);

        files.forEach(file => {
          try {
            if (file.endsWith('.hbs')) {
              const name = path.basename(file, '.hbs');
              const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
              this.partials.set(name, content);
              Handlebars.registerPartial(name, content);
            }
          } catch (error) {
            console.warn(`Failed to register partial ${file}:`, error);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to register partials:', error);
    }
  }

  /**
   * Register Handlebars helper functions
   */
  private registerHelpers(): void {
    // Conditional helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('lte', (a: any, b: any) => a <= b);
    Handlebars.registerHelper('gte', (a: any, b: any) => a >= b);

    // String helpers
    Handlebars.registerHelper('uppercase', (str: string) => str?.toUpperCase());
    Handlebars.registerHelper('lowercase', (str: string) => str?.toLowerCase());
    Handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Date helpers
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d?.toLocaleString();
    });

    // JSON helper
    Handlebars.registerHelper('json', (context: any) => {
      return JSON.stringify(context);
    });

    // Math helpers
    Handlebars.registerHelper('add', (a: number, b: number) => a + b);
    Handlebars.registerHelper('subtract', (a: number, b: number) => a - b);
    Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
    Handlebars.registerHelper('divide', (a: number, b: number) => a / b);

    // Array helpers
    Handlebars.registerHelper('length', (arr: any[]) => arr?.length || 0);
    Handlebars.registerHelper('first', (arr: any[]) => arr?.[0]);
    Handlebars.registerHelper('last', (arr: any[]) => arr?.[arr.length - 1]);

    // Log level color helper
    Handlebars.registerHelper('logLevelClass', (level: string) => {
      const levelMap: Record<string, string> = {
        debug: 'log-debug',
        info: 'log-info',
        warn: 'log-warn',
        error: 'log-error',
        fatal: 'log-fatal'
      };
      return levelMap[level?.toLowerCase()] || 'log-info';
    });
  }

  /**
   * Compile layout templates
   */
  private compileLayouts(): void {
    try {
      const layoutsDir = path.join(this.templateDir, 'layouts');

      if (fs.existsSync(layoutsDir)) {
        const files = fs.readdirSync(layoutsDir);

        files.forEach(file => {
          try {
            if (file.endsWith('.hbs')) {
              const name = path.basename(file, '.hbs');
              const content = fs.readFileSync(path.join(layoutsDir, file), 'utf8');
              this.layouts.set(name, Handlebars.compile(content));
            }
          } catch (error) {
            console.warn(`Failed to compile layout ${file}:`, error);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to compile layouts:', error);
    }
  }

  /**
   * Compile dashboard templates
   */
  private compileTemplates(): void {
    try {
      const dashboardDir = path.join(this.templateDir, 'dashboard');

      if (fs.existsSync(dashboardDir)) {
        const files = fs.readdirSync(dashboardDir);

        files.forEach(file => {
          try {
            if (file.endsWith('.hbs')) {
              const name = path.basename(file, '.hbs');
              const content = fs.readFileSync(path.join(dashboardDir, file), 'utf8');
              this.templates.set(name, Handlebars.compile(content));
            }
          } catch (error) {
            console.warn(`Failed to compile template ${file}:`, error);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to compile templates:', error);
    }
  }

  /**
   * Get compiled template
   */
  private getTemplate(name: string): HandlebarsTemplateDelegate | null {
    // In development, reload templates on each request
    if (this.isDevelopment) {
      this.compileTemplates();
    }

    return this.templates.get(name) || null;
  }

  /**
   * Get compiled layout
   */
  private getLayout(name: string): HandlebarsTemplateDelegate | null {
    // In development, reload layouts on each request
    if (this.isDevelopment) {
      this.compileLayouts();
    }

    return this.layouts.get(name) || null;
  }

  /**
   * Render a template with optional layout
   */
  render(
    templateName: string,
    data: any = {},
    options: {
      layout?: string;
      styles?: string;
      scripts?: string;
      customStyles?: string;
    } = {}
  ): string {
    const template = this.getTemplate(templateName);

    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Render the template
    const body = template(data);

    // If layout is specified, wrap in layout
    if (options.layout) {
      const layout = this.getLayout(options.layout);

      if (layout) {
        return layout({
          ...data,
          body,
          styles: options.styles,
          scripts: options.scripts,
          customStyles: options.customStyles
        });
      }
    }

    return body;
  }

  /**
   * Render inline template string
   */
  renderString(templateString: string, data: any = {}): string {
    const template = Handlebars.compile(templateString);
    return template(data);
  }

  /**
   * Check if template exists
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templates.clear();
    this.layouts.clear();
    this.initialize();
  }

  /**
   * Get dashboard styles
   */
  static getDashboardStyles(): string {
    return `
      :root {
        --bg-primary: #f8fafc;
        --bg-secondary: #ffffff;
        --bg-card: #ffffff;
        --text-primary: #1a202c;
        --text-secondary: #718096;
        --border: #e2e8f0;
        --accent: #667eea;
        --accent-light: #7f9cf5;
        --accent-dark: #5a67d8;
        --debug: #9f7aea;
        --info: #4299e1;
        --warn: #f6ad55;
        --error: #fc8181;
        --fatal: #f56565;
        --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg-primary);
        color: var(--text-primary);
        min-height: 100vh;
      }

      .dashboard {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      /* Add metric icon styles */
      .metric-icon {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        color: white;
      }

      .metric-icon-cpu {
        background: linear-gradient(135deg, #667eea, #5a67d8);
      }

      .metric-icon-memory {
        background: linear-gradient(135deg, #f687b3, #d53f8c);
      }

      .metric-icon-disk {
        background: linear-gradient(135deg, #48bb78, #38a169);
      }

      .metric-icon-system {
        background: linear-gradient(135deg, #ed8936, #dd6b20);
      }

      .metric-bar-memory {
        background: linear-gradient(135deg, #f687b3, #d53f8c);
      }

      .metric-bar-disk {
        background: linear-gradient(135deg, #48bb78, #38a169);
      }
    `;
  }

  /**
   * Get login styles
   */
  static getLoginStyles(): string {
    return `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
      }

      .login-container {
        background: white;
        padding: 2.5rem;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        width: 100%;
        max-width: 400px;
        animation: slideUp 0.4s ease-out;
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .logo {
        width: 60px;
        height: 60px;
        margin: 0 auto 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        color: white;
        box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
      }

      .login-header {
        text-align: center;
        margin-bottom: 2rem;
      }

      .login-header h1 {
        font-size: 1.75rem;
        font-weight: 600;
        color: #1a202c;
        margin-bottom: 0.5rem;
      }

      .login-header p {
        color: #718096;
        font-size: 0.9rem;
      }

      .form-group {
        margin-bottom: 1.5rem;
      }

      .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        color: #4a5568;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .form-group input {
        width: 100%;
        padding: 0.75rem 1rem;
        background: #f7fafc;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-size: 1rem;
        color: #2d3748;
        transition: all 0.2s;
      }

      .form-group input:focus {
        outline: none;
        border-color: #667eea;
        background: white;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .btn-login {
        width: 100%;
        padding: 0.875rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11);
      }

      .btn-login:hover {
        transform: translateY(-2px);
        box-shadow: 0 7px 14px rgba(50, 50, 93, 0.1);
      }

      .error-message {
        background: #fed7d7;
        color: #c53030;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1.25rem;
        display: none;
        font-size: 0.875rem;
        animation: shake 0.4s;
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
    `;
  }
}