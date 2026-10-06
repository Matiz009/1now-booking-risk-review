// Adds matchers like toBeInTheDocument() / toBeDisabled() to Vitest's expect.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// We run with globals: false, so RTL's automatic cleanup doesn't register
// itself. Unmounting between tests keeps one test's DOM out of the next.
afterEach(() => {
  cleanup();
});
