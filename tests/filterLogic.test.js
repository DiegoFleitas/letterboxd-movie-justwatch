/**
 * Unit tests for filter logic
 * Tests the core filtering algorithm without dependencies
 */

import { TestSuite, assertEqual, assertArrayLength } from './testUtils.js';

const suite = new TestSuite('Filter Logic');

// Mock STATE
const createMockState = () => ({
  movieTiles: {
    '2018-MOVIE1': {
      id: '2018-MOVIE1',
      title: 'Movie 1',
      movieProviders: []
    },
    '2024-MOVIE2': {
      id: '2024-MOVIE2',
      title: 'Movie 2',
      movieProviders: [
        { name: 'Disney Plus', id: 'disney' }
      ]
    },
    '2020-MOVIE3': {
      id: '2020-MOVIE3',
      title: 'Movie 3',
      movieProviders: [
        { name: 'Netflix', id: 'netflix' },
        { name: 'Disney Plus', id: 'disney' }
      ]
    },
    '1990-MOVIE4': {
      id: '1990-MOVIE4',
      title: 'Movie 4',
      movieProviders: [
        { name: 'Netflix', id: 'netflix' }
      ]
    }
  }
});

// Simulate filter logic
function filterMovies(state, selectedServices) {
  const visible = [];
  const hidden = [];
  
  for (const [id, data] of Object.entries(state.movieTiles)) {
    const providerNames = data.movieProviders?.map(p => p.name) || [];
    
    if (providerNames.length === 0) {
      hidden.push(id);
    } else {
      const hasMatch = selectedServices.some(service => 
        providerNames.includes(service)
      );
      if (hasMatch) {
        visible.push(id);
      } else {
        hidden.push(id);
      }
    }
  }
  
  return { visible, hidden };
}

suite.test('Should hide movies with no providers when filter is active', () => {
  const state = createMockState();
  const result = filterMovies(state, ['Disney Plus']);
  
  assertEqual(result.hidden.includes('2018-MOVIE1'), true, 
    'Movie with no providers should be hidden');
});

suite.test('Should show movies with matching provider', () => {
  const state = createMockState();
  const result = filterMovies(state, ['Disney Plus']);
  
  assertEqual(result.visible.includes('2024-MOVIE2'), true,
    'Movie with Disney Plus should be visible');
  assertEqual(result.visible.includes('2020-MOVIE3'), true,
    'Movie with Disney Plus (and other providers) should be visible');
});

suite.test('Should hide movies without matching provider', () => {
  const state = createMockState();
  const result = filterMovies(state, ['Disney Plus']);
  
  assertEqual(result.hidden.includes('1990-MOVIE4'), true,
    'Movie with only Netflix should be hidden when filtering by Disney Plus');
});

suite.test('Should show correct count when filtering by Disney Plus', () => {
  const state = createMockState();
  const result = filterMovies(state, ['Disney Plus']);
  
  assertArrayLength(result.visible, 2, 'Should have 2 visible movies');
  assertArrayLength(result.hidden, 2, 'Should have 2 hidden movies');
});

suite.test('Should show correct movies when filtering by Netflix', () => {
  const state = createMockState();
  const result = filterMovies(state, ['Netflix']);
  
  assertEqual(result.visible.includes('2020-MOVIE3'), true);
  assertEqual(result.visible.includes('1990-MOVIE4'), true);
  assertArrayLength(result.visible, 2);
});

suite.test('Should handle multiple selected services (OR logic)', () => {
  const state = createMockState();
  const result = filterMovies(state, ['Disney Plus', 'Netflix']);
  
  // All movies with at least one matching provider should be visible
  assertArrayLength(result.visible, 3);
  assertArrayLength(result.hidden, 1); // Only MOVIE1 with no providers
});

await suite.run();
