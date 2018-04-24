/** @format */

/**
 * External dependencies
 */

import { get, find, identity, trim } from 'lodash';
import striptags from 'striptags';

/**
 * Internal dependencies
 */
import { formatExcerpt } from 'lib/post-normalizer/rule-create-better-excerpt';
import PostMetadata from 'lib/post-metadata';
import { parseHtml } from 'lib/formatting';

const PREVIEW_IMAGE_WIDTH = 512;

export const getPostImage = post => {
	if ( ! post ) {
		return null;
	}

	// Use the featured image if one was set
	if ( post.featured_image ) {
		return post.featured_image;
	}

	// Otherwise we'll look for a large enough image in the post
	const content = post.content;
	if ( ! content ) {
		return null;
	}

	const imgElements = parseHtml( content ).querySelectorAll( 'img' );

	const imageUrl = get(
		find( imgElements, ( { width } ) => width >= PREVIEW_IMAGE_WIDTH ),
		'src',
		null
	);

	return imageUrl ? `${ imageUrl }?s=${ PREVIEW_IMAGE_WIDTH }` : null;
};

export const getExcerptForPost = post => {
	if ( ! post ) {
		return null;
	}

	return trim(
		striptags(
			formatExcerpt(
				find( [ PostMetadata.metaDescription( post ), post.excerpt, post.content ], identity )
			)
		)
	);
};

export const getSummaryForPost = ( post, translate, maxWords = 60 ) => {
	if ( ! post ) {
		return null;
	}

	const content = trim( striptags( formatExcerpt( post.content ) ) );
	const words = content.split( ' ' );

	return (
		words.slice( 0, maxWords ).join( ' ' ) +
		( words.length > maxWords
			? ' ' + translate( '[ more ]', { comment: 'Truncation of post content in a FB share.' } )
			: '' )
	);
};
