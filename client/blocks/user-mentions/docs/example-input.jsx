/** @format */

/**
 * External dependencies
 */
import React from 'react';

/**
 * Internal dependencies
 */
import ExampleInput from './example-input';
import addUserMentions from '../add';

const UserMentionsExampleInput = ( { onKeyPress } ) => <textarea onKeyPress={ onKeyPress } />;

export default addUserMentions( UserMentionsExampleInput );
