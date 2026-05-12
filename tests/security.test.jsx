import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../src/components/ProtectedRoute';

describe('Security: ProtectedRoute', () => {
  it('redirects to /login if no session token exists', () => {
    const session = null;
    const allowedRoles = ['Admin'];
    
    // Mock Navigate to avoid real routing issues in test
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
      };
    });

    render(
      <MemoryRouter>
        <ProtectedRoute session={session} allowedRoles={allowedRoles}>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
  });

  it('redirects to /unauthorized if role is not allowed', () => {
    const session = { token: 'valid-token', role: 'Teacher' };
    const allowedRoles = ['Admin'];

    render(
      <MemoryRouter>
        <ProtectedRoute session={session} allowedRoles={allowedRoles}>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/unauthorized');
  });

  it('renders children if session and role are valid', () => {
    const session = { token: 'valid-token', role: 'Admin' };
    const allowedRoles = ['Admin'];

    render(
      <MemoryRouter>
        <ProtectedRoute session={session} allowedRoles={allowedRoles}>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
