import React, { useState } from "react";
import { motion } from "framer-motion";
import type { TileData, TileProvider } from "./movieTiles";
import {
  POSTER_IMAGE_TRANSFORM_S,
  POSTER_OVERLAY_OPACITY_S,
  POSTER_HOVER_TRANSFORM_S,
  motionTransition,
} from "./animation/timing";
import { WaitCue } from "./WaitCue";

const JUSTWATCH_PROXY = "https://click.justwatch.com/a?r=";

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
  const { id, title, year, poster, link, movieProviders = [] } = data;
  const providerNames = movieProviders.map((p: { name: string }) => p.name);
  const [loaded, setLoaded] = useState(false);

  const handleProviderClick = (e: React.MouseEvent | React.KeyboardEvent, url?: string): void => {
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
      <a
        href={link}
        className="poster-link"
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={0}
        aria-label={`${title} (${year})`}
      >
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
          <p className="streaming-services" style={{ display: "none" }}>
            {providerNames.join(" / ")}
          </p>
          <div className="poster-providers">
            <div className="icons-container icons-container-tile">
              {movieProviders.map((provider: TileProvider) => (
                <div
                  key={provider.id}
                  className="tile-icon-btn"
                  data-sp={provider.name}
                  data-url={provider.url}
                  title={provider.name}
                  onClick={(e: React.MouseEvent) => handleProviderClick(e, provider.url)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleProviderClick(e, provider.url);
                    else if (e.key === " ") {
                      e.preventDefault();
                      handleProviderClick(e, provider.url);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <img className="tile-icons" src={provider.icon ?? ""} alt={provider.name} />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="tile-icon-btn"
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
              <img
                className="tile-icons"
                src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏴‍☠️</text></svg>"
                alt="Alternative search"
              />
            </button>
          </div>
        </div>
      </a>
    </motion.div>
  );
}
