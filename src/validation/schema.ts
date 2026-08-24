import { ValidationError } from '../errors/AppError';

export type Validator<T> = (value: unknown, path?: string) => T;

interface StringOptions {
  minLength?: number;
  trim?: boolean;
  pattern?: RegExp;
}

interface NumberOptions {
  integer?: boolean;
  min?: number;
  max?: number;
  coerce?: boolean;
}

interface ArrayOptions {
  minLength?: number;
}

interface ObjectOptions {
  allowUnknown?: boolean;
  requireAtLeastOne?: boolean;
}

const pathLabel = (path?: string) => path || 'value';

const fail = (message: string) => {
  throw new ValidationError(message);
};

export const stringField = (options: StringOptions = {}): Validator<string> => (value, path) => {
  if (typeof value !== 'string') {
    fail(`${pathLabel(path)} must be a string`);
  }

  const source = value as string;
  const normalized = options.trim === false ? source : source.trim();

  if (options.minLength && normalized.length < options.minLength) {
    fail(`${pathLabel(path)} must be at least ${options.minLength} characters`);
  }

  if (options.pattern && !options.pattern.test(normalized)) {
    fail(`${pathLabel(path)} is invalid`);
  }

  return normalized;
};

export const numberField = (options: NumberOptions = {}): Validator<number> => (value, path) => {
  const parsedValue: unknown = options.coerce && typeof value === 'string' ? Number(value) : value;

  if (typeof parsedValue !== 'number' || Number.isNaN(parsedValue)) {
    fail(`${pathLabel(path)} must be a number`);
  }

  const parsed = parsedValue as number;

  if (options.integer && !Number.isInteger(parsed)) {
    fail(`${pathLabel(path)} must be an integer`);
  }

  if (options.min !== undefined && parsed < options.min) {
    fail(`${pathLabel(path)} must be at least ${options.min}`);
  }

  if (options.max !== undefined && parsed > options.max) {
    fail(`${pathLabel(path)} must be at most ${options.max}`);
  }

  return parsed;
};

export const booleanField = (): Validator<boolean> => (value, path) => {
  if (typeof value !== 'boolean') {
    fail(`${pathLabel(path)} must be a boolean`);
  }

  return value as boolean;
};

export const enumField = <T extends string>(values: readonly T[]): Validator<T> => (value, path) => {
  const parsed = stringField({ minLength: 1 })(value, path);
  if (!values.includes(parsed as T)) {
    fail(`${pathLabel(path)} must be one of: ${values.join(', ')}`);
  }
  return parsed as T;
};

export const arrayField = <T>(itemValidator: Validator<T>, options: ArrayOptions = {}): Validator<T[]> => (value, path) => {
  if (!Array.isArray(value)) {
    fail(`${pathLabel(path)} must be an array`);
  }

  const source = value as unknown[];

  if (options.minLength !== undefined && source.length < options.minLength) {
    fail(`${pathLabel(path)} must contain at least ${options.minLength} item(s)`);
  }

  return source.map((item: unknown, index: number) => itemValidator(item, `${pathLabel(path)}[${index}]`));
};

export const optional = <T>(validator: Validator<T>): Validator<T | undefined> => (value, path) => {
  if (value === undefined) return undefined;
  return validator(value, path);
};

export const nullable = <T>(validator: Validator<T>): Validator<T | null> => (value, path) => {
  if (value === null) return null;
  return validator(value, path);
};

export const objectField = <T extends Record<string, unknown>>(
  shape: { [K in keyof T]: Validator<T[K]> },
  options: ObjectOptions = {}
): Validator<T> => (value, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${pathLabel(path)} must be an object`);
  }

  const source = value as Record<string, unknown>;
  const entries = Object.keys(shape) as Array<keyof T>;
  const result = {} as T;
  let providedKeys = 0;

  for (const key of entries) {
    const parsed = shape[key](source[key as string], path ? `${path}.${String(key)}` : String(key));
    if (parsed !== undefined) {
      providedKeys += 1;
    }
    result[key] = parsed;
  }

  if (!options.allowUnknown) {
    const unknownKeys = Object.keys(source).filter((key) => !entries.includes(key as keyof T));
    if (unknownKeys.length > 0) {
      fail(`${pathLabel(path)} contains unsupported fields: ${unknownKeys.join(', ')}`);
    }
  }

  if (options.requireAtLeastOne && providedKeys === 0) {
    fail(`${pathLabel(path)} must include at least one updatable field`);
  }

  return result;
};
