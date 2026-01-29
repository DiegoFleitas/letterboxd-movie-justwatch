/**
 * Test Letterboxd CDN URL construction
 * Validates that we correctly build poster URLs from film data
 * 
 * Run with: node tests/testPosterUrlConstruction.test.js
 */

// Test cases from test-posters.html (known working URLs)
const TEST_CASES = [
  {
    name: "The Little Drummer Girl (2018)",
    filmId: "484585",
    slug: "the-little-drummer-girl-2018",
    cacheBustingKey: "9aa648f4",
    expectedUrl: "https://a.ltrbxd.com/resized/film-poster/4/8/4/5/8/5/484585-the-little-drummer-girl-2018-0-230-0-345-crop.jpg?v=9aa648f4"
  },
  {
    name: "You'll Never Find Me",
    filmId: "1007317",
    slug: "youll-never-find-me",
    cacheBustingKey: "924840a4",
    expectedUrl: "https://a.ltrbxd.com/resized/film-poster/1/0/0/7/3/1/7/1007317-youll-never-find-me-0-230-0-345-crop.jpg?v=924840a4"
  },
  {
    name: "Her Private Hell",
    filmId: "361648",
    slug: "her-private-hell-1",
    cacheBustingKey: "57d4bdf1",
    expectedUrl: "https://a.ltrbxd.com/resized/film-poster/3/6/1/6/4/8/361648-her-private-hell-1-0-230-0-345-crop.jpg?v=57d4bdf1"
  }
];

function constructPosterUrl(filmId, slug, cacheBustingKey) {
  // Split film ID into path segments (e.g., 1007317 -> 1/0/0/7/3/1/7)
  const idSegments = filmId.split('').join('/');
  
  return `https://a.ltrbxd.com/resized/film-poster/${idSegments}/${filmId}-${slug}-0-230-0-345-crop.jpg?v=${cacheBustingKey}`;
}

function runTests() {
  console.log('\n🎬 Testing Letterboxd CDN URL Construction');
  console.log('━'.repeat(60));
  
  let passed = 0;
  let failed = 0;

  TEST_CASES.forEach(test => {
    const constructed = constructPosterUrl(test.filmId, test.slug, test.cacheBustingKey);
    const matches = constructed === test.expectedUrl;
    
    if (matches) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Expected: ${test.expectedUrl}`);
      console.log(`   Got:      ${constructed}`);
      failed++;
    }
  });

  console.log('\n━'.repeat(60));
  console.log(`📊 Results: ${passed}/${TEST_CASES.length} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All tests passed! URL construction is correct.\n');
  } else {
    console.log('❌ Some tests failed. Fix the construction logic.\n');
    process.exit(1);
  }
}

runTests();
