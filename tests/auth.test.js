import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  decodeJwtPayload, 
  createSessionFromToken, 
  saveSession, 
  clearSession, 
  loadSession,
  isAllowedRole
} from '../src/lib/auth';

describe('auth.js logic', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  describe('decodeJwtPayload', () => {
    it('should return null for invalid tokens', () => {
      expect(decodeJwtPayload('invalid')).toBeNull();
      expect(decodeJwtPayload('one.two')).toBeNull();
    });

    it('should decode a valid JWT payload', () => {
      // Mocking a simple base64 payload: {"role":"Admin","user_id":1}
      const payload = btoa(JSON.stringify({ role: 'Admin', user_id: 1 }));
      const token = `header.${payload}.signature`;
      const result = decodeJwtPayload(token);
      expect(result).toEqual({ role: 'Admin', user_id: 1 });
    });
  });

  describe('createSessionFromToken', () => {
    it('should return null if payload is missing role or user_id', () => {
      const payload = btoa(JSON.stringify({ something: 'else' }));
      const token = `header.${payload}.signature`;
      expect(createSessionFromToken(token)).toBeNull();
    });

    it('should create a valid session object', () => {
      const payloadObj = { role: 'Teacher', user_id: 123, expiry: 9999999999 };
      const payload = btoa(JSON.stringify(payloadObj));
      const token = `header.${payload}.signature`;
      const session = createSessionFromToken(token, 'testuser');
      
      expect(session).toEqual({
        token,
        role: 'Teacher',
        userId: '123',
        username: 'testuser',
        firstName: '',
        lastName: '',
        email: '',
        mustChangePassword: false,
        expiry: 9999999999
      });
    });
  });

  describe('Session Storage', () => {
    it('saveSession should call localStorage.setItem', () => {
      const session = { token: 'abc', role: 'Admin' };
      saveSession(session);
      expect(localStorage.setItem).toHaveBeenCalledWith('dashboard_auth_session', JSON.stringify(session));
    });

    it('clearSession should call localStorage.removeItem', () => {
      clearSession();
      expect(localStorage.removeItem).toHaveBeenCalledWith('dashboard_auth_session');
    });

    it('loadSession should return session if valid', () => {
      const session = { token: 'abc', role: 'Admin', expiry: Date.now() / 1000 + 1000 };
      localStorage.getItem.mockReturnValue(JSON.stringify(session));
      expect(loadSession()).toEqual(session);
    });

    it('loadSession should clear and return null if expired', () => {
      const session = { token: 'abc', role: 'Admin', expiry: Date.now() / 1000 - 1000 };
      localStorage.getItem.mockReturnValue(JSON.stringify(session));
      expect(loadSession()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('isAllowedRole', () => {
    it('should return true if role is in allowed roles', () => {
      expect(isAllowedRole('Admin', ['Admin', 'Teacher'])).toBe(true);
    });

    it('should return false if role is not in allowed roles', () => {
      expect(isAllowedRole('Parent', ['Admin', 'Teacher'])).toBe(false);
    });
  });
});
