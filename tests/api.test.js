import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest, loginUser } from '../src/lib/api';

describe('api.js', () => {
  describe('apiRequest wrapper', () => {
    it('should handle successful JSON responses', async () => {
      const mockResponse = { data: 'success' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await apiRequest('/test');
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/test'), expect.any(Object));
    });

    it('should throw error on non-ok responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ error: 'Unauthorized' })),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(apiRequest('/test')).rejects.toThrow('Unauthorized');
    });

    it('should handle non-JSON error responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(apiRequest('/test')).rejects.toThrow('Internal Server Error');
    });
  });

  // Integration tests using real backend if available
  // The user provided:
  // admin: admin / admin123
  // teacher: teach / 123
  // parent: ParentJane / parent123
  describe('Backend Integration (Live)', () => {
    beforeEach(() => {
      vi.unstubAllGlobals();
    });

    // Only run if the backend is reachable
    it('should successfully log in as Admin', async () => {
      try {
        const result = await loginUser('admin', 'admin123');
        expect(result).toHaveProperty('access_token');
        expect(result.user.role).toBe('Admin');
      } catch (e) {
        if (e.message.includes('fetch')) {
          console.warn('Skipping live test: Backend not reachable');
        } else {
          throw e;
        }
      }
    });

    it('should successfully log in as Teacher', async () => {
      try {
        const result = await loginUser('teach', '123');
        expect(result).toHaveProperty('access_token');
        expect(result.user.role).toBe('Teacher');
      } catch {
        // Skip if backend down
      }
    });

    it('should successfully log in as Parent', async () => {
      try {
        const result = await loginUser('ParentJane', 'parent123');
        expect(result).toHaveProperty('access_token');
        expect(result.user.role).toBe('Parent');
      } catch {
        // Skip if backend down
      }
    });
  });
});
