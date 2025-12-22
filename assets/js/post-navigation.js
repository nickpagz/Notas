/**
 * Notas Theme - AJAX Post Navigation
 *
 * Handles loading posts without full page refresh
 *
 * @package Notas
 */

(function() {
	'use strict';

	// DOM elements
	// First column is the sidebar, second column is the content
	const columns = document.querySelectorAll('.wp-block-columns > .wp-block-column');
	const sidebar = columns[0];
	const postContentColumn = columns[1];

	if (!postContentColumn || !sidebar) {
		return;
	}

	/**
	 * Update the current post highlight in the sidebar
	 */
	function updateSidebarHighlight(postId) {
		// Remove all existing highlights
		const allItems = sidebar.querySelectorAll('.note-list-item');
		allItems.forEach(item => {
			item.classList.remove('is-current-post');
		});

		// Add highlight to the current post
		const currentItem = sidebar.querySelector(`a[href*="/?p=${postId}"]`)?.closest('.note-list-item') ||
		                     sidebar.querySelector(`a[href*="/20"]`)?.closest('.note-list-item');

		if (currentItem) {
			currentItem.classList.add('is-current-post');
		}
	}

	/**
	 * Extract post ID from URL
	 */
	function getPostIdFromUrl(url) {
		// Try to get post ID from URL parameter
		const urlObj = new URL(url);
		const pParam = urlObj.searchParams.get('p');
		if (pParam) {
			return parseInt(pParam, 10);
		}

		// Try to get post from slug (parse WordPress REST API)
		return null;
	}

	/**
	 * Load post content via REST API
	 */
	async function loadPost(postUrl, postLink) {
		try {
			// Show loading state
			postContentColumn.style.opacity = '0.5';
			postContentColumn.style.pointerEvents = 'none';

			// Extract post ID or slug from URL
			const postId = getPostIdFromUrl(postUrl);

			// Fetch the post data
			let apiUrl;
			if (postId) {
				apiUrl = `/wp-json/wp/v2/posts/${postId}`;
			} else {
				// Get slug from URL path
				const pathParts = new URL(postUrl).pathname.split('/').filter(Boolean);
				const slug = pathParts[pathParts.length - 1];
				apiUrl = `/wp-json/wp/v2/posts?slug=${slug}`;
			}

			const response = await fetch(apiUrl);

			if (!response.ok) {
				throw new Error('Failed to load post');
			}

			const data = await response.json();
			const post = Array.isArray(data) ? data[0] : data;

			if (!post) {
				throw new Error('Post not found');
			}

			// Build the new content HTML matching single.html template structure exactly
			const contentHtml = `
				<!-- Back Link (visible only on mobile) -->
				<p class="mobile-back-link" style="margin-bottom:var(--wp--preset--spacing--40);font-size:var(--wp--preset--font-size--medium)"><a href="/">← Notes</a></p>

				<!-- Post Date -->
				<div class="wp-block-post-date has-text-color has-secondary-color has-small-font-size"><time datetime="${post.date}">${new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time></div>

				<div style="height:var(--wp--preset--spacing--30)" aria-hidden="true" class="wp-block-spacer"></div>

				<!-- Post Title -->
				<h1 style="font-weight:700;" class="wp-block-post-title has-x-large-font-size">${post.title.rendered}</h1>

				<div style="height:var(--wp--preset--spacing--40)" aria-hidden="true" class="wp-block-spacer"></div>

				<!-- Post Content -->
				<div class="entry-content wp-block-post-content has-global-padding is-layout-constrained wp-block-post-content-is-layout-constrained">
${post.content.rendered}
				</div>
			`;

			// Update the content
			postContentColumn.innerHTML = contentHtml;

			// Scroll content column to top
			postContentColumn.scrollTop = 0;

			// Save current sidebar scroll position before navigating
			const currentScrollPosition = sidebar.scrollTop;

			// Update browser URL without page reload
			history.pushState({
				postId: post.id,
				sidebarScrollPosition: currentScrollPosition
			}, post.title.rendered, postUrl);

			// Update document title
			document.title = post.title.rendered + ' - ' + document.title.split(' - ').slice(-1)[0];

			// Update sidebar highlight
			updateSidebarHighlight(post.id);

			// Update body class for CSS targeting
			document.body.className = document.body.className.replace(/current-post-\d+/, '');
			document.body.classList.add(`current-post-${post.id}`);

			// Ensure body has 'single' class
			if (!document.body.classList.contains('single')) {
				document.body.classList.add('single');
			}

			// Remove loading state
			postContentColumn.style.opacity = '1';
			postContentColumn.style.pointerEvents = 'auto';

		} catch (error) {
			console.error('Error loading post:', error);

			// Fallback to normal navigation
			window.location.href = postUrl;
		}
	}

	/**
	 * Handle clicks on post links in sidebar
	 */
	function handlePostLinkClick(event) {
		// Check if clicked element is or is within a post link
		const postLink = event.target.closest('.note-list-item a');

		if (!postLink) {
			return;
		}

		// Prevent default navigation
		event.preventDefault();

		// Get the post URL
		const postUrl = postLink.href;

		// Load the post via AJAX
		loadPost(postUrl, postLink);
	}

	/**
	 * Handle clicks on mobile back link
	 */
	function handleBackLinkClick(event) {
		const backLink = event.target.closest('.mobile-back-link a');

		if (!backLink) {
			return;
		}

		event.preventDefault();
		navigateToHome();
	}

	/**
	 * Navigate to home view (posts list)
	 */
	function navigateToHome() {
		// Remove 'single' and 'page' classes from body
		document.body.classList.remove('single');
		document.body.classList.remove('page');

		// Restore previous scroll position if available
		const savedScrollPosition = history.state?.sidebarScrollPosition || 0;

		// Update browser URL
		history.pushState({
			home: true,
			sidebarScrollPosition: savedScrollPosition
		}, document.title.split(' - ').slice(-1)[0], '/');

		// Update document title
		const siteName = document.title.split(' - ').slice(-1)[0];
		document.title = siteName;

		// Clear current post highlight
		const allItems = sidebar.querySelectorAll('.note-list-item');
		allItems.forEach(item => {
			item.classList.remove('is-current-post');
		});

		// Restore scroll position
		sidebar.scrollTop = savedScrollPosition;
	}

	/**
	 * Handle browser back/forward buttons
	 */
	function handlePopState(event) {
		if (event.state && event.state.postId) {
			// Load the post from the state
			const postUrl = window.location.href;
			loadPost(postUrl);
		} else if (event.state && event.state.home) {
			// Navigate to home without reload
			navigateToHome();
		} else {
			// Reload the page if no state
			window.location.reload();
		}
	}

	/**
	 * Initialize
	 */
	function init() {
		// Add click listener to sidebar
		sidebar.addEventListener('click', handlePostLinkClick);

		// Add click listener to content column for back link
		postContentColumn.addEventListener('click', handleBackLinkClick);

		// Handle browser back/forward buttons
		window.addEventListener('popstate', handlePopState);

		// Save initial state
		if (window.location.pathname !== '/') {
			const postId = getPostIdFromUrl(window.location.href);
			if (postId) {
				history.replaceState({ postId: postId }, document.title, window.location.href);
			}
		}
	}

	// Run on DOM ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

})();
