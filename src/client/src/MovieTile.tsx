import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAppState } from "./AppStateContext";
import {
  letterboxdFilmUrlOrSearchUrl,
  type TileData,
  type TileProvider,
  type TileYear,
} from "./movieTiles";
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

function yearSuffixForLabels(year: TileYear | undefined): string {
  if (year == null || String(year).trim() === "") return "";
  return ` (${year})`;
}

function fieldsetAriaLabel(title: string, year: TileYear | undefined, linkParts: string[]): string {
  const suffix = yearSuffixForLabels(year);
  const headline = suffix === "" ? title : `${title}${suffix}`;
  return `${headline} — ${linkParts.join(", ")}`;
}

function letterboxdButtonAriaLabel(
  hasFilmLink: boolean,
  title: string,
  year: TileYear | undefined,
): string {
  if (hasFilmLink) {
    return `Open ${title} on Letterboxd`;
  }
  const ys = yearSuffixForLabels(year);
  return `Search ${title}${ys} on Letterboxd`;
}

interface MovieTileProps {
  data: TileData;
  index?: number;
  onAlternativeSearch?: (data: TileData) => void;
  suppressAnimations?: boolean;
}

type PosterBackdropProps = Readonly<{
  poster: string;
  title: string;
  suppressAnimations: boolean;
  loaded: boolean;
  onLoaded: () => void;
}>;

function PosterBackdrop({
  poster,
  title,
  suppressAnimations,
  loaded,
  onLoaded,
}: PosterBackdropProps): React.ReactElement {
  const posterAlt = `${title} Poster`;
  const showLoadingCue = loaded === false;
  const spinnerOpacityStyle = loaded ? 0 : 1;
  const imageOpacityStyle = loaded ? 1 : 0;

  const loadingCue = showLoadingCue ? <WaitCue size="md" className="wait-cue--on-poster" /> : null;

  return (
    <>
      {suppressAnimations ? (
        <div
          className="spinner"
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            zIndex: 4,
            opacity: spinnerOpacityStyle,
          }}
          aria-hidden
        >
          {loadingCue}
        </div>
      ) : (
        <motion.div
          className="spinner"
          initial={{ opacity: 1 }}
          animate={{ opacity: spinnerOpacityStyle }}
          transition={motionTransition(0.12)}
          style={{ position: "absolute", left: 12, top: 12, zIndex: 4 }}
          aria-hidden
        >
          {loadingCue}
        </motion.div>
      )}

      {suppressAnimations ? (
        <img
          src={poster}
          alt={posterAlt}
          style={{ opacity: imageOpacityStyle }}
          onLoad={onLoaded}
        />
      ) : (
        <motion.img
          src={poster}
          alt={posterAlt}
          initial={{ opacity: 0 }}
          animate={{
            opacity: imageOpacityStyle,
            transition: motionTransition(POSTER_IMAGE_TRANSFORM_S),
          }}
          onLoad={onLoaded}
          whileHover={{
            scale: 1.03,
            y: -2,
            rotate: -0.5,
            transition: motionTransition(POSTER_HOVER_TRANSFORM_S),
          }}
        />
      )}
    </>
  );
}

type LetterboxdTmdbImdbClusterProps = Readonly<{
  show: boolean;
  hasLetterboxdFilmLink: boolean;
  title: string;
  year: TileYear | undefined;
  link: string;
  tmdbLink?: string;
  imdbLink?: string;
  letterboxdAria: string;
}>;

function LetterboxdTmdbImdbCluster({
  show,
  hasLetterboxdFilmLink,
  title,
  year,
  link,
  tmdbLink,
  imdbLink,
  letterboxdAria,
}: LetterboxdTmdbImdbClusterProps): React.ReactElement | null {
  if (!show) return null;
  return (
    <>
      <button
        type="button"
        className="poster-external-btn"
        data-sp="letterboxd-link-tile"
        title={
          hasLetterboxdFilmLink ? "Open Letterboxd film page" : "Search this film on Letterboxd"
        }
        aria-label={letterboxdAria}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          globalThis.window?.open(
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
            globalThis.window?.open(tmdbLink, "_blank", "noopener,noreferrer");
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
            globalThis.window?.open(imdbLink, "_blank", "noopener,noreferrer");
          }}
          onKeyDown={(e) => {
            if (e.key === " ") e.stopPropagation();
          }}
        >
          <img src={imdbIcon} alt="" className="poster-external-btn__icon" />
        </button>
      ) : null}
    </>
  );
}

type SubsCornerButtonsProps = Readonly<{
  show: boolean;
  title: string;
  year: TileYear | undefined;
  imdbLink?: string;
  tmdbLink?: string;
  searchSubs: (query: string, year?: string | number) => void;
}>;

type ProviderSurplusControlsProps = Readonly<{
  hiddenCount: number;
  hiddenNames: string;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}>;

function ProviderSurplusControls({
  hiddenCount,
  hiddenNames,
  expanded,
  onExpand,
  onCollapse,
}: ProviderSurplusControlsProps): React.ReactElement | null {
  if (hiddenCount === 0) return null;
  if (!expanded) {
    return (
      <button
        type="button"
        className="poster-providers-surplus poster-providers-surplus__toggle"
        data-testid="provider-surplus-toggle"
        data-sp="provider-surplus-toggle"
        aria-expanded="false"
        aria-label={`Show ${hiddenCount} more on poster: ${hiddenNames}`}
        title={`Also available: ${hiddenNames}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onExpand();
        }}
      >
        +{hiddenCount}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="poster-providers-surplus poster-providers-surplus__toggle poster-providers-surplus__collapse"
      data-testid="provider-surplus-collapse"
      data-sp="provider-surplus-collapse"
      aria-expanded="true"
      aria-label="Show fewer streaming providers on poster"
      title="Show fewer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCollapse();
      }}
    >
      −
    </button>
  );
}

function SubsCornerButtons({
  show,
  title,
  year,
  imdbLink,
  tmdbLink,
  searchSubs,
}: SubsCornerButtonsProps): React.ReactElement | null {
  if (!show) return null;
  return (
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
          globalThis.window?.open(
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
  );
}

export function MovieTile({
  data,
  index = 0,
  onAlternativeSearch,
  suppressAnimations = false,
}: Readonly<MovieTileProps>): React.ReactElement {
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
  const [providersExpanded, setProvidersExpanded] = useState(false);
  const maxTileProviders = isMobilePoster ? MAX_TILE_PROVIDERS_MOBILE : MAX_TILE_PROVIDERS_DESKTOP;
  const visibleProviders = movieProviders.slice(0, maxTileProviders);
  const hiddenProviders = movieProviders.slice(maxTileProviders);
  const providersToShow = providersExpanded ? movieProviders : visibleProviders;
  const hiddenNames = hiddenProviders.map((p) => p.name).join(", ");

  const handleProviderClick = (e: React.MouseEvent, url?: string): void => {
    e.preventDefault();
    if (url) globalThis.window?.open(`${JUSTWATCH_PROXY}${url}`, "_blank");
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

  const externalStackAria = fieldsetAriaLabel(title, year, availableExternalLinks);
  const letterboxdAria = letterboxdButtonAriaLabel(hasLetterboxdFilmLink, title, year);

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
        aria-label={externalStackAria}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <LetterboxdTmdbImdbCluster
          show={showExternalLinks}
          hasLetterboxdFilmLink={hasLetterboxdFilmLink}
          title={title}
          year={year}
          link={link}
          tmdbLink={tmdbLink}
          imdbLink={imdbLink}
          letterboxdAria={letterboxdAria}
        />
        <SubsCornerButtons
          show={showSubsLinks}
          title={title}
          year={year}
          imdbLink={imdbLink}
          tmdbLink={tmdbLink}
          searchSubs={searchSubs}
        />
      </fieldset>
      <div className="poster-body">
        {poster ? (
          <PosterBackdrop
            poster={poster}
            title={title}
            suppressAnimations={suppressAnimations}
            loaded={loaded}
            onLoaded={() => setLoaded(true)}
          />
        ) : (
          <div className="poster-skeleton" />
        )}
        {/* subtle film grain overlay (decorative) */}
        <div className="grain-overlay" aria-hidden="true" />
        <div className="poster-gradient" />
        <div className="poster-info">
          <h2 className="poster-title">{title}</h2>
          {year ? <p className="poster-release-date">{year}</p> : null}
          <div
            className={`poster-providers${providersExpanded ? " poster-providers--expanded" : ""}`}
          >
            <div
              className={`icons-container icons-container-tile${
                providersExpanded ? " icons-container-tile--expanded" : ""
              }`}
            >
              {providersToShow.map((provider: TileProvider) => (
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
              <ProviderSurplusControls
                hiddenCount={hiddenProviders.length}
                hiddenNames={hiddenNames}
                expanded={providersExpanded}
                onExpand={() => setProvidersExpanded(true)}
                onCollapse={() => setProvidersExpanded(false)}
              />
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
