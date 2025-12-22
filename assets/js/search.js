/**
 * Notas Theme AJAX Search with Infinite Scroll
 *
 * Handles real-time search of posts without page refresh
 * Implements infinite scroll for both all posts and search results
 */

(function() {
	'use strict';

	let searchTimeout = null;
	let currentOffset = 0;
	let currentQuery = '';
	let isLoading = false;
	let hasMore = true;
	let loadingSentinel = null;

	const searchInput = document.getElementById('notas-search-input');
	const postsContainer = document.getElementById('notas-posts-container');
	const searchSpinner = document.querySelector('.notas-search-spinner');
	const loadingIndicator = document.getElementById('notas-loading-indicator');
	const endMessage = document.getElementById('notas-end-message');

	if (!searchInput || !postsContainer) {
		return;
	}

	// Handle search input with debouncing
	searchInput.addEventListener('input', function(e) {
		const searchQuery = e.target.value.trim();

		// Clear previous timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		// Debounce search by 300ms
		searchTimeout = setTimeout(function() {
			resetAndSearch(searchQuery);
		}, 300);
	});

	// Clear search on ESC key
	searchInput.addEventListener('keydown', function(e) {
		if (e.key === 'Escape') {
			searchInput.value = '';
			resetAndSearch('');
		}
	});

	/**
	 * Reset state and perform new search
	 */
	function resetAndSearch(query) {
		currentQuery = query;
		currentOffset = 0;
		hasMore = true;
		postsContainer.innerHTML = '';

		if (endMessage) {
			endMessage.style.display = 'none';
		}

		performSearch(false);
	}

	/**
	 * Perform AJAX search
	 */
	function performSearch(append = false) {
		if (isLoading || !hasMore) {
			return;
		}

		isLoading = true;

		// Show appropriate spinner
		if (!append && searchSpinner) {
			searchSpinner.style.display = 'block';
		}
		if (append && loadingIndicator) {
			loadingIndicator.style.display = 'block';
		}

		// Prepare AJAX request
		const formData = new FormData();
		formData.append('action', 'notas_search_posts');
		formData.append('search', currentQuery);
		formData.append('current_post_id', getCurrentPostId());
		formData.append('offset', currentOffset);
		formData.append('per_page', 30);

		// Send AJAX request
		fetch(window.notasSearch.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			body: formData
		})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				if (append) {
					// Append new posts
					const tempDiv = document.createElement('div');
					tempDiv.innerHTML = data.data.html;
					while (tempDiv.firstChild) {
						postsContainer.appendChild(tempDiv.firstChild);
					}
				} else {
					// Replace all posts
					postsContainer.innerHTML = data.data.html;
				}

				// Update state
				currentOffset = data.data.loaded;
				hasMore = data.data.has_more;

				// Re-attach click handlers for new post items
				attachPostClickHandlers();

				// Show/hide end message
				if (!hasMore && endMessage) {
					endMessage.style.display = 'block';
				}
			} else {
				console.error('Search error:', data.data);
			}
		})
		.catch(error => {
			console.error('AJAX error:', error);
		})
		.finally(() => {
			isLoading = false;

			// Hide spinners
			if (searchSpinner) {
				searchSpinner.style.display = 'none';
			}
			if (loadingIndicator) {
				loadingIndicator.style.display = 'none';
			}
		});
	}

	/**
	 * Setup intersection observer for infinite scroll
	 */
	function setupInfiniteScroll() {
		// Create a sentinel element at the bottom of the container
		loadingSentinel = document.createElement('div');
		loadingSentinel.id = 'notas-scroll-sentinel';
		loadingSentinel.style.height = '1px';
		postsContainer.parentElement.appendChild(loadingSentinel);

		// Get the scrolling container (the left column)
		const scrollContainer = postsContainer.closest('.wp-block-column');
		if (!scrollContainer) {
			console.error('Could not find scroll container');
			return;
		}

		// Intersection observer options
		const options = {
			root: scrollContainer,
			rootMargin: '200px', // Trigger 200px before reaching the bottom
			threshold: 0
		};

		// Create observer
		const observer = new IntersectionObserver(function(entries) {
			entries.forEach(entry => {
				if (entry.isIntersecting && !isLoading && hasMore) {
					performSearch(true);
				}
			});
		}, options);

		// Observe the sentinel
		observer.observe(loadingSentinel);
	}

	/**
	 * Get current post ID from body class
	 */
	function getCurrentPostId() {
		const body = document.body;
		const classList = Array.from(body.classList);

		for (let className of classList) {
			if (className.startsWith('current-post-')) {
				return className.replace('current-post-', '');
			}
		}

		return 0;
	}

	/**
	 * Attach click handlers to post items for highlighting
	 */
	function attachPostClickHandlers() {
		const postItems = postsContainer.querySelectorAll('.note-list-item');

		postItems.forEach(item => {
			const link = item.querySelector('a');
			if (link) {
				// Remove any existing listeners by cloning
				const newLink = link.cloneNode(true);
				link.parentNode.replaceChild(newLink, link);

				newLink.addEventListener('click', function() {
					// Remove current class from all items
					postItems.forEach(i => i.classList.remove('is-current-post'));

					// Add current class to clicked item
					item.classList.add('is-current-post');
				});
			}
		});
	}

	// Initial load
	resetAndSearch('');

	// Setup infinite scroll
	setupInfiniteScroll();
})();
