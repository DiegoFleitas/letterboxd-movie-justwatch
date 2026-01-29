/**
 * Test poster loading for Letterboxd movies
 * Validates that movies get posters from JustWatch/TMDB APIs
 * 
 * Run with: node tests/testPosterFlow.test.js
 * Expected: Most movies should have posters unless they're TV series or not in TMDB
 */

import axios from "axios";

const TEST_MOVIES = [
  { title: "The Little Drummer Girl", year: "2018" },  // Known fail: TV series, not in TMDB
  { title: "Her Private Hell", year: null },
  { title: "Shoplifters", year: "2018" },
  { title: "Lake Mungo", year: "2008" },
  { title: "Nikita", year: "1990" },
  { title: "Ghost World", year: "2001" },
];

async function testSearchMovie(title, year) {
  try {
    const response = await axios.post('http://localhost:3000/api/search-movie', {
      title,
      year,
      country: 'es_UY'
    }, {
      timeout: 10000
    });

    const data = response.data;
    const hasPoster = !!data.poster;
    
    // Only log failures or interesting cases
    if (!hasPoster || data.error) {
      console.log(`${hasPoster ? '⚠️ ' : '❌'} ${title}${year ? ` (${year})` : ''}`);
      if (data.error) {
        console.log(`   ${data.error.replace(/<[^>]*>/g, '').substring(0, 80)}`);
      }
      if (!hasPoster) {
        console.log(`   No poster available`);
      }
    }

    return {
      success: true,
      hasPoster,
      hasProviders: data.movieProviders?.length > 0,
      title: data.title || title,
      year: data.year || year,
    };
  } catch (error) {
    console.log(`❌ ${title}${year ? ` (${year})` : ''} - Request failed: ${error.message}`);
    return {
      success: false,
      hasPoster: false,
      hasProviders: false,
      title,
      year,
    };
  }
}

async function runTests() {
  console.log('\n📽️  Testing Poster Loading for Letterboxd Movies');
  console.log('━'.repeat(60));
  console.log('Server: http://localhost:3000\n');

  const results = [];

  for (const movie of TEST_MOVIES) {
    const result = await testSearchMovie(movie.title, movie.year);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  const withPosters = results.filter(r => r.hasPoster).length;
  const withProviders = results.filter(r => r.hasProviders).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n━'.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Posters loaded: ${withPosters}/${results.length} (${Math.round(withPosters/results.length*100)}%)`);
  console.log(`   With providers: ${withProviders}/${results.length}`);
  console.log(`   Failed requests: ${failed}/${results.length}`);

  const missingPosters = results.filter(r => !r.hasPoster).length;
  if (missingPosters > 0) {
    console.log(`\n💡 Note: ${missingPosters} movie(s) missing posters (likely TV series or not in TMDB)`);
  } else {
    console.log('\n✅ All movies loaded posters successfully!');
  }
  console.log('━'.repeat(60) + '\n');
}

runTests().catch(console.error);
