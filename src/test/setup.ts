import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

configure({ asyncUtilTimeout: 8_000 });

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
});
