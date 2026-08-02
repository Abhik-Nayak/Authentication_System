import { paginated, parsePagination } from './pagination';

describe('parsePagination', () => {
  it('defaults to page 1, limit 20 when nothing is supplied', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('tolerates a missing query object entirely', () => {
    expect(parsePagination(undefined)).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('parses query strings, which is all Express ever provides', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('clamps rather than rejects out-of-range input', () => {
    expect(parsePagination({ page: '-3' }).page).toBe(1);
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ limit: '0' }).limit).toBe(1);
  });

  it('caps limit at 100 so ?limit=1000000 cannot exhaust the database', () => {
    expect(parsePagination({ limit: '1000000' }).limit).toBe(100);
  });

  it('falls back to defaults on non-numeric junk', () => {
    expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('computes skip from the clamped values, not the raw ones', () => {
    expect(parsePagination({ page: '2', limit: '5000' }).skip).toBe(100);
  });
});

describe('paginated', () => {
  it('builds the envelope every list endpoint returns', () => {
    const params = parsePagination({ page: '2', limit: '20' });
    expect(paginated(['a', 'b'], 137, params)).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, limit: 20, total: 137, totalPages: 7 },
    });
  });

  it('rounds partial pages up', () => {
    expect(paginated([], 21, parsePagination({ limit: '20' })).meta.totalPages).toBe(2);
  });

  it('reports 0 pages for an empty result, never 1', () => {
    expect(paginated([], 0, parsePagination({})).meta.totalPages).toBe(0);
  });

  it('reports exactly 1 page when the total fills it precisely', () => {
    expect(paginated([], 20, parsePagination({ limit: '20' })).meta.totalPages).toBe(1);
  });
});
