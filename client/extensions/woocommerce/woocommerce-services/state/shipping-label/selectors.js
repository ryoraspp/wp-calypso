/**
 * External dependencies
 */
import { flatten, find, get, includes, isEmpty, isEqual, isFinite, map, mapValues, pick, round, some, sumBy, uniq } from 'lodash';
import { translate } from 'i18n-calypso';
/**
 * Internal dependencies
 */
import createSelector from 'lib/create-selector';
import { getSelectedSiteId } from 'state/ui/selectors';
import { hasNonEmptyLeaves } from 'woocommerce/woocommerce-services/lib/utils/tree';
import { getOrder } from 'woocommerce/state/sites/orders/selectors';
import { areSettingsLoaded, areSettingsErrored } from 'woocommerce/woocommerce-services/state/label-settings/selectors';
import {
	isLoaded as arePackagesLoaded,
	isFetchError as arePackagesErrored,
} from 'woocommerce/woocommerce-services/state/packages/selectors';

// "Countries" from when USPS can ship a package
export const USPS_COUNTRIES = [ 'US', 'AS', 'PR', 'VI', 'GU', 'MP', 'UM', 'FM', 'MH' ];

export const getShippingLabel = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	return get( state, [ 'extensions', 'woocommerce', 'woocommerceServices', siteId, 'shippingLabel', orderId ], null );
};

export const isLoaded = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.loaded;
};

export const isEnabled = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.enabled;
};

export const isFetching = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.isFetching;
};

export const isError = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.error;
};

export const getLabels = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.loaded ? shippingLabel.labels : [];
};

export const shouldFulfillOrder = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.fulfillOrder;
};

export const shouldEmailDetails = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.emailDetails;
};

export const getSelectedPaymentMethod = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	if ( ! shippingLabel ) {
		return null;
	}

	return shippingLabel.paymentMethod;
};

export const hasRefreshedLabelStatus = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.refreshedLabelStatus;
};

export const getForm = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel && shippingLabel.form;
};

/**
 * Returns a breakdown of the total price for selected labels in form of { prices, discount, total }
 * @param {Object} state global state tree
 * @param {Number} orderId order Id
 * @param {Number} siteId site Id
 *
 * @returns {Object} price breakdown
 */
export const getTotalPriceBreakdown = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const form = getForm( state, orderId, siteId );
	if ( ! form ) {
		return null;
	}

	const { values: selectedRates, available: availableRates } = form.rates;
	const prices = [];
	let discount = 0;
	let total = 0;
	for ( const packageId in selectedRates ) {
		const packageRates = get( availableRates, [ packageId, 'rates' ], false );
		const foundRate = find( packageRates, [ 'service_id', selectedRates[ packageId ] ] );
		if ( foundRate ) {
			prices.push( {
				title: foundRate.title,
				retailRate: foundRate.retail_rate,
			} );

			discount += round( foundRate.retail_rate - foundRate.rate, 2 );
			total += foundRate.rate;
		}
	}

	return prices.length ? {
		prices,
		discount: discount,
		total: total,
	} : null;
};

export const needsCustomsForm = createSelector(
	( state, orderId, siteId = getSelectedSiteId( state ) ) => {
		const form = getForm( state, orderId, siteId );
		if ( isEmpty( form ) ) {
			return false;
		}
		const originStatus = form.origin;
		const origin = ( originStatus.isNormalized && originStatus.selectNormalized && originStatus.normalized )
			? originStatus.normalized
			: originStatus.values;
		const destinationStatus = form.destination;
		const destination = ( destinationStatus.isNormalized && destinationStatus.selectNormalized && destinationStatus.normalized )
			? destinationStatus.normalized
			: destinationStatus.values;

		// Special case: Any shipment from/to military addresses must have Customs
		if ( 'US' === origin.country && includes( [ 'AA', 'AE', 'AP' ], origin.state ) ) {
			return true;
		}
		if ( 'US' === destination.country && includes( [ 'AA', 'AE', 'AP' ], destination.state ) ) {
			return true;
		}
		// No need to have Customs if shipping inside the same territory (for example, from Guam to Guam)
		if ( origin.country === destination.country ) {
			return false;
		}
		// Shipments between US, Puerto Rico and Virgin Islands don't need Customs, everything else does
		return ! includes( [ 'US', 'PR', 'VI' ], origin.country ) || ! includes( [ 'US', 'PR', 'VI' ], destination.country );
	},
	( state, orderId, siteId = getSelectedSiteId( state ) ) => [
		getForm( state, orderId, siteId ),
	]
);

export const getProductValueFromOrder = createSelector(
	( state, productId, orderId, siteId = getSelectedSiteId( state ) ) => {
		const order = getOrder( state, orderId, siteId );
		if ( ! order ) {
			return 0;
		}
		for ( let i = 0; i < order.line_items.length; i++ ) {
			const item = order.line_items[ i ];
			const id = item.variation_id || item.product_id;
			if ( id === productId ) {
				return round( item.total / item.quantity, 2 );
			}
		}
		return 0;
	},
	( state, productId, orderId, siteId = getSelectedSiteId( state ) ) => [
		getOrder( state, orderId, siteId ),
	]
);

const getAddressErrors = ( {
	values,
	isNormalized,
	normalized: normalizedValues,
	selectNormalized,
	ignoreValidation,
	fieldErrors,
}, countriesData ) => {
	if ( isNormalized && ! normalizedValues && fieldErrors ) {
		return fieldErrors;
	} else if ( isNormalized && ! normalizedValues ) {
		// If the address is normalized but the server didn't return a normalized address, then it's
		// invalid and must register as an error
		return {
			address: translate( 'This address is not recognized. Please try another.' ),
		};
	}

	const { postcode, state, country } = ( isNormalized && selectNormalized ) ? normalizedValues : values;
	const requiredFields = [ 'name', 'address', 'city', 'postcode', 'country' ];
	const errors = {};
	requiredFields.forEach( ( field ) => {
		if ( ! values[ field ] ) {
			errors[ field ] = translate( 'This field is required' );
		}
	} );

	if ( countriesData[ country ] ) {
		if ( includes( USPS_COUNTRIES, country ) ) {
			if ( ! /^\d{5}(?:-\d{4})?$/.test( postcode ) ) {
				errors.postcode = translate( 'Invalid ZIP code format' );
			}
		}

		if ( ! isEmpty( countriesData[ country ].states ) && ! state ) {
			errors.state = translate( 'This field is required' );
		}
	}

	if ( ignoreValidation ) {
		Object.keys( errors ).forEach( ( field ) => {
			if ( ignoreValidation[ field ] ) {
				delete errors[ field ];
			}
		} );
	}

	return errors;
};

const getPackagesErrors = ( values ) => mapValues( values, ( pckg ) => {
	const errors = {};

	if ( 'not_selected' === pckg.box_id ) {
		errors.box_id = translate( 'Please select a package' );
	}

	const isInvalidDimension = ( dimension ) => ( ! isFinite( dimension ) || 0 >= dimension );

	if ( isInvalidDimension( pckg.weight ) ) {
		errors.weight = translate( 'Invalid weight' );
	}

	const hasInvalidDimensions = some( [
		pckg.length,
		pckg.width,
		pckg.height,
	], isInvalidDimension );
	if ( hasInvalidDimensions ) {
		errors.dimensions = translate( 'Package dimensions must be greater than zero' );
	}

	return errors;
} );

export const getCustomsErrors = ( packages, customs ) => {
	const usedProductIds = uniq( flatten( map( packages, pckg => map( pckg.items, 'product_id' ) ) ) );
	return {
		packages: mapValues( packages, ( pckg ) => {
			const errors = {};

			if ( 'other' === pckg.contentsType && ! pckg.contentsExplanation ) {
				errors.contentsExplanation = translate( 'Please describe what kind of goods this package contains' );
			}

			if ( 'other' === pckg.restrictionType && ! pckg.restrictionExplanation ) {
				errors.restrictionExplanation = translate( 'Please describe what kind of restrictions this package must have' );
			}

			const totalValue = sumBy( pckg.items, ( { quantity, product_id } ) => quantity * customs.items[ product_id ].value );
			if ( totalValue > 2500 && ! pckg.itn ) {
				errors.itn = translate( 'ITN is required for shipments over $2,500' );
			}

			return errors;
		} ),

		items: mapValues( pick( customs.items, usedProductIds ), ( itemData, productId ) => {
			const itemErrors = {};
			if ( ! itemData.description ) {
				itemErrors.description = translate( 'This field is required' );
			}
			if ( ! customs.ignoreTariffNumberValidation[ productId ] && 6 !== itemData.tariffNumber.length ) {
				itemErrors.tariffNumber = translate( 'The tariff code must be 6 digits long' );
			}
			return itemErrors;
		} ),
	};
};

export const getRatesErrors = ( { values: selectedRates, available: allRates } ) => {
	return {
		server: mapValues( allRates, ( rate ) => {
			if ( ! rate.errors ) {
				return;
			}

			return rate.errors.map( ( error ) =>
				error.userMessage ||
				error.message ||
				translate( "We couldn't get a rate for this package, please try again." )
			);
		} ),
		form: mapValues( selectedRates, ( ( rate ) => rate ? null : translate( 'Please choose a rate' ) ) ),
	};
};

const getSidebarErrors = ( paperSize ) => {
	const errors = {};
	if ( ! paperSize ) {
		errors.paperSize = translate( 'This field is required' );
	}
	return errors;
};

export const getFormErrors = createSelector(
	( state, orderId, siteId = getSelectedSiteId( state ) ) => {
		if ( ! isLoaded( state, orderId, siteId ) ) {
			return {};
		}

		const shippingLabel = getShippingLabel( state, orderId, siteId );
		const { countriesData } = shippingLabel.storeOptions;
		const { form, paperSize } = shippingLabel;
		if ( isEmpty( form ) ) {
			return;
		}
		return {
			origin: getAddressErrors( form.origin, countriesData ),
			destination: getAddressErrors( form.destination, countriesData ),
			packages: getPackagesErrors( form.packages.selected ),
			customs: getCustomsErrors( form.packages.selected, form.customs ),
			rates: getRatesErrors( form.rates ),
			sidebar: getSidebarErrors( paperSize ),
		};
	},
	( state, orderId, siteId = getSelectedSiteId( state ) ) => [
		getShippingLabel( state, orderId, siteId ),
	]
);

export const isCustomsFormStepSubmitted = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const form = getForm( state, orderId, siteId );
	if ( ! form ) {
		return false;
	}

	const usedProductIds = uniq( flatten( map( form.packages.selected, pckg => map( pckg.items, 'product_id' ) ) ) );
	return ! some( usedProductIds.map( productId => form.customs.ignoreTariffNumberValidation[ productId ] ) );
};

/**
 * Checks the form for errors and returns a step with an error in it or null
 * @param {Object} state global state tree
 * @param {Object} orderId order Id
 * @param {Object} siteId site Id
 *
 * @returns {String} erroneous step name or null
 */
export const getFirstErroneousStep = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	const form = getForm( state, orderId, siteId );
	if ( ! form ) {
		return null;
	}

	const errors = getFormErrors( state, orderId, siteId );

	if ( ! form.origin.isNormalized ||
		! isEqual( form.origin.values, form.origin.normalized ) ||
		hasNonEmptyLeaves( errors.origin ) ) {
		return 'origin';
	}

	if ( ! form.destination.isNormalized ||
		! isEqual( form.destination.values, form.destination.normalized ) ||
		hasNonEmptyLeaves( errors.destination ) ) {
		return 'destination';
	}

	if ( hasNonEmptyLeaves( errors.packages ) ) {
		return 'packages';
	}

	if ( needsCustomsForm( state, orderId, siteId ) &&
		( hasNonEmptyLeaves( errors.customs ) || ! isCustomsFormStepSubmitted( state, orderId, siteId ) ) ) {
		return 'customs';
	}

	if ( hasNonEmptyLeaves( errors.rates ) ) {
		return 'rates';
	}

	return null;
};

export const canPurchase = createSelector(
	( state, orderId, siteId = getSelectedSiteId( state ) ) => {
		const form = getForm( state, orderId, siteId );

		return (
			! isEmpty( form ) &&
			! getFirstErroneousStep( state, orderId, siteId ) &&
			! form.origin.normalizationInProgress &&
			! form.destination.normalizationInProgress &&
			! form.rates.retrievalInProgress &&
			! isEmpty( form.rates.available )
		);
	},
	( state, orderId, siteId = getSelectedSiteId( state ) ) => [
		getForm( state, orderId, siteId ),
		getFirstErroneousStep( state, orderId, siteId ),
	]
);

export const areLabelsFullyLoaded = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	return isLoaded( state, orderId, siteId ) && areSettingsLoaded( state, siteId ) && arePackagesLoaded( state, siteId );
};

export const isLabelDataFetchError = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	return isError( state, orderId, siteId ) || areSettingsErrored( state, siteId ) || arePackagesErrored( state, siteId );
};

export const getCountriesData = ( state, orderId, siteId = getSelectedSiteId( state ) ) => {
	if ( ! isLoaded( state, orderId, siteId ) ) {
		return null;
	}

	const shippingLabel = getShippingLabel( state, orderId, siteId );
	return shippingLabel.storeOptions.countriesData;
};
