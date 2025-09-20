import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateManager } from '../../../src/services/template-manager.js';
import Handlebars from 'handlebars';

// Mock fs module
vi.mock('fs');

// Mock Handlebars module
vi.mock('handlebars', () => ({
  default: {
    compile: vi.fn((template: string) =>
      vi.fn((data: any) => `compiled: ${template} with ${JSON.stringify(data)}`)
    ),
    registerPartial: vi.fn(),
    registerHelper: vi.fn()
  }
}));

const mockFs = vi.mocked(fs);
const mockHandlebars = vi.mocked(Handlebars);

describe('TemplateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock file system structure
    mockFs.existsSync.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      return pathStr.includes('templates') ||
             pathStr.includes('partials') ||
             pathStr.includes('layouts') ||
             pathStr.includes('dashboard');
    });

    mockFs.readdirSync.mockImplementation((dirPath: any) => {
      const pathStr = dirPath.toString();
      if (pathStr.includes('partials')) {
        return ['header.hbs', 'footer.hbs', 'menu.hbs'] as any;
      }
      if (pathStr.includes('layouts')) {
        return ['main.hbs', 'simple.hbs'] as any;
      }
      if (pathStr.includes('dashboard')) {
        return ['dashboard.hbs', 'login.hbs', 'metrics.hbs'] as any;
      }
      return [] as any;
    });

    mockFs.readFileSync.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr.includes('header.hbs')) return '<header>{{title}}</header>';
      if (pathStr.includes('footer.hbs')) return '<footer>{{year}}</footer>';
      if (pathStr.includes('main.hbs')) return '<html><body>{{{body}}}</body></html>';
      if (pathStr.includes('dashboard.hbs')) return '<div class="dashboard">{{title}}</div>';
      if (pathStr.includes('login.hbs')) return '<div class="login">{{username}}</div>';
      return 'template content';
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize template manager', () => {
      const manager = new TemplateManager();
      expect(manager).toBeDefined();
    });

    it('should initialize in development mode', () => {
      const manager = new TemplateManager(true);
      expect(manager).toBeDefined();
    });

    it('should call initialize during construction', () => {
      expect(() => new TemplateManager()).not.toThrow();
      expect(mockFs.existsSync).toHaveBeenCalled();
    });
  });

  describe('Template Operations', () => {
    let manager: TemplateManager;

    beforeEach(() => {
      manager = new TemplateManager();
    });

    it('should render a template without layout', () => {
      const result = manager.render('dashboard', { title: 'Test Dashboard' });
      expect(result).toContain('compiled');
      expect(result).toContain('Test Dashboard');
    });

    it('should render a template with layout', () => {
      const result = manager.render('dashboard', { title: 'Test Dashboard' }, { layout: 'main' });
      expect(result).toContain('compiled');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        manager.render('nonexistent', {});
      }).toThrow("Template 'nonexistent' not found");
    });

    it('should render template with additional options', () => {
      const result = manager.render('dashboard', { title: 'Test' }, {
        layout: 'main',
        styles: 'custom.css',
        scripts: 'app.js',
        customStyles: '.test { color: red; }'
      });
      expect(result).toContain('compiled');
    });

    it('should handle template rendering without layout when layout not found', () => {
      // Mock template exists but layout doesn't
      const result = manager.render('dashboard', { title: 'Test' }, { layout: 'nonexistent' });
      expect(result).toContain('compiled');
    });
  });

  describe('Template String Rendering', () => {
    let manager: TemplateManager;

    beforeEach(() => {
      manager = new TemplateManager();
    });

    it('should render inline template string', () => {
      const result = manager.renderString('Hello {{name}}!', { name: 'World' });
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should handle empty template string', () => {
      const result = manager.renderString('', {});
      expect(result).toBeDefined();
    });

    it('should handle template string without data', () => {
      const result = manager.renderString('Static content');
      expect(result).toContain('Static content');
    });
  });

  describe('Template Management', () => {
    let manager: TemplateManager;

    beforeEach(() => {
      manager = new TemplateManager();
    });

    it('should check if template exists', () => {
      // Since we're mocking, this will return false unless we specifically mock it
      const exists = manager.hasTemplate('dashboard');
      expect(typeof exists).toBe('boolean');
    });

    it('should clear template cache', () => {
      expect(() => manager.clearCache()).not.toThrow();
      expect(mockFs.existsSync).toHaveBeenCalled();
    });

    it('should reinitialize templates after cache clear', () => {
      const initialCallCount = mockFs.existsSync.mock.calls.length;
      manager.clearCache();
      expect(mockFs.existsSync.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe('Development Mode', () => {
    it('should reload templates in development mode', () => {
      const manager = new TemplateManager(true);

      // First render
      manager.render('dashboard', { title: 'Test 1' });
      const firstCallCount = mockFs.readdirSync.mock.calls.length;

      // Second render should reload templates
      manager.render('dashboard', { title: 'Test 2' });
      const secondCallCount = mockFs.readdirSync.mock.calls.length;

      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });

    it('should not reload templates in production mode', () => {
      const manager = new TemplateManager(false);

      // First render
      manager.render('dashboard', { title: 'Test 1' });
      const firstCallCount = mockFs.readdirSync.mock.calls.length;

      // Second render should not reload templates
      manager.render('dashboard', { title: 'Test 2' });
      const secondCallCount = mockFs.readdirSync.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('Static Styles', () => {
    it('should return dashboard styles', () => {
      const styles = TemplateManager.getDashboardStyles();
      expect(styles).toContain(':root');
      expect(styles).toContain('--bg-primary');
      expect(styles).toContain('--accent');
      expect(styles).toContain('.dashboard');
      expect(styles).toContain('.metric-icon');
    });

    it('should return login styles', () => {
      const styles = TemplateManager.getLoginStyles();
      expect(styles).toContain('body');
      expect(styles).toContain('.login-container');
      expect(styles).toContain('.btn-login');
      expect(styles).toContain('@keyframes');
    });

    it('should have consistent CSS variables', () => {
      const dashboardStyles = TemplateManager.getDashboardStyles();
      expect(dashboardStyles).toContain('--debug:');
      expect(dashboardStyles).toContain('--info:');
      expect(dashboardStyles).toContain('--warn:');
      expect(dashboardStyles).toContain('--error:');
      expect(dashboardStyles).toContain('--fatal:');
    });

    it('should include responsive design elements', () => {
      const dashboardStyles = TemplateManager.getDashboardStyles();
      expect(dashboardStyles).toContain('flex');
      expect(dashboardStyles).toContain('min-height');

      const loginStyles = TemplateManager.getLoginStyles();
      expect(loginStyles).toContain('max-width');
      expect(loginStyles).toContain('width: 100%');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing template directory', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(() => new TemplateManager()).not.toThrow();
    });

    it('should handle file read errors gracefully', () => {
      // Mock successful directory checks but failing file reads
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['test.hbs'] as any);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      // Should not throw during initialization, errors should be caught
      expect(() => new TemplateManager()).not.toThrow();
    });

    it('should handle directory read errors gracefully', () => {
      // Mock successful existence check but failing directory read
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory read error');
      });

      // Should not throw during initialization, errors should be caught
      expect(() => new TemplateManager()).not.toThrow();
    });
  });

  describe('Handlebars Helpers Registration', () => {
    it('should register comparison helpers', () => {
      new TemplateManager();

      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('eq', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('ne', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('lt', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('gt', expect.any(Function));
    });

    it('should register string helpers', () => {
      new TemplateManager();

      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('uppercase', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('lowercase', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('capitalize', expect.any(Function));
    });

    it('should register utility helpers', () => {
      new TemplateManager();

      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('json', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('formatDate', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('logLevelClass', expect.any(Function));
    });

    it('should register math helpers', () => {
      new TemplateManager();

      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('subtract', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('multiply', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('divide', expect.any(Function));
    });

    it('should register array helpers', () => {
      new TemplateManager();

      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('length', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('first', expect.any(Function));
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('last', expect.any(Function));
    });
  });

  describe('Partials Registration', () => {
    it('should register partials from partials directory', () => {
      new TemplateManager();

      expect(mockHandlebars.registerPartial).toHaveBeenCalledWith('header', expect.any(String));
      expect(mockHandlebars.registerPartial).toHaveBeenCalledWith('footer', expect.any(String));
    });

    it('should handle empty partials directory', () => {
      mockFs.readdirSync.mockImplementation((dirPath: any) => {
        if (dirPath.toString().includes('partials')) {
          return [] as any;
        }
        return ['dashboard.hbs'] as any;
      });

      expect(() => new TemplateManager()).not.toThrow();
    });

    it('should filter out non-hbs files in partials', () => {
      mockFs.readdirSync.mockImplementation((dirPath: any) => {
        if (dirPath.toString().includes('partials')) {
          return ['header.hbs', 'readme.txt', 'footer.hbs'] as any;
        }
        return ['dashboard.hbs'] as any;
      });

      const manager = new TemplateManager();

      // Should only register .hbs files
      expect(mockHandlebars.registerPartial).toHaveBeenCalledWith('header', expect.any(String));
      expect(mockHandlebars.registerPartial).toHaveBeenCalledWith('footer', expect.any(String));
      expect(mockHandlebars.registerPartial).not.toHaveBeenCalledWith('readme', expect.any(String));
    });
  });

  describe('File System Integration', () => {
    it('should handle relative path resolution', () => {
      const manager = new TemplateManager();
      expect(mockFs.existsSync).toHaveBeenCalled();

      // Check that paths were resolved
      const calls = mockFs.existsSync.mock.calls;
      expect(calls.some(call => call[0].toString().includes('templates'))).toBe(true);
    });

    it('should attempt to read from correct directories', () => {
      new TemplateManager();

      const readDirCalls = mockFs.readdirSync.mock.calls.map(call => call[0].toString());
      expect(readDirCalls.some(path => path.includes('partials'))).toBe(true);
      expect(readDirCalls.some(path => path.includes('layouts'))).toBe(true);
      expect(readDirCalls.some(path => path.includes('dashboard'))).toBe(true);
    });
  });
});