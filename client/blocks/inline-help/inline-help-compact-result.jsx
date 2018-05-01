/** @format */
/**
 * External dependencies
 */
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { invoke } from 'lodash';

/**
 * Internal dependencies
 */
import { decodeEntities, preventWidows } from 'lib/formatting';

class InlineHelpCompactResult extends Component {
	static propTypes = {
		helpLink: PropTypes.object.isRequired,
		onClick: PropTypes.func,
	};

	static defaultProps = {
		helpLink: {},
	};

	onClick = event => {
		invoke( this.props, 'onClick', event, this.props.helpLink );
	};

	render() {
		const { helpLink } = this.props;
		const key = helpLink.link + '-' + helpLink.id;
		return (
			<li key={ key }>
				<a
					href={ helpLink.link }
					title={ decodeEntities( helpLink.description ) }
					onClick={ this.onClick }
				>
					{ preventWidows( decodeEntities( helpLink.title ) ) }
				</a>
			</li>
		);
	}
}

export default InlineHelpCompactResult;
