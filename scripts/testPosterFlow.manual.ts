/**
 * Test poster loading for Letterboxd movies (integration).
 * Validates that movies get posters from JustWatch/TMDB APIs.
 * Requires server running on localhost:3000.
 *
 * Run with: bun run test:poster-flow (after `bun run start` or `bun run dev` backend)
 */

import axios from "axios";

interface TestMovie {
  title: string;
  year: string | null;
}

interface SearchResult {
  success: boolean;
  hasPoster: boolean;
  hasProviders: boolean;
  title: string;
  year: string | number | null;
}

const TEST_MOVIES: TestMovie[] = [
  { title: "The Little Drummer Girl", year: "2018" },
  { title: "Her Private Hell", year: null },
  { title: "Shoplifters", year: "2018" },
  { title: "Lake Mungo", year: "2008" },
  { title: "Nikita", year: "1990" },
  { title: "Ghost World", year: "2001" },
];

async function testSearchMovie(title: string, year: string | null): Promise<SearchResult> {
  try {
    const response = await axios.post(
      "http://localhost:3000/api/search-movie",
      {
        title,
        year,
        country: "es_UY",
      },
      { timeout: 10_000 },
    );

    const data = response.data as {
      poster?: string;
      error?: string;
      title?: string;
      year?: string | number;
      movieProviders?: unknown[];
    };
    const hasPoster = !!data.poster;

    if (!hasPoster || data.error) {
      const yearPart = year ? ` (${year})` : "";
      console.log(`${hasPoster ? "⚠️ " : "❌"} ${title}${yearPart}`);
      if (data.error) {
        const snippet = JSON.stringify(String(data.error));
        const errorLine = snippet.length > 90 ? `${snippet.slice(0, 87)}...` : snippet;
        console.log(`   ${errorLine}`);
      }
      if (!hasPoster) {
        console.log("   No poster available");
      }
    }

    return {
      success: true,
      hasPoster,
      hasProviders: (data.movieProviders?.length ?? 0) > 0,
      title: data.title ?? title,
      year: data.year ?? year,
    };
  } catch (error) {
    const err = error as Error;
    const yearPart = year ? ` (${year})` : "";
    console.log(`❌ ${title}${yearPart} - Request failed: ${err.message}`);
    return {
      success: false,
      hasPoster: false,
      hasProviders: false,
      title,
      year,
    };
  }
}

async function runTests(): Promise<void> {
  console.log("\n📽️  Testing Poster Loading for Letterboxd Movies");
  console.log("━".repeat(60));
  console.log("Server: http://localhost:3000\n");

  const results: SearchResult[] = [];

  for (const movie of TEST_MOVIES) {
    const result = await testSearchMovie(movie.title, movie.year);
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const withPosters = results.filter((r) => r.hasPoster).length;
  const withProviders = results.filter((r) => r.hasProviders).length;
  const failed = results.filter((r) => !r.success).length;

  console.log("\n" + "━".repeat(60));
  console.log("📊 Summary:");
  console.log(
    `   Posters loaded: ${withPosters}/${results.length} (${Math.round((withPosters / results.length) * 100)}%)`,
  );
  console.log(`   With providers: ${withProviders}/${results.length}`);
  console.log(`   Failed requests: ${failed}/${results.length}`);

  const missingPosters = results.filter((r) => !r.hasPoster).length;
  if (missingPosters > 0) {
    console.log(
      `\n💡 Note: ${missingPosters} movie(s) missing posters (likely TV series or not in TMDB)`,
    );
  } else {
    console.log("\n✅ All movies loaded posters successfully!");
  }
  console.log("━".repeat(60) + "\n");
}

try {
  await runTests();
} catch (err) {
  console.error(err);
  process.exit(1);
}
