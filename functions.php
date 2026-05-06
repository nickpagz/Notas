<?php
/**
 * Notas Theme Functions
 *
 * @package Notas
 */

// Register custom block pattern category
if ( ! function_exists( 'notas_register_patterns' ) ) :
	function notas_register_patterns() {
		register_block_pattern_category(
			'notas',
			array(
				'label' => __( 'Notas', 'notas' ),
			)
		);
	}
endif;
add_action( 'init', 'notas_register_patterns' );

// Enqueue custom styles and scripts
if ( ! function_exists( 'notas_enqueue_assets' ) ) :
	function notas_enqueue_assets() {
		// Enqueue custom CSS for interactivity and mobile
		wp_enqueue_style(
			'notas-custom',
			get_template_directory_uri() . '/assets/css/custom.css',
			array(),
			wp_get_theme()->get( 'Version' )
		);

		// Enqueue AJAX post navigation JavaScript
		wp_enqueue_script(
			'notas-post-navigation',
			get_template_directory_uri() . '/assets/js/post-navigation.js',
			array(),
			wp_get_theme()->get( 'Version' ),
			true
		);

		// Enqueue search JavaScript
		wp_enqueue_script(
			'notas-search',
			get_template_directory_uri() . '/assets/js/search.js',
			array(),
			wp_get_theme()->get( 'Version' ),
			true
		);

		// Localize script with AJAX URL
		wp_localize_script(
			'notas-search',
			'notasSearch',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
			)
		);
	}
endif;
add_action( 'wp_enqueue_scripts', 'notas_enqueue_assets' );

// Add current post class to body for CSS targeting
if ( ! function_exists( 'notas_body_classes' ) ) :
	function notas_body_classes( $classes ) {
		if ( is_single() || is_page() ) {
			global $post;
			$classes[] = 'current-post-' . $post->ID;
		}
		return $classes;
	}
endif;
add_filter( 'body_class', 'notas_body_classes' );

// AJAX handler for post search
if ( ! function_exists( 'notas_search_posts_ajax' ) ) :
	function notas_search_posts_ajax() {
		$search_query      = isset( $_POST['search'] ) ? sanitize_text_field( $_POST['search'] ) : '';
		$current_post_id   = isset( $_POST['current_post_id'] ) ? intval( $_POST['current_post_id'] ) : 0;
		$offset            = isset( $_POST['offset'] ) ? intval( $_POST['offset'] ) : 0;
		$per_page          = isset( $_POST['per_page'] ) ? intval( $_POST['per_page'] ) : 30;

		// Get posts
		$args = array(
			'posts_per_page' => $per_page,
			'offset'         => $offset,
			'post_type'      => 'post',
			'post_status'    => 'publish',
			'orderby'        => 'modified',
			'order'          => 'DESC',
		);

		// Add search query if provided
		if ( ! empty( $search_query ) ) {
			$args['s'] = $search_query;
		}

		// Get total count for pagination
		$count_args = $args;
		$count_args['posts_per_page'] = -1;
		$count_args['fields'] = 'ids';
		unset( $count_args['offset'] );
		$all_posts = get_posts( $count_args );
		$total_posts = count( $all_posts );

		$posts = get_posts( $args );

		// Group posts by time periods
		$now    = current_time( 'timestamp' );
		$groups = array(
			'today'            => array(
				'label' => __( 'Today', 'notas' ),
				'posts' => array(),
			),
			'yesterday'        => array(
				'label' => __( 'Yesterday', 'notas' ),
				'posts' => array(),
			),
			'previous_7_days'  => array(
				'label' => __( 'Previous 7 Days', 'notas' ),
				'posts' => array(),
			),
			'previous_30_days' => array(
				'label' => __( 'Previous 30 Days', 'notas' ),
				'posts' => array(),
			),
			'older'            => array(
				'label' => __( 'Older', 'notas' ),
				'posts' => array(),
			),
		);

		foreach ( $posts as $post ) {
			$post_time = get_post_modified_time( 'U', false, $post );
			$diff_days = floor( ( $now - $post_time ) / DAY_IN_SECONDS );

			if ( $diff_days === 0 ) {
				$groups['today']['posts'][] = $post;
			} elseif ( $diff_days === 1 ) {
				$groups['yesterday']['posts'][] = $post;
			} elseif ( $diff_days <= 7 ) {
				$groups['previous_7_days']['posts'][] = $post;
			} elseif ( $diff_days <= 30 ) {
				$groups['previous_30_days']['posts'][] = $post;
			} else {
				$groups['older']['posts'][] = $post;
			}
		}

		// Generate HTML
		ob_start();

		if ( empty( $posts ) ) {
			echo '<p style="color:var(--wp--preset--color--secondary);text-align:center;padding:var(--wp--preset--spacing--50)">';
			esc_html_e( 'No posts found.', 'notas' );
			echo '</p>';
		} else {
			foreach ( $groups as $group_key => $group ) {
				if ( ! empty( $group['posts'] ) ) {
					// Group Header
					echo '<h3 class="wp-block-heading has-secondary-color has-text-color" style="margin-top:var(--wp--preset--spacing--40);margin-bottom:var(--wp--preset--spacing--20);font-size:0.6875rem;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">';
					echo esc_html( $group['label'] );
					echo '</h3>';

					foreach ( $group['posts'] as $post ) {
						setup_postdata( $post );
						$is_current   = ( $post->ID === $current_post_id );
						$item_classes = 'note-list-item';
						if ( $is_current ) {
							$item_classes .= ' is-current-post';
						}

						// Post Item
						echo '<div class="wp-block-group ' . esc_attr( $item_classes ) . '" style="border-radius:8px;padding:var(--wp--preset--spacing--30)">';

						// Post Title
						echo '<h4 class="note-title" style="margin:0">';
						echo '<a href="' . esc_url( get_permalink( $post ) ) . '" style="text-decoration:none;color:var(--wp--preset--color--contrast);font-size:0.9375rem;font-weight:600;line-height:1.3">';
						echo esc_html( get_the_title( $post ) );
						echo '</a>';
						echo '</h4>';

						// Date + Excerpt
						echo '<div style="display:flex;gap:var(--wp--preset--spacing--20);font-size:0.8125rem;color:var(--wp--preset--color--secondary)">';
						echo '<time datetime="' . esc_attr( get_the_date( 'c', $post ) ) . '">';
						echo esc_html( get_the_date( '', $post ) );
						echo '</time>';
						echo '<span>' . esc_html( wp_trim_words( get_the_excerpt( $post ), 8, '...' ) ) . '</span>';
						echo '</div>';

						echo '</div>';
					}

					wp_reset_postdata();
				}
			}
		}

		$html = ob_get_clean();

		wp_send_json_success(
			array(
				'html'       => $html,
				'total'      => $total_posts,
				'loaded'     => $offset + count( $posts ),
				'has_more'   => ( $offset + count( $posts ) ) < $total_posts,
			)
		);
	}
endif;
add_action( 'wp_ajax_notas_search_posts', 'notas_search_posts_ajax' );
add_action( 'wp_ajax_nopost_notas_search_posts', 'notas_search_posts_ajax' );

/**
 * Parent Post Meta Field
 *
 * Registers a post meta field that allows associating a parent post.
 */
if ( ! function_exists( 'notas_register_parent_post_meta' ) ) :
	function notas_register_parent_post_meta() {
		register_post_meta(
			'post',
			'_notas_parent_post',
			array(
				'show_in_rest'  => true,
				'single'        => true,
				'type'          => 'integer',
				'default'       => 0,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);
	}
endif;
add_action( 'init', 'notas_register_parent_post_meta' );

// Enqueue the editor sidebar plugin for parent post selection
if ( ! function_exists( 'notas_enqueue_editor_assets' ) ) :
	function notas_enqueue_editor_assets() {
		wp_enqueue_script(
			'notas-parent-post-plugin',
			get_template_directory_uri() . '/assets/js/parent-post-plugin.js',
			array( 'wp-plugins', 'wp-edit-post', 'wp-components', 'wp-data', 'wp-element', 'wp-compose', 'wp-api-fetch' ),
			wp_get_theme()->get( 'Version' ),
			true
		);
	}
endif;
add_action( 'enqueue_block_editor_assets', 'notas_enqueue_editor_assets' );
