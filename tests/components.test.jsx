import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Loading from '../src/components/Loading';

describe('Loading Component', () => {
  it('renders with default message', () => {
    render(<Loading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<Loading message="Processing data..." />);
    expect(screen.getByText('Processing data...')).toBeInTheDocument();
  });

  it('applies fullscreen class when fullScreen prop is true', () => {
    const { container } = render(<Loading fullScreen />);
    expect(container.firstChild).toHaveClass('fullscreen');
  });
});
