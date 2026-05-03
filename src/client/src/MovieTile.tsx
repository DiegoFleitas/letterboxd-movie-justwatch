import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAppState } from "./AppStateContext";
import { letterboxdFilmUrlOrSearchUrl, type TileData, type TileProvider } from "./movieTiles";
import { buildOpenSubtitlesBrowseUrl } from "./opensubtitlesUrl";
import {
  POSTER_IMAGE_TRANSFORM_S,
  POSTER_OVERLAY_OPACITY_S,
  POSTER_HOVER_TRANSFORM_S,
  motionTransition,
} from "./animation/timing";
import alternativeSearchIcon from "./assets/alternative-search.svg";
import imdbIcon from "./assets/imdb-icon.svg";
import letterboxdIcon from "./assets/letterboxd-icon.svg";
import tmdbIcon from "./assets/tmdb-icon.svg";
import openSubtitlesIcon from "./assets/opensubtitles-icon.svg";
import subdlIcon from "./assets/subdl-icon.svg";
import { WaitCue } from "./WaitCue";
import { useMobilePosterLayout } from "./useMobilePosterLayout";

const JUSTWATCH_PROXY = "https://click.justwatch.com/a?r=";

const MAX_TILE_PROVIDERS_DESKTOP = 4;
const MAX_TILE_PROVIDERS_MOBILE = 3;

interface MovieTileProps {
  data: TileData;
  index?: number;
  onAlternativeSearch?: (data: TileData) => void;
  suppressAnimations?: boolean;
}

export function MovieTile({
  data,
  index = 0,
  onAlternativeSearch,
  suppressAnimations = false,
}: MovieTileProps): React.ReactElement {
  const { id, title, year, poster, link, imdbLink, tmdbLink, movieProviders = [] } = data;
  const isMobilePoster = useMobilePosterLayout();
  const hasLetterboxdFilmLink = Boolean(link?.trim());
  const showExternalLinks = Boolean(imdbLink || tmdbLink || hasLetterboxdFilmLink);
  const showSubsLinks = !isMobilePoster;
  const subsLabels = showSubsLinks ? (["SubDL", "OpenSubtitles"] as const) : [];
  const availableExternalLinks = [
    hasLetterboxdFilmLink ? "Letterboxd" : null,
    tmdbLink ? "TMDB" : null,
    imdbLink ? "IMDb" : null,
    ...subsLabels,
  ].filter(Boolean) as string[];
  const { searchSubs } = useAppState();
  const [loaded, setLoaded] = useState(false);
  const maxTileProviders = isMobilePoster ? MAX_TILE_PROVIDERS_MOBILE : MAX_TILE_PROVIDERS_DESKTOP;
  const visibleProviders = movieProviders.slice(0, maxTileProviders);
  const hiddenProviders = movieProviders.slice(maxTileProviders);
  const hiddenProviderNames = hiddenProviders.map((p) => p.name);

  const handleProviderClick = (e: React.MouseEvent, url?: string): void => {
    e.preventDefault();
    if (url) window.open(`${JUSTWATCH_PROXY}${url}`, "_blank");
  };

  const staggerDelay = Math.min(index * 0.03, 0.6);

  const motionDivProps = suppressAnimations
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { ...motionTransition(POSTER_IMAGE_TRANSFORM_S * 0.9), delay: staggerDelay },
        },
        exit: { opacity: 0, y: 8, transition: motionTransition(POSTER_OVERLAY_OPACITY_S) },
      };

  return (
    <motion.div
      className="poster"
      data-id={id}
      data-testid="tile"
      {...motionDivProps}
      whileHover={
        suppressAnimations
          ? undefined
          : {
              y: -8,
              scale: 1.02,
              rotate: -0.3,
              transition: motionTransition(POSTER_HOVER_TRANSFORM_S),
            }
      }
    >
      <fieldset
        className="poster-external-stack"
        aria-label={`${title}${year != null && year !== "" ? ` (${year})` : ""} — ${availableExternalLinks.join(", ")}`}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        {showExternalLinks ? (
          <>
            <button
              type="button"
              className="poster-external-btn"
              data-sp="letterboxd-link-tile"
              title={
                hasLetterboxdFilmLink
                  ? "Open Letterboxd film page"
                  : "Search this film on Letterboxd"
              }
              aria-label={
                hasLetterboxdFilmLink
                  ? `Open ${title} on Letterboxd`
                  : `Search ${title}${year != null && year !== "" ? ` (${year})` : ""} on Letterboxd`
              }
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(
                  letterboxdFilmUrlOrSearchUrl(link, title, year),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              onKeyDown={(e) => {
                if (e.key === " ") e.stopPropagation();
              }}
            >
              <img src={letterboxdIcon} alt="" className="poster-external-btn__icon" />
            </button>
            {tmdbLink ? (
              <button
                type="button"
                className="poster-external-btn"
                data-sp="tmdb-link-tile"
                title="Open TMDB page"
                aria-label={`Open ${title} on TMDB`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(tmdbLink, "_blank", "noopener,noreferrer");
                }}
                onKeyDown={(e) => {
                  if (e.key === " ") e.stopPropagation();
                }}
              >
                <img src={tmdbIcon} alt="" className="poster-external-btn__icon" />
              </button>
            ) : null}
            {imdbLink ? (
              <button
                type="button"
                className="poster-external-btn"
                data-sp="imdb-link-tile"
                title="Open IMDb page"
                aria-label={`Open ${title} on IMDb`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(imdbLink, "_blank", "noopener,noreferrer");
                }}
                onKeyDown={(e) => {
                  if (e.key === " ") e.stopPropagation();
                }}
              >
                <img src={imdbIcon} alt="" className="poster-external-btn__icon" />
              </button>
            ) : null}
          </>
        ) : null}
        {showSubsLinks ? (
          <>
            <button
              type="button"
              className="poster-external-btn"
              data-sp="subdl-link-tile"
              title="Open subtitles on SubDL (website)"
              aria-label={`Open SubDL subtitle page for ${title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                searchSubs(title, year ?? undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === " ") e.stopPropagation();
              }}
            >
              <img
                src={subdlIcon}
                alt=""
                className="poster-external-btn__icon"
                width={28}
                height={28}
                decoding="async"
              />
            </button>
            <button
              type="button"
              className="poster-external-btn"
              data-sp="opensubtitles-link-tile"
              title="Search subtitles on OpenSubtitles"
              aria-label={`Open OpenSubtitles search for ${title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(
                  buildOpenSubtitlesBrowseUrl(title, year ?? undefined, imdbLink, tmdbLink),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              onKeyDown={(e) => {
                if (e.key === " ") e.stopPropagation();
              }}
            >
              <img src={openSubtitlesIcon} alt="" className="poster-external-btn__icon" />
            </button>
          </>
        ) : null}
      </fieldset>
      <div className="poster-body">
        {poster ? (
          <>
            {suppressAnimations ? (
              <div
                className="spinner"
                style={{
                  position: "absolute",
                  left: 12,
                  top: 12,
                  zIndex: 4,
                  opacity: loaded ? 0 : 1,
                }}
                aria-hidden
              >
                {!loaded ? <WaitCue size="md" className="wait-cue--on-poster" /> : null}
              </div>
            ) : (
              <motion.div
                className="spinner"
                initial={{ opacity: 1 }}
                animate={{ opacity: loaded ? 0 : 1 }}
                transition={motionTransition(0.12)}
                style={{ position: "absolute", left: 12, top: 12, zIndex: 4 }}
                aria-hidden
              >
                {!loaded ? <WaitCue size="md" className="wait-cue--on-poster" /> : null}
              </motion.div>
            )}

            {suppressAnimations ? (
              // instant image show when suppressing animations
              // keep onLoad behavior to mark loaded
              // use normal img to avoid motion work
              <img
                src={poster}
                alt={`${title} Poster`}
                style={{ opacity: loaded ? 1 : 0 }}
                onLoad={() => setLoaded(true)}
              />
            ) : (
              <motion.img
                src={poster}
                alt={`${title} Poster`}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: loaded ? 1 : 0,
                  transition: motionTransition(POSTER_IMAGE_TRANSFORM_S),
                }}
                onLoad={() => setLoaded(true)}
                whileHover={{
                  scale: 1.03,
                  y: -2,
                  rotate: -0.5,
                  transition: motionTransition(POSTER_HOVER_TRANSFORM_S),
                }}
              />
            )}
          </>
        ) : (
          <div className="poster-skeleton" />
        )}
        {/* subtle film grain overlay (decorative) */}
        <div className="grain-overlay" aria-hidden="true" />
        <div className="poster-gradient" />
        <div className="poster-info">
          <h2 className="poster-title">{title}</h2>
          {year ? <p className="poster-release-date">{year}</p> : null}
          <div className="poster-providers">
            <div className="icons-container icons-container-tile">
              {visibleProviders.map((provider: TileProvider) => (
                <button
                  type="button"
                  key={provider.id}
                  className="tile-icon-btn"
                  data-sp={provider.name}
                  data-url={provider.url}
                  title={provider.name}
                  onClick={(e: React.MouseEvent) => handleProviderClick(e, provider.url)}
                >
                  <img className="tile-icons" src={provider.icon ?? ""} alt={provider.name} />
                </button>
              ))}
              {hiddenProviderNames.length > 0 ? (
                <span
                  className="poster-providers-surplus"
                  title={`Also available: ${hiddenProviderNames.join(", ")}`}
                  aria-label={`Also on: ${hiddenProviderNames.join(", ")}`}
                >
                  +{hiddenProviderNames.length}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="tile-icon-btn tile-icon-btn--alt-search"
              data-sp="alternative-search-tile"
              title="Alternative search"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAlternativeSearch?.(data);
              }}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                }
              }}
            >
              <img className="tile-icons" src={alternativeSearchIcon} alt="Alternative search" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
