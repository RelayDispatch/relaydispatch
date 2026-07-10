import { describe, it, expect } from 'vitest';

process.env.SUPABASE_URL = 'https://mock-supabase.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key-123';
process.env.VAULT_ENCRYPTION_KEY = 'cc2df5bd177d37b8e2f3c20c54278818d4071bee82f7c704322ca863224155b2';
process.env.OPENROUTER_API_KEY = 'mock-or-key-123';
process.env.NYLAS_API_KEY = 'mock-nylas-key-123';

const { stripHtmlTags } = await import('../../apps/worker/src/activities/shared.ts');

describe('stripHtmlTags', () => {
  it('should strip basic HTML tags', () => {
    const input = '<h3>Service Request</h3><p>Need AC repair ASAP.</p>';
    expect(stripHtmlTags(input)).toBe('Service Request\n\nNeed AC repair ASAP.');
  });

  it('should completely ignore style and script tags and contents', () => {
    const input = '<script>alert("hack");</script><style>body { color: red; }</style><span>Safe Text</span>';
    expect(stripHtmlTags(input)).toBe('Safe Text');
  });

  it('should decode standard HTML entities safely', () => {
    const input = 'A &amp; B &lt; C &gt; D &quot; E &nbsp; F';
    expect(stripHtmlTags(input)).toBe('A & B < C > D " E   F');
  });

  it('should handle nested tags and malformed HTML gracefully', () => {
    const input = '<div>Unclosed <b>nested <span>tags';
    expect(stripHtmlTags(input)).toContain('Unclosed nested tags');
  });

  it('should handle null/empty strings safely', () => {
    expect(stripHtmlTags('')).toBe('');
    expect(stripHtmlTags(null as any)).toBe('');
  });
});
