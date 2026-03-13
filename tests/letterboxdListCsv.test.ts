/**
 * Unit tests for Letterboxd CSV list parsing (import format).
 */
import { parseLetterboxdCsv } from "../helpers/letterboxdCsv.js";
import {
  TestSuite,
  assertEqual,
  assertTruthy,
  assertDeepEqual,
  assertArrayLength,
} from "./testUtils.js";

const suite = new TestSuite("Letterboxd CSV list parsing");

suite.test("valid CSV with LetterboxdURI, Title, Year", () => {
  const csv = `LetterboxdURI,Title,Year
https://letterboxd.com/film/top-gun/,Top Gun,1986
https://letterboxd.com/film/gremlins/,Gremlins,1984`;
  const rows = parseLetterboxdCsv(csv);
  assertArrayLength(rows, 2);
  assertEqual(rows[0].title, "Top Gun");
  assertEqual(rows[0].year, "1986");
  assertEqual(rows[0].link, "https://letterboxd.com/film/top-gun/");
  assertEqual(rows[1].title, "Gremlins");
  assertEqual(rows[1].year, "1984");
  assertEqual(rows[1].link, "https://letterboxd.com/film/gremlins/");
});

suite.test("valid CSV with url column instead of LetterboxdURI", () => {
  const csv = `url,Title,Year
https://letterboxd.com/film/foo/,Foo,2020`;
  const rows = parseLetterboxdCsv(csv);
  assertArrayLength(rows, 1);
  assertEqual(rows[0].title, "Foo");
  assertEqual(rows[0].link, "https://letterboxd.com/film/foo/");
});

suite.test("valid CSV with quoted title containing comma", () => {
  const csv = `Title,Year
"Paris, Texas",1984`;
  const rows = parseLetterboxdCsv(csv);
  assertArrayLength(rows, 1);
  assertEqual(rows[0].title, "Paris, Texas");
  assertEqual(rows[0].year, "1984");
});

suite.test("valid CSV with only Title and Year (no URI)", () => {
  const csv = `Title,Year
Some Movie,1999`;
  const rows = parseLetterboxdCsv(csv);
  assertArrayLength(rows, 1);
  assertEqual(rows[0].title, "Some Movie");
  assertEqual(rows[0].year, "1999");
  assertEqual(rows[0].link, "");
});

suite.test("rows with only LetterboxdURI (title/year from URI or blank)", () => {
  const csv = `LetterboxdURI
https://letterboxd.com/film/a-film-2023/`;
  const rows = parseLetterboxdCsv(csv);
  assertArrayLength(rows, 1);
  assertEqual(rows[0].title, null);
  assertEqual(rows[0].year, null);
  assertEqual(rows[0].link, "https://letterboxd.com/film/a-film-2023/");
});

suite.test("empty body throws", () => {
  let threw = false;
  try {
    parseLetterboxdCsv("");
  } catch (e) {
    threw = true;
    assertTruthy((e as Error).message.includes("empty"));
  }
  assertTruthy(threw);
});

suite.test("only header row throws", () => {
  let threw = false;
  try {
    parseLetterboxdCsv("Title,Year\n");
  } catch (e) {
    threw = true;
    assertTruthy((e as Error).message.includes("header") || (e as Error).message.includes("data"));
  }
  assertTruthy(threw);
});

suite.test("no Title and no LetterboxdURI/url column throws", () => {
  let threw = false;
  try {
    parseLetterboxdCsv("Rating,Year\n5,1986\n");
  } catch (e) {
    threw = true;
  }
  assertTruthy(threw);
});

suite.test("empty data rows after header throw (no valid rows)", () => {
  let threw = false;
  try {
    parseLetterboxdCsv("Title,Year\n,\n");
  } catch (e) {
    threw = true;
    assertTruthy((e as Error).message.includes("no valid"));
  }
  assertTruthy(threw);
});

suite.test("mixed case header Title is found", () => {
  const csv = `title,year\nA Movie,2000`;
  const rows = parseLetterboxdCsv(csv);
  assertArrayLength(rows, 1);
  assertEqual(rows[0].title, "A Movie");
});

suite.test("CRLF line endings are accepted", () => {
  const csv = "Title,Year\r\nFoo,2020\r\n";
  const rows = parseLetterboxdCsv(csv);
  assertArrayLength(rows, 1);
  assertEqual(rows[0].title, "Foo");
});

suite.test("extra columns are ignored", () => {
  const csv = `Title,Year,Rating,Review
Top Gun,1986,5,Great`;
  const rows = parseLetterboxdCsv(csv);
  assertArrayLength(rows, 1);
  assertEqual(rows[0].title, "Top Gun");
  assertEqual(rows[0].year, "1986");
});

suite.run().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
});
