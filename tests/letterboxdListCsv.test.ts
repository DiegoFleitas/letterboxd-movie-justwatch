/**
 * Unit tests for Letterboxd CSV list parsing (import format).
 */
import { describe, it, expect } from "vitest";
import { parseLetterboxdCsv } from "../helpers/letterboxdCsv.js";

describe("Letterboxd CSV list parsing", () => {
  it("valid CSV with LetterboxdURI, Title, Year", () => {
    const csv = `LetterboxdURI,Title,Year
https://letterboxd.com/film/top-gun/,Top Gun,1986
https://letterboxd.com/film/gremlins/,Gremlins,1984`;
    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("Top Gun");
    expect(rows[0].year).toBe("1986");
    expect(rows[0].link).toBe("https://letterboxd.com/film/top-gun/");
    expect(rows[1].title).toBe("Gremlins");
    expect(rows[1].year).toBe("1984");
    expect(rows[1].link).toBe("https://letterboxd.com/film/gremlins/");
  });

  it("valid CSV with url column instead of LetterboxdURI", () => {
    const csv = `url,Title,Year
https://letterboxd.com/film/foo/,Foo,2020`;
    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Foo");
    expect(rows[0].link).toBe("https://letterboxd.com/film/foo/");
  });

  it("valid CSV with quoted title containing comma", () => {
    const csv = `Title,Year
"Paris, Texas",1984`;
    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Paris, Texas");
    expect(rows[0].year).toBe("1984");
  });

  it("valid CSV with only Title and Year (no URI)", () => {
    const csv = `Title,Year
Some Movie,1999`;
    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Some Movie");
    expect(rows[0].year).toBe("1999");
    expect(rows[0].link).toBe("");
  });

  it("rows with only LetterboxdURI (title/year from URI or blank)", () => {
    const csv = `LetterboxdURI
https://letterboxd.com/film/a-film-2023/`;
    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBeNull();
    expect(rows[0].year).toBeNull();
    expect(rows[0].link).toBe("https://letterboxd.com/film/a-film-2023/");
  });

  it("empty body throws", () => {
    expect(() => parseLetterboxdCsv("")).toThrow(/empty/i);
  });

  it("only header row throws", () => {
    expect(() => parseLetterboxdCsv("Title,Year\n")).toThrow();
  });

  it("no Title and no LetterboxdURI/url column throws", () => {
    expect(() => parseLetterboxdCsv("Rating,Year\n5,1986\n")).toThrow();
  });

  it("empty data rows after header throw (no valid rows)", () => {
    expect(() => parseLetterboxdCsv("Title,Year\n,\n")).toThrow(/no valid/i);
  });

  it("mixed case header Title is found", () => {
    const csv = `title,year\nA Movie,2000`;
    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("A Movie");
  });

  it("CRLF line endings are accepted", () => {
    const csv = "Title,Year\r\nFoo,2020\r\n";
    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Foo");
  });

  it("extra columns are ignored", () => {
    const csv = `Title,Year,Rating,Review
Top Gun,1986,5,Great`;
    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Top Gun");
    expect(rows[0].year).toBe("1986");
  });
});
