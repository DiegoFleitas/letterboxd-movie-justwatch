/**
 * Progressive poster loader with rate limiting
 * Fetches Letterboxd posters through the proxy endpoint at a controlled pace
 */

const POSTER_FETCH_DELAY = 200; // ms between poster requests
const posterQueue = [];
let isProcessingQueue = false;

/**
 * Fetch a single poster through the proxy endpoint
 */
async function fetchLetterboxdPoster(posterMeta) {
  if (!posterMeta || !posterMeta.filmId || !posterMeta.filmSlug) {
    return null;
  }

  try {
    const response = await fetch('/api/letterboxd-poster', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filmId: posterMeta.filmId,
        filmSlug: posterMeta.filmSlug,
        cacheBustingKey: posterMeta.cacheBustingKey,
      }),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch poster for ${posterMeta.filmSlug}`);
      return null;
    }

    const data = await response.json();
    return data.poster;
  } catch (error) {
    console.error(`Error fetching poster for ${posterMeta.filmSlug}:`, error);
    return null;
  }
}

/**
 * Add a poster request to the queue
 */
export function queuePosterLoad(posterMeta, tileElement, movieData) {
  if (!posterMeta) return;

  posterQueue.push({
    posterMeta,
    tileElement,
    movieData,
  });

  if (!isProcessingQueue) {
    processQueue();
  }
}

/**
 * Process the poster queue with rate limiting
 */
async function processQueue() {
  if (isProcessingQueue || posterQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (posterQueue.length > 0) {
    const { posterMeta, tileElement, movieData } = posterQueue.shift();

    try {
      const posterUrl = await fetchLetterboxdPoster(posterMeta);
      
      if (posterUrl && tileElement) {
        // Update the tile with the poster
        const imgElement = tileElement.querySelector('a img:not(.spinner)');
        if (imgElement) {
          imgElement.src = posterUrl;
        } else {
          // Create img if it doesn't exist
          const link = tileElement.querySelector('a');
          if (link) {
            const img = document.createElement('img');
            img.src = posterUrl;
            img.alt = `${movieData.title} Poster`;
            img.onload = function() {
              const spinner = tileElement.querySelector('.spinner');
              if (spinner) spinner.style.display = 'none';
            };
            link.appendChild(img);
          }
        }
        
        // Update STATE if needed
        if (movieData && movieData.id && window.STATE && window.STATE.movieTiles) {
          const tileData = window.STATE.movieTiles[movieData.id];
          if (tileData) {
            tileData.poster = posterUrl;
          }
        }
      }
    } catch (error) {
      console.error('Error processing poster queue:', error);
    }

    // Wait before processing next poster to avoid rate limiting
    if (posterQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, POSTER_FETCH_DELAY));
    }
  }

  isProcessingQueue = false;
}

export default {
  queuePosterLoad,
  fetchLetterboxdPoster,
};
