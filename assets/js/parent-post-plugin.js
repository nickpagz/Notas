( function ( wp ) {
	var registerPlugin = wp.plugins.registerPlugin;
	var PluginDocumentSettingPanel = wp.editPost.PluginDocumentSettingPanel;
	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var useSelect = wp.data.useSelect;
	var useDispatch = wp.data.useDispatch;
	var TextControl = wp.components.TextControl;
	var Button = wp.components.Button;
	var Spinner = wp.components.Spinner;
	var apiFetch = wp.apiFetch;

	function ParentPostPanel() {
		var editPost = useDispatch( 'core/editor' );
		var postMeta = useSelect( function ( select ) {
			return select( 'core/editor' ).getEditedPostAttribute( 'meta' ) || {};
		}, [] );
		var currentPostId = useSelect( function ( select ) {
			return select( 'core/editor' ).getCurrentPostId();
		}, [] );

		var parentPostId = postMeta._notas_parent_post || 0;

		var [ searchQuery, setSearchQuery ] = useState( '' );
		var [ searchResults, setSearchResults ] = useState( [] );
		var [ isSearching, setIsSearching ] = useState( false );
		var [ parentTitle, setParentTitle ] = useState( '' );
		var [ isLoadingTitle, setIsLoadingTitle ] = useState( false );

		// Load parent post title on mount
		useEffect( function () {
			if ( parentPostId && parentPostId > 0 ) {
				setIsLoadingTitle( true );
				apiFetch( { path: '/wp/v2/posts/' + parentPostId + '?_fields=title' } )
					.then( function ( post ) {
						setParentTitle( post.title.rendered );
						setIsLoadingTitle( false );
					} )
					.catch( function () {
						setParentTitle( '(Post not found)' );
						setIsLoadingTitle( false );
					} );
			} else {
				setParentTitle( '' );
			}
		}, [ parentPostId ] );

		// Search posts with debounce
		useEffect( function () {
			if ( searchQuery.length < 2 ) {
				setSearchResults( [] );
				return;
			}

			var timeout = setTimeout( function () {
				setIsSearching( true );
				apiFetch( {
					path: '/wp/v2/posts?search=' + encodeURIComponent( searchQuery ) +
						'&per_page=5&exclude=' + currentPostId + '&_fields=id,title',
				} )
					.then( function ( posts ) {
						setSearchResults( posts );
						setIsSearching( false );
					} )
					.catch( function () {
						setSearchResults( [] );
						setIsSearching( false );
					} );
			}, 300 );

			return function () {
				clearTimeout( timeout );
			};
		}, [ searchQuery, currentPostId ] );

		function setParentPost( postId ) {
			editPost.editPost( { meta: { _notas_parent_post: postId } } );
			setSearchQuery( '' );
			setSearchResults( [] );
		}

		function removeParentPost() {
			editPost.editPost( { meta: { _notas_parent_post: 0 } } );
			setParentTitle( '' );
		}

		return el(
			PluginDocumentSettingPanel,
			{
				name: 'notas-parent-post',
				title: 'Parent Post',
				icon: 'admin-links',
			},
			// Show current parent
			parentPostId > 0
				? el(
					'div',
					{ style: { marginBottom: '12px' } },
					el(
						'div',
						{
							style: {
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '8px 12px',
								background: '#f0f0f0',
								borderRadius: '4px',
							},
						},
						el(
							'span',
							null,
							isLoadingTitle
								? el( Spinner, null )
								: parentTitle || '(Post #' + parentPostId + ')'
						),
						el(
							Button,
							{
								isDestructive: true,
								variant: 'link',
								onClick: removeParentPost,
							},
							'Remove'
						)
					)
				  )
				: null,
			// Search input
			el( TextControl, {
				label: parentPostId > 0 ? 'Change parent post' : 'Search for a parent post',
				placeholder: 'Type to search...',
				value: searchQuery,
				onChange: setSearchQuery,
			} ),
			// Loading indicator
			isSearching ? el( Spinner, null ) : null,
			// Search results
			searchResults.length > 0
				? el(
					'div',
					{
						style: {
							border: '1px solid #ddd',
							borderRadius: '4px',
							maxHeight: '200px',
							overflow: 'auto',
						},
					},
					searchResults.map( function ( post ) {
						return el(
							Button,
							{
								key: post.id,
								variant: 'tertiary',
								onClick: function () {
									setParentPost( post.id );
								},
								style: {
									display: 'block',
									width: '100%',
									textAlign: 'left',
									padding: '8px 12px',
								},
							},
							post.title.rendered || '(Untitled)'
						);
					} )
				  )
				: null
		);
	}

	registerPlugin( 'notas-parent-post', {
		render: ParentPostPanel,
	} );
} )( window.wp );
