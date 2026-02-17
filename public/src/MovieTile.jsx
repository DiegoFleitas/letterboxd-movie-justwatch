const JUSTWATCH_PROXY = "https://click.justwatch.com/a?r=";

export function MovieTile({ data, onAlternativeSearch }) {
  const { id, title, year, poster, link, movieProviders = [] } = data;
  const providerNames = movieProviders.map((p) => p.name);

  const handleProviderClick = (e, url) => {
    e.preventDefault();
    if (url) window.open(`${JUSTWATCH_PROXY}${url}`, "_blank");
  };

  return (
    <div className="poster" data-id={id} data-testid="tile">
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
            <img className="spinner" src="spinner-min.svg" alt="Loading..." />
            <img
              src={poster}
              alt={`${title} Poster`}
              onLoad={(e) => {
                const parent = e.target.parentNode;
                const spinner = parent?.querySelector(".spinner");
                if (spinner) spinner.style.display = "none";
              }}
            />
          </>
        ) : (
          <div className="poster-skeleton" />
        )}
        <div className="poster-gradient" />
        <div className="poster-info">
          <h2 className="poster-title">{title}</h2>
          {year ? <p className="poster-release-date">{year}</p> : null}
          <p className="streaming-services" style={{ display: "none" }}>
            {providerNames.join(" / ")}
          </p>
          <div className="poster-providers">
            <div className="icons-container icons-container-tile">
              {movieProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="tile-icons"
                  data-sp={provider.name}
                  data-url={provider.url}
                  onClick={(e) => handleProviderClick(e, provider.url)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleProviderClick(e, provider.url);
                    } else if (e.key === " ") {
                      e.preventDefault();
                      handleProviderClick(e, provider.url);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <img
                    className="tile-icons"
                    src={provider.icon}
                    alt={provider.name}
                  />
                </div>
              ))}
            </div>
            <div className="tile-icons" data-sp="alternative-search-tile">
              <img
                src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏴‍☠️</text></svg>"
                alt="alternative search"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onAlternativeSearch) onAlternativeSearch(data);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onAlternativeSearch) onAlternativeSearch(data);
                  }
                }}
                role="button"
                tabIndex={0}
              />
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}
