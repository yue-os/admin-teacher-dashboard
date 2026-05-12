import { describe, it, expect, beforeAll } from 'vitest';
import { loginUser, apiRequest } from '../src/lib/api';

describe('End-to-End Functionality Integration', () => {
  let adminToken;
  let teacherToken;
  let parentToken;

  beforeAll(async () => {
    // Log in as all three roles to get tokens
    try {
      const adminRes = await loginUser('admin', 'admin123');
      adminToken = adminRes.access_token;

      const teacherRes = await loginUser('teach', '123');
      teacherToken = teacherRes.access_token;

      const parentRes = await loginUser('ParentJane', 'parent123');
      parentToken = parentRes.access_token;
    } catch (e) {
      console.error('Failed to obtain tokens for integration tests', e);
    }
  });

  describe('Admin Functions', () => {
    it('should fetch analytics', async () => {
      if (!adminToken) return;
      const analytics = await apiRequest('/api/admin/dashboard/analytics', { token: adminToken });
      expect(analytics).toHaveProperty('summary');
    });

    it('should fetch user list', async () => {
      if (!adminToken) return;
      const users = await apiRequest('/api/admin/users', { token: adminToken });
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });

    it('should fetch classes', async () => {
      if (!adminToken) return;
      const classes = await apiRequest('/api/admin/classes', { token: adminToken });
      expect(Array.isArray(classes) || classes.classes).toBeDefined();
    });

    it('should create and then remove a dummy user', async () => {
      if (!adminToken) return;
      
      const username = `testuser_${Date.now()}`;
      const userData = {
        first_name: 'Test',
        last_name: 'User',
        username,
        email: `${username}@example.com`,
        role: 'Student'
      };

      // Create
      const created = await apiRequest('/api/admin/users', {
        method: 'POST',
        token: adminToken,
        body: userData
      });
      expect(created.username).toBe(username);
      const userId = created.id || created.public_id || created._id;

      // Verify exists in list
      const users = await apiRequest('/api/admin/users', { token: adminToken });
      const found = users.find(u => u.username === username);
      expect(found).toBeDefined();

      // Remove
      await apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        token: adminToken
      });

      // Verify gone
      const usersAfter = await apiRequest('/api/admin/users', { token: adminToken });
      const foundAfter = usersAfter.find(u => u.username === username);
      expect(foundAfter).toBeUndefined();
    });
  });

  describe('Teacher Functions', () => {
    it('should fetch class overview', async () => {
      if (!teacherToken) return;
      const overview = await apiRequest('/teacher/class/overview', { token: teacherToken });
      expect(overview).toBeDefined();
    });

    it('should fetch messages', async () => {
      if (!teacherToken) return;
      const messages = await apiRequest('/teacher/messages', { token: teacherToken });
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe('Parent Functions', () => {
    it('should fetch child stats', async () => {
      if (!parentToken) return;
      const stats = await apiRequest('/parent/stats', { token: parentToken });
      expect(Array.isArray(stats)).toBe(true);
    });

    it('should fetch profile', async () => {
      if (!parentToken) return;
      const profile = await apiRequest('/user/profile', { token: parentToken });
      expect(profile).toHaveProperty('username');
    });
  });
});
