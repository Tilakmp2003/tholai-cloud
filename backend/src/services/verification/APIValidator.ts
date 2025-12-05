/**
 * Zero-Hallucination System: API Validator
 * 
 * Validates that code uses real JavaScript/TypeScript APIs.
 * Catches LLM hallucinations like:
 * - JSON.parseString (should be JSON.parse)
 * - Promise.wait (doesn't exist)
 * - Array.unique (doesn't exist)
 */

// Known valid methods on built-in objects
const VALID_APIS: Record<string, Set<string>> = {
  JSON: new Set(['parse', 'stringify']),
  Object: new Set([
    'keys', 'values', 'entries', 'assign', 'freeze', 'seal',
    'create', 'defineProperty', 'defineProperties', 'getOwnPropertyDescriptor',
    'getOwnPropertyDescriptors', 'getOwnPropertyNames', 'getOwnPropertySymbols',
    'getPrototypeOf', 'setPrototypeOf', 'is', 'isExtensible', 'isFrozen', 'isSealed',
    'preventExtensions', 'hasOwn', 'fromEntries'
  ]),
  Array: new Set([
    'isArray', 'from', 'of', 'prototype'
  ]),
  'Array.prototype': new Set([
    'at', 'concat', 'copyWithin', 'entries', 'every', 'fill', 'filter', 'find',
    'findIndex', 'findLast', 'findLastIndex', 'flat', 'flatMap', 'forEach',
    'includes', 'indexOf', 'join', 'keys', 'lastIndexOf', 'map', 'pop', 'push',
    'reduce', 'reduceRight', 'reverse', 'shift', 'slice', 'some', 'sort',
    'splice', 'toLocaleString', 'toReversed', 'toSorted', 'toSpliced',
    'toString', 'unshift', 'values', 'with', 'length'
  ]),
  String: new Set([
    'fromCharCode', 'fromCodePoint', 'raw', 'prototype'
  ]),
  'String.prototype': new Set([
    'at', 'charAt', 'charCodeAt', 'codePointAt', 'concat', 'endsWith', 'includes',
    'indexOf', 'lastIndexOf', 'localeCompare', 'match', 'matchAll', 'normalize',
    'padEnd', 'padStart', 'repeat', 'replace', 'replaceAll', 'search', 'slice',
    'split', 'startsWith', 'substring', 'toLocaleLowerCase', 'toLocaleUpperCase',
    'toLowerCase', 'toString', 'toUpperCase', 'trim', 'trimEnd', 'trimStart',
    'valueOf', 'length'
  ]),
  Promise: new Set([
    'all', 'allSettled', 'any', 'race', 'reject', 'resolve', 'withResolvers', 'prototype'
  ]),
  'Promise.prototype': new Set([
    'then', 'catch', 'finally'
  ]),
  Math: new Set([
    'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'cbrt',
    'ceil', 'clz32', 'cos', 'cosh', 'exp', 'expm1', 'floor', 'fround', 'hypot',
    'imul', 'log', 'log10', 'log1p', 'log2', 'max', 'min', 'pow', 'random',
    'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc',
    'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2'
  ]),
  console: new Set([
    'log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'dirxml',
    'table', 'time', 'timeEnd', 'timeLog', 'count', 'countReset',
    'group', 'groupCollapsed', 'groupEnd', 'clear', 'assert', 'profile', 'profileEnd'
  ]),
  fetch: new Set([]), // fetch is a function, not an object with methods
  Date: new Set([
    'now', 'parse', 'UTC', 'prototype'
  ]),
  Number: new Set([
    'isFinite', 'isInteger', 'isNaN', 'isSafeInteger', 'parseFloat', 'parseInt',
    'MAX_VALUE', 'MIN_VALUE', 'NaN', 'NEGATIVE_INFINITY', 'POSITIVE_INFINITY',
    'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER', 'EPSILON', 'prototype'
  ]),
  Map: new Set(['prototype', 'groupBy']),
  Set: new Set(['prototype']),
  RegExp: new Set(['prototype']),
  Error: new Set(['prototype', 'captureStackTrace', 'stackTraceLimit']),
};

// Common hallucinated methods that LLMs often generate
const HALLUCINATED_APIS: Record<string, string[]> = {
  JSON: ['parseString', 'parseObject', 'toObject', 'fromObject'],
  Array: ['unique', 'distinct', 'flatten', 'compact', 'first', 'last', 'isEmpty', 'remove'],
  'Array.prototype': ['unique', 'distinct', 'flatten', 'compact', 'first', 'last', 'isEmpty', 'remove', 'contains'],
  String: ['format', 'isEmpty', 'isBlank'],
  'String.prototype': ['isEmpty', 'isBlank', 'format', 'reverse', 'capitalize', 'camelCase', 'snakeCase', 'isEmail', 'isPhone', 'toPhone'],
  Promise: ['wait', 'sleep', 'delay', 'timeout', 'parallel', 'serial', 'first'],
  Object: ['isEmpty', 'clone', 'deepClone', 'merge', 'deepMerge'],
  fetch: ['get', 'post', 'put', 'delete', 'patch'], // fetch is a function!
  Math: ['clamp', 'lerp', 'map', 'constrain', 'radians', 'degrees'],
  console: ['success', 'fail', 'print', 'write', 'output'],
  // Browser APIs
  localStorage: ['save', 'load', 'put', 'get', 'add', 'delete', 'has', 'contains'],
  sessionStorage: ['save', 'load', 'put', 'get', 'add', 'delete', 'has', 'contains'],
  document: ['query', 'find', 'findElement', 'get', 'add', 'remove'],
  window: ['navigate', 'redirect', 'goto', 'openUrl'],
  // Date hallucinations
  Date: ['getFullDate', 'getFormattedDate', 'toFormat', 'format', 'diff', 'add', 'subtract'],
  'Date.prototype': ['getFullDate', 'getFormattedDate', 'toFormat', 'format', 'diff', 'add', 'subtract', 'isValid', 'isBefore', 'isAfter'],
};

// Fake framework methods
const HALLUCINATED_FRAMEWORK_APIS: Record<string, string[]> = {
  // Next.js
  'getServerData': [], // Should be getServerSideProps
  'getPageProps': [],  // Should be getServerSideProps or getStaticProps
  // Express
  'app.route': [],     // Should be app.get, app.post, etc.
  'app.listen': [],    // This one is valid but including for completeness
  // React lifecycle (class components)
  'onMount': [],       // Should be componentDidMount
  'onUnmount': [],     // Should be componentWillUnmount
  'onUpdate': [],      // Should be componentDidUpdate
  // Prisma
  'prisma.*.get': [],  // Should be findUnique or findFirst
  'prisma.*.find': [], // Should be findUnique or findMany
  'prisma.*.save': [], // Should be create or update
  'prisma.*.remove': [], // Should be delete
};

// Fake TypeScript utility types
const FAKE_TS_TYPES = [
  'Optional',    // Should be Partial
  'Required',    // This exists, but often confused
  'Strict',      // Doesn't exist
  'Mutable',     // Should use -readonly modifier
  'Nullable',    // Should use | null
  'NonNull',     // Should be NonNullable
  'DeepPartial', // Doesn't exist natively
  'DeepRequired', // Doesn't exist natively
];

// Fake npm packages that LLMs love to hallucinate
const FAKE_PACKAGES = new Set([
  'super-validator-pro',
  'advanced-utils',
  'easy-validation',
  'smart-parser',
  'auto-formatter',
  'magic-utils',
  'simple-auth',
  'quick-db',
  'fast-cache',
  'super-fetch',
  'easy-http',
  'quick-api',
  'email-validator-advanced',
  'phone-checker-pro',
  'validation-helper',
  'form-validator-pro',
]);

export interface APIValidationResult {
  isValid: boolean;
  errors: string[];
}

export class APIValidator {
  /**
   * Validate that code uses real APIs
   */
  validate(code: string): APIValidationResult {
    const errors: string[] = [];

    // Check for hallucinated static methods
    for (const [obj, methods] of Object.entries(HALLUCINATED_APIS)) {
      for (const method of methods) {
        const pattern = new RegExp(`\\b${obj.replace('.', '\\.')}\\.${method}\\b`, 'g');
        if (pattern.test(code)) {
          errors.push(`Hallucinated API: ${obj}.${method} does not exist`);
        }
      }
    }

    // Check for hallucinated framework methods
    errors.push(...this.checkFrameworkAPIs(code));

    // Check for fake TypeScript types
    errors.push(...this.checkTypeScriptTypes(code));

    // Check for fake imports
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const pkg = match[1];
      if (FAKE_PACKAGES.has(pkg)) {
        errors.push(`Hallucinated package: '${pkg}' does not exist`);
      }
      // Check for suspicious package names
      if (this.isSuspiciousPackage(pkg)) {
        errors.push(`Suspicious package: '${pkg}' may not exist (verify manually)`);
      }
    }

    // Check for React hooks that don't exist
    const fakeHooks = this.findFakeReactHooks(code);
    errors.push(...fakeHooks.map(h => `Hallucinated React hook: ${h} does not exist`));

    // Check for instance method hallucinations (like str.isEmpty())
    errors.push(...this.checkInstanceMethods(code));

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for hallucinated framework APIs
   */
  private checkFrameworkAPIs(code: string): string[] {
    const errors: string[] = [];

    // Next.js
    if (/export\s+(async\s+)?function\s+getServerData/.test(code)) {
      errors.push('Hallucinated Next.js API: getServerData should be getServerSideProps');
    }
    if (/export\s+(async\s+)?function\s+getPageProps/.test(code)) {
      errors.push('Hallucinated Next.js API: getPageProps should be getServerSideProps or getStaticProps');
    }

    // Express
    if (/app\.route\s*\(/.test(code) && !/router\.route\s*\(/.test(code)) {
      errors.push('Hallucinated Express API: app.route() is not a valid pattern, use app.get/post/put/delete');
    }

    // React lifecycle (class components)
    if (/\bonMount\s*\(/.test(code) && /class.*extends.*Component/.test(code)) {
      errors.push('Hallucinated React lifecycle: onMount should be componentDidMount');
    }
    if (/\bonUnmount\s*\(/.test(code) && /class.*extends.*Component/.test(code)) {
      errors.push('Hallucinated React lifecycle: onUnmount should be componentWillUnmount');
    }

    // Prisma
    if (/prisma\.\w+\.get\s*\(/.test(code)) {
      errors.push('Hallucinated Prisma API: .get() should be .findUnique() or .findFirst()');
    }

    return errors;
  }

  /**
   * Check for fake TypeScript utility types
   */
  private checkTypeScriptTypes(code: string): string[] {
    const errors: string[] = [];

    for (const fakeType of FAKE_TS_TYPES) {
      // Match type<Type> or type <Type>
      const pattern = new RegExp(`\\b${fakeType}\\s*<`, 'g');
      if (pattern.test(code)) {
        errors.push(`Hallucinated TypeScript type: ${fakeType}<T> does not exist`);
      }
    }

    return errors;
  }

  /**
   * Check for method calls on instances that don't exist
   */
  private checkInstanceMethods(code: string): string[] {
    const errors: string[] = [];

    // String instance methods that don't exist
    const fakeStringMethods = /\.\s*(isEmpty|isBlank|isEmail|isPhone|toPhone)\s*\(/g;
    if (fakeStringMethods.test(code)) {
      errors.push('Hallucinated String method: .isEmpty(), .isBlank(), .isEmail(), .isPhone() do not exist on strings');
    }

    // Date instance methods that don't exist
    const fakeDateMethods = /\.\s*(getFullDate|toFormat|format)\s*\(/g;
    if (fakeDateMethods.test(code)) {
      errors.push('Hallucinated Date method: .getFullDate(), .toFormat(), .format() do not exist on Date');
    }

    // Array instance methods that don't exist
    const fakeArrayMethods = /\.\s*(unique|distinct)\s*\(/g;
    if (fakeArrayMethods.test(code)) {
      errors.push('Hallucinated Array method: .unique(), .distinct() do not exist on Array');
    }

    return errors;
  }

  /**
   * Check if a package name looks suspicious
   */
  private isSuspiciousPackage(pkg: string): boolean {
    // Skip common valid packages
    const knownValid = new Set([
      'react', 'react-dom', 'next', 'express', 'axios', 'lodash', 'moment',
      'dayjs', 'date-fns', 'uuid', 'zod', 'yup', 'joi', 'fs', 'path', 'os',
      'crypto', 'http', 'https', 'url', 'querystring', 'stream', 'buffer',
      'events', 'util', 'child_process', '@prisma/client', 'prisma',
      'typescript', 'ts-node', 'esbuild', 'webpack', 'vite', 'rollup',
      '@types/node', '@types/react', 'tailwindcss', 'postcss', 'autoprefixer',
    ]);
    
    if (knownValid.has(pkg) || pkg.startsWith('@types/')) {
      return false;
    }

    // Suspicious patterns
    const suspiciousPatterns = [
      /^(super|fast|quick|easy|simple|auto|magic|smart|advanced|ultimate)-/i,
      /-pro$/i,
      /-plus$/i,
      /-advanced$/i,
      /-ultimate$/i,
    ];

    return suspiciousPatterns.some(p => p.test(pkg));
  }

  /**
   * Find fake React hooks
   */
  private findFakeReactHooks(code: string): string[] {
    const validHooks = new Set([
      'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
      'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect',
      'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
      'useSyncExternalStore', 'useInsertionEffect', 'useOptimistic',
      'useFormStatus', 'useFormState', 'useActionState', // React 19
    ]);

    const hookPattern = /\buse[A-Z][a-zA-Z]*\b/g;
    const fakeHooks: string[] = [];
    
    let match;
    while ((match = hookPattern.exec(code)) !== null) {
      const hook = match[0];
      if (!validHooks.has(hook)) {
        fakeHooks.push(hook);
      }
    }

    return fakeHooks;
  }
}

export const apiValidator = new APIValidator();
