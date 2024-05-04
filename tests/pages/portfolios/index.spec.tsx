import React from 'react';
import { render, screen } from '@testing-library/react';
import Portfolios from '@pages/portfolios';
import useSWR from 'swr';
import {mockUserProfile, withUserProvider} from "../../fixtures";

// Mock useSWR with specific data setup
jest.mock('swr', () => ({
  __esModule: true, // This property makes Jest treat it like an ES module
  default: jest.fn() // This ensures the default export is a mock function
}));

// Setup the mock data for useSWR as needed before each test

describe('Portfolios Page', () => {
  beforeEach(() => {
    const mockUseSWR = jest.fn().mockReturnValue({
      data: { data: [{
          id: '1',
          code: 'P123',
          name: 'Portfolio 1',
          base: { symbol: '$', code: 'USD' },
          currency: { symbol: '€', code: 'EUR' }
        }] },
      error: null,
      mutate: jest.fn()
    });
    (useSWR as jest.Mock).mockImplementation(() => mockUseSWR());
  });

  it('renders the portfolios table when data is available', () => {
    render(<Portfolios user={mockUserProfile} />, {
      wrapper: withUserProvider({ user: mockUserProfile }),
    })
    expect(screen.getByText('portfolio.code')).toBeInTheDocument();
    expect(screen.getByText('P123')).toBeInTheDocument();
    expect(screen.getByText('Portfolio 1')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent === '$USD'
    })).toBeInTheDocument();

    expect(screen.getByText((content, element) => {
      return element?.textContent === '€EUR'
    })).toBeInTheDocument();
  });

  it('handles no portfolios correctly', () => {
    const mockUseSWR = jest.fn().mockReturnValue({
      data: { data: [] },
      error: null,
      mutate: jest.fn()
    });
    (useSWR as jest.Mock).mockImplementation(() => mockUseSWR());
    render(<Portfolios user={mockUserProfile} />, {
      wrapper: withUserProvider({ user: mockUserProfile }),
    })

    expect(screen.getByText('error.portfolios.empty')).toBeInTheDocument();
  });
});
