/**
 * Unit tests for state tile ID management
 * Tests how tiles are created, updated, and IDs are managed
 */

import { TestSuite, assertEqual, assert, assertTruthy } from './testUtils.js';

const suite = new TestSuite('State Tile Management');

// Simulate the ID generation logic
function generateTileId(title, year) {
  return `${year}-${title
    .toUpperCase()
    .replace(/ /g, "-")
    .replace(/[^A-Z0-9]/g, "")}`;
}

// Simulate adding/updating tiles in state
function updateMovieTile(state, title, year, data) {
  const id = generateTileId(title, year);
  
  // Check if tile exists by link
  if (data?.link) {
    for (const [existingId, tileData] of Object.entries(state.movieTiles)) {
      if (tileData.link === data.link && existingId !== id) {
        // Found same movie with different ID (year changed)
        // Move to new ID
        state.movieTiles[id] = { ...tileData, ...data, year };
        delete state.movieTiles[existingId];
        return { id, updated: true, oldId: existingId };
      }
    }
  }
  
  // Create or update tile
  if (state.movieTiles[id]) {
    // Update existing
    state.movieTiles[id] = { ...state.movieTiles[id], ...data, year };
    return { id, updated: true };
  } else {
    // Create new
    state.movieTiles[id] = { id, title, year, ...data };
    return { id, updated: false };
  }
}

suite.test('Should generate correct tile ID', () => {
  const id = generateTileId('The Greatest Hits', '2024');
  assertEqual(id, '2024-THEGREATESTHITS');
});

suite.test('Should handle special characters in title', () => {
  const id = generateTileId("It's Never Over, Jeff Buckley", '2025');
  assertEqual(id, '2025-ITSNEVEROVERJEFFBUCKLEY');
});

suite.test('Should handle null year', () => {
  const id = generateTileId('Her Private Hell', null);
  assertEqual(id, 'null-HERPRIVATEHELL');
});

suite.test('Should create new tile when it doesn\'t exist', () => {
  const state = { movieTiles: {} };
  const result = updateMovieTile(state, 'Test Movie', '2024', {
    link: 'https://letterboxd.com/film/test/',
    movieProviders: []
  });
  
  assertEqual(result.updated, false, 'Should indicate tile was created');
  assertTruthy(state.movieTiles['2024-TESTMOVIE'], 'Tile should exist in state');
});

suite.test('Should update existing tile with same ID', () => {
  const state = {
    movieTiles: {
      '2024-TESTMOVIE': {
        id: '2024-TESTMOVIE',
        title: 'Test Movie',
        year: '2024',
        movieProviders: []
      }
    }
  };
  
  const result = updateMovieTile(state, 'Test Movie', '2024', {
    link: 'https://letterboxd.com/film/test/',
    movieProviders: [{ name: 'Netflix' }]
  });
  
  assertEqual(result.updated, true, 'Should indicate tile was updated');
  assertEqual(state.movieTiles['2024-TESTMOVIE'].movieProviders.length, 1);
});

suite.test('Should move tile to new ID when year changes', () => {
  const state = {
    movieTiles: {
      'null-HERPRIVATEHELL': {
        id: 'null-HERPRIVATEHELL',
        title: 'Her Private Hell',
        year: null,
        link: 'https://letterboxd.com/film/her-private-hell-1/',
        movieProviders: []
      }
    }
  };
  
  const result = updateMovieTile(state, 'Her Private Hell', '2026', {
    link: 'https://letterboxd.com/film/her-private-hell-1/',
    movieProviders: []
  });
  
  assertEqual(result.id, '2026-HERPRIVATEHELL', 'Should use new ID with correct year');
  assertEqual(result.oldId, 'null-HERPRIVATEHELL', 'Should return old ID');
  assertTruthy(state.movieTiles['2026-HERPRIVATEHELL'], 'Tile should exist with new ID');
  assert(!state.movieTiles['null-HERPRIVATEHELL'], 'Old ID should be removed');
});

suite.test('Should preserve data when moving to new ID', () => {
  const state = {
    movieTiles: {
      '2008-LAKEMUNGO': {
        id: '2008-LAKEMUNGO',
        title: 'Lake Mungo',
        year: '2008',
        link: 'https://letterboxd.com/film/lake-mungo/',
        poster: 'https://example.com/poster.jpg',
        movieProviders: []
      }
    }
  };
  
  const result = updateMovieTile(state, 'Lake Mungo', '2009', {
    link: 'https://letterboxd.com/film/lake-mungo/',
    movieProviders: [{ name: 'Disney Plus' }]
  });
  
  const newTile = state.movieTiles['2009-LAKEMUNGO'];
  assertEqual(newTile.poster, 'https://example.com/poster.jpg', 'Should preserve poster');
  assertEqual(newTile.movieProviders.length, 1, 'Should update providers');
  assertEqual(newTile.year, '2009', 'Should update year');
});

await suite.run();
