import { css } from '@emotion/core';
import { IconButton, PrimaryButton, SuccessButton, TertiaryButton } from '@entur/button';
import { ResetIcon, SwitchIcon } from '@entur/icons';
import { Contrast } from '@entur/layout';
import { colors } from '@entur/tokens';
import capitalize from 'lodash/capitalize';
import debounce from 'lodash/debounce';
import groupBy from 'lodash/groupBy';
import isEmpty from 'lodash/isEmpty';
import React from 'react';
import { connect } from 'react-redux';
import { compose, Dispatch } from 'redux';
import { Field, FieldArray, formValueSelector, InjectedFormProps, reduxForm } from 'redux-form';
import { Accordion, Form, Grid, Header, Segment } from 'semantic-ui-react';

import { S, XL, XL3 } from '../../../../../components/DesignSystemWrappers/spacings';
import CheckboxField from '../../../../../components/FormFields/CheckboxField';
import DatePickerInputField from '../../../../../components/FormFields/DatePickerInputField';
import DurationInputField from '../../../../../components/FormFields/DurationInputField';
import FlagSelectField from '../../../../../components/FormFields/FlagSelectField';
import { required, validTimeString } from '../../../../../components/FormFields/formValidators';
import TimeInputField from '../../../../../components/FormFields/TimeInputField';
import { formatTime, padTime } from '../../../../../components/FormWrappers/normalizers';
import Icon from '../../../../../components/Icon';
import Journey from '../../../../../components/Journey';
import Itineraries from '../../../../../components/Journey/Itineraries';
import MoneyLabel from '../../../../../components/Labels/MoneyLabel';
import PleaseWaitLoader from '../../../../../components/Loaders/PleaseWaitLoader';
import { ExpandableErrorMessage } from '../../../../../components/Messages/ErrorMessage';
import NotFoundMessage from '../../../../../components/Messages/NotFoundMessage';
import { HOTKEYS } from '../../../../../contexts/Hotkeys/HotkeyConstants';
import HotkeyOnClickWrapper from '../../../../../contexts/Hotkeys/HotkeyOnClickWrapper';
import { locationSearch as locationSearchApi } from '../../../../../httpclients/internationalSalesClient';
import * as Types from '../../../../../types.d';
import { Itinerary } from '../../../../../types/internationalSaleTypes';
import { formatDateAsDayNameAndDate, formatDateTimeAsOnlyTime } from '../../../../../utils/dateUtils';
import { isNotNil } from '../../../../../utils/objectUtils';
import { isBlank } from '../../../../../utils/stringUtils';
import * as actions from '../../../actions';
import { BOOKING_RULES, INTERNATIONAL_SALE_WIZARD_FORM, INTERNATIONAL_SALE_WIZARD_FORM_INITIAL_VALUES } from '../../../constants';
import {
  selectBookItineraryError,
  selectBookItineraryIsPending,
  selectBookItinerarySuccess,
  selectDiscountCodes,
  selectFetchDiscountCodesIsPending,
  selectFetchPassengerCategoriesIsPending,
  selectFetchTimetableError,
  selectFetchTimetableIsPending,
  selectInternationalOrderOverview,
  selectPassengerCategories,
  selectTimetable,
} from '../../../selectors';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
// @ts-ignore -- IGNORED DURING CONVERSION: TS7016: Could not find a declaration file for module './commonUIUtils'. '/Users/eirikvageskar/ess-client/src/pages/InternationalSalesPage/subPages/BuilderPage/components/commonUIUtils.js' implicitly has an 'any' type.
import { syncValidPassengerCategoryForTravellersOnContextSwitch } from './commonUIUtils';
import TravellersTable from './TravellersTable';

const mapDispatchToProps = (dispatch: Dispatch<Types.RootAction>) => ({
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'payload' implicitly has an 'any' type.
  bookItineraryRequest: (payload) => dispatch(actions.bookItineraryRequest(payload)),
  fetchDiscountCodes: () => dispatch(actions.fetchDiscountCodesRequest()),
  fetchPassengerCategories: () => dispatch(actions.fetchInternationalPassengerCategoriesRequest()),
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'values' implicitly has an 'any' type.
  fetchTimetable: (values) => dispatch(actions.fetchInternationalTimetableRequest(values)),
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'state' implicitly has an 'any' type.
  resetTimetableResult: (state) => dispatch(actions.resetTimetableResult(state)),
});

const formSelector = formValueSelector(INTERNATIONAL_SALE_WIZARD_FORM);

const mapStateToProps = (state: Types.RootState) => ({
  bookItineraryError: selectBookItineraryError(state),
  bookItinerarySuccess: selectBookItinerarySuccess(state),
  compartmentCodes: formSelector(state, 'compartmentCode'),
  discountCodes: selectDiscountCodes(state),
  fetchTimetableError: selectFetchTimetableError(state),
  flexibility: formSelector(state, 'flexibility'),
  fromCountry: formSelector(state, 'fromCountry'),
  interrailProduct: formSelector(state, 'interrailProduct'),
  isBookingItinerary: selectBookItineraryIsPending(state),
  isFetchingDiscountCodes: selectFetchDiscountCodesIsPending(state),
  isFetchingPassengerCategories: selectFetchPassengerCategoriesIsPending(state),
  isFetchingTimetable: selectFetchTimetableIsPending(state),
  internationalOrderOverview: selectInternationalOrderOverview(state),
  passengerCategories: selectPassengerCategories(state),
  priceGroup: formSelector(state, 'priceGroup'),
  productProducer: formSelector(state, 'productProducer'),

  // Ensure boolean value as this might be set to empty string by redux-form
  sameDiscountForAll: !!formSelector(state, 'sameDiscountForAll'),

  // Ensure boolean value as this might be set to empty string by redux-form
  samePassengerCategoryForAll: !!formSelector(state, 'samePassengerCategoryForAll'),

  samePassengerClassForAll: !!formSelector(state, 'samePassengerClassForAll'),
  seatCharacteristics: formSelector(state, 'seatCharacteristics'),
  seatOnly: formSelector(state, 'seatOnly'),
  seatOrientations: formSelector(state, 'seatOrientation'),
  timetable: selectTimetable(state),
  toCountry: formSelector(state, 'toCountry'),
  travelDate: formSelector(state, 'travelDate'),
  travellers: formSelector(state, 'travellers'),
  travelTime: formSelector(state, 'travelTime'),
  validFrom: formSelector(state, 'validFrom'),
});

const EMPTY_PLACEHOLDER_ICON = (
  <>
    <Icon name="map_pin" />
    Angi stasjon
  </>
);

type Props = ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps> & InjectedFormProps;

type State = {
  searchLocationsError: Record<string, unknown> | null | undefined;
  activeItem: number | null | undefined;
};

/** Specifies the delay in millis between invocations of the debounce function. */
const DEBOUNCE_DELAY = 300;

class ItineraryForm extends React.Component<Props, State> {
  // IMPORTANT: Validators must be defined outside render()
  fromCountryValidator = required('avreisested');

  toCountryValidator = required('destinasjon');

  travelDateValidator = required('avreisedato');

  travelTimeValidator = [required('avreisetidspunkt'), validTimeString];

  debounceLocationSearch = debounce((name, callback) => {
    locationSearchApi(name)
      .then((locations) => {
        this.setState({ searchLocationsError: null });
        callback(null, { options: locations });
      })
      .catch((error) => {
        this.setState({ searchLocationsError: error.message });
        callback(error, null);
      });
  }, DEBOUNCE_DELAY);

  state = {
    activeItem: null,
    searchLocationsError: null,
  };

  componentDidMount() {
    const { discountCodes, fetchDiscountCodes, passengerCategories, fetchPassengerCategories, travellers } = this.props;

    // Only fetch passenger categories and discount codes if they don't already exist
    if (isEmpty(discountCodes)) {
      fetchDiscountCodes();
    }

    if (isEmpty(passengerCategories)) {
      fetchPassengerCategories();
    } else if (travellers) {
      // Remove any passenger categories remaining from InterrailForm that doesn't exist for itineraries
      // and switch to similar for categories with same code or name.
      syncValidPassengerCategoryForTravellersOnContextSwitch(this.props, passengerCategories);
    }
  }

  // eslint-disable-next-line camelcase,,@typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'nextProps' implicitly has an 'any' type.
  UNSAFE_componentWillReceiveProps(nextProps) {
    const { change, resetTimetableResult } = this.props;
    if (nextProps.bookItinerarySuccess) {
      this.handleResetForm(false);
      resetTimetableResult(this.props);
    }

    // If the special seatOnly "discount" ('Pinta plassbillett') is set, then remove any other discounts set for travellers
    // as seatOnly can't be used together with other discounts
    if (nextProps.seatOnly === true) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'index' implicitly has an 'any' type.
      nextProps.travellers.forEach((traveller, index) => {
        change(`travellers[${index}].discount`, null);
      });
    }
  }

  componentDidUpdate() {
    const { travellers, passengerCategories } = this.props;
    // Remove any passenger categories remaining from InterrailForm that doesn't exist for itineraries and
    // switch to similar for categories with same code or name.
    // Note: Must be here as well as in componentDidMount, since we need to trigger this the first time ItineraryForm is rendered
    // and we need access to passengerCategories, which are fetched in componentDidMount
    if (travellers && !isEmpty(passengerCategories)) {
      syncValidPassengerCategoryForTravellersOnContextSwitch(this.props, passengerCategories);
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'callback' implicitly has an 'any' type.
  handleLocationSearch = (name, callback) => {
    if (isBlank(name)) {
      // Note: The callback is only used when input is not empty (see https://github.com/JedWatson/react-select/issues/614#issuecomment-380763225)
      return Promise.resolve({ options: [] });
    }
    return this.debounceLocationSearch(name, callback);
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7031: Binding element 'travelTime' implicitly has an 'any' type.
  handleFetchTimetable = ({ fromCountry, seatOnly, toCountry, transitTime, travelDate, travellers, travelTime }) => {
    const { fetchTimetable } = this.props;
    const passengerCategories = travellers
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'traveller' implicitly has an 'any' type.
      .filter((traveller) => traveller?.isTravelling)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS7031: Binding element 'surname' implicitly has an 'any' type.
      .map(({ birthDate, category, discount, firstName, surname }) => ({
        birthDate,
        firstName,
        surname,
        value: category.value,
        plaintext: category.plaintext,
        discountCode: discount?.value ?? null,
      }));

    const payloadBase = {
      localDate: travelDate,
      localTime: travelTime,
      departureProducerCode: fromCountry.locationProducerCode,
      departureLocationId: fromCountry.locationId,
      arrivalProducerCode: toCountry.locationProducerCode,
      arrivalLocationId: toCountry.locationId,
      seatOnly,
      passengerCategories,
    };

    const payload = transitTime === undefined ? payloadBase : { ...payloadBase, transitTime };

    fetchTimetable(payload);

    this.setState({ activeItem: null });
  };

  handleSwitchFromAndToCountry = () => {
    const { change, toCountry, fromCountry } = this.props;
    change('toCountry', fromCountry || null);
    change('fromCountry', toCountry || null);
  };

  handleResetForm = (resetEverything = true) => {
    const {
      fromCountry,
      initialize,
      interrailProduct,
      productProducer,
      resetTimetableResult,
      sameDiscountForAll,
      samePassengerCategoryForAll,
      samePassengerClassForAll,
      toCountry,
      travelDate,
      travellers,
      travelTime,
      validFrom,
    } = this.props;

    initialize({
      // Include all values from the initial values constant, and override some of them
      ...INTERNATIONAL_SALE_WIZARD_FORM_INITIAL_VALUES,
      // The handleResetForm function is used on both 'itinerary book success' and 'Nullstill',
      // but in the case of 'itinerary book success' we want to keep the values of travelDate, travelTime, fromCountry and toCountry
      travelDate: resetEverything ? new Date() : travelDate,
      travelTime: resetEverything ? formatDateTimeAsOnlyTime(new Date()) : travelTime,
      toCountry: resetEverything ? null : toCountry,
      fromCountry: resetEverything ? null : fromCountry,
      sameDiscountForAll,
      travellers,
      // Keep values in the Interrail part of the form
      validFrom,
      productProducer,
      interrailProduct,
      samePassengerCategoryForAll,
      samePassengerClassForAll,
    });

    resetTimetableResult(this.props);
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'data' implicitly has an 'any' type.
  setSameValueForAllTravellersForFieldOfType = (fieldType: 'string') => (event, data) => {
    const { travellers, autofill } = this.props;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
    // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'index' implicitly has an 'any' type.
    travellers.forEach((traveller, index) => {
      if (index === 0) {
        return;
      } // First traveller's field is used to change all travellers' fields when same<field>ForAll is set
      autofill(`travellers[${index}].${fieldType}`, data);
    });
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'accordionTitleProps' implicitly has an 'any' type.
  // eslint-disable-next-line unicorn/prevent-abbreviations -- DISABLED IN A BATCH JOB
  handleItemClick = (e, accordionTitleProps) => {
    const { array } = this.props;
    const { index, active: isActive } = accordionTitleProps;
    const newIndex = isActive ? null : index;
    const arrayFields = ['priceGroup', 'flexibility', 'compartmentCode', 'seatCharacteristics', 'seatOrientation'];

    this.setState({ activeItem: newIndex });

    arrayFields.forEach((field) => {
      array.removeAll(field);
    });
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'values' implicitly has an 'any' type.
  // eslint-disable-next-line sonarjs/cognitive-complexity -- DISABLED IN A BATCH JOB
  handleBookItinerary = (values) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DISABLED IN A BATCH JOB
    type Placement = { placementOrientation: any; placementCharacteristics: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DISABLED IN A BATCH JOB
    type Compartment = { compartmentCode: any };

    const formatPlacementSpecification = (
      itinerary: Itinerary,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS2749: 'Segment' refers to a value, but is being used as a type here. Did you mean 'typeof Segment'?
      segment: Segment
    ): { placementSpecification?: Placement | Compartment | (Placement & Compartment) } => {
      const { itineraryReference } = itinerary;
      const { segmentReference, bookingRule } = segment;

      const seatBookingUnavailable = bookingRule === BOOKING_RULES.NOT_BOOKABLE;
      if (seatBookingUnavailable) {
        return {};
      }
      const placementOrientation = values.seatOrientation?.[itineraryReference]?.[segmentReference];
      const placementCharacteristics = values.seatCharacteristics?.[itineraryReference]?.[segmentReference];
      const placementObject = placementOrientation && placementCharacteristics ? { placementOrientation, placementCharacteristics } : {};
      const compartmentCode = values.compartmentCode?.[itineraryReference]?.[segmentReference];
      const compartmentObject = compartmentCode ? { compartmentCode } : {};
      const eitherHasContent = !isEmpty(placementObject) || !isEmpty(compartmentObject);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS2322: Type '{ placementSpecification: { compartmentCode: any; placementOrientation: any; placementCharacteristics: any; } | { compartmentCode?: undefined; placementOrientation: any; placementCharacteristics: any; } | { ...; } | { ...; }; } | {}' is not assignable to type '{ placementSpecification?: Placement | Compartment | (Placement & Compartment) | undefined; }'.
      return eitherHasContent ? { placementSpecification: { ...placementObject, ...compartmentObject } } : {};
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
    // @ts-ignore -- IGNORED DURING CONVERSION: TS2749: 'Segment' refers to a value, but is being used as a type here. Did you mean 'typeof Segment'?
    const formatSegment = (itinerary: Itinerary, segment: Segment) => {
      const placementSpecification = formatPlacementSpecification(itinerary, segment);
      const { seatOptions, ...segmentRest } = segment;
      return { ...segmentRest, ...placementSpecification };
    };

    const formatItinerary = (itinerary: Itinerary) => {
      const { segments, itineraryReference } = itinerary;
      // TODO 2020-02-28 (Roy P.): As long as we don't have validation of required fields, we cannot ensure that these values are specified
      const flexibilityComponent = values.priceGroup?.[itineraryReference]?.flexibilityOptions?.componentNumber;
      const flexibilityVariant = values.flexibility?.[itineraryReference]?.variantNumber;
      const flexibilityOptions = values.priceGroup?.[itineraryReference]?.flexibilityOptions ? { flexibilityComponent, flexibilityVariant } : {};

      const formattedSegments = segments.map((segment) => formatSegment(itinerary, segment));

      const { validPriceGroups, ...itineraryRest } = itinerary;
      const priceGroupCode = values.priceGroup?.[itineraryReference]?.pricegroup;
      return { ...itineraryRest, ...flexibilityOptions, priceGroupCode, segments: formattedSegments };
    };

    const { internationalOrderOverview, timetable, bookItineraryRequest } = this.props;
    const { activeItem } = this.state;

    // `== null` is the native equivalent of isNil; needed because activeItem could be 0, which is falsy
    if (!timetable || activeItem == null) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
    // @ts-ignore -- IGNORED DURING CONVERSION: TS2538: Type 'null' cannot be used as an index type.
    const journey = timetable[activeItem];

    if (!journey) {
      return;
    }

    const { journeyConnectionReference, itineraries } = journey;
    const formattedItineraries = itineraries.map(formatItinerary);

    const { seatOnly, travellers } = values;
    const formattedOrder = { journeyConnectionReference, seatOnly };

    const formattedTravellers = (travellers ?? [])
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'traveller' implicitly has an 'any' type.
      .filter((traveller) => traveller.isTravelling)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'traveller' implicitly has an 'any' type.
      .map((traveller) => ({
        birthDate: traveller.birthDate,
        travellerNumber: traveller.travellerNumber,
        firstName: traveller.firstName,
        surname: traveller.surname,
        contactDetails: traveller.contactDetails,
        passengerCategory: {
          value: traveller.category.value,
          plaintext: traveller.category.plaintext,
          discountCode: traveller.discount?.value ?? null,
          birthDate: traveller.birthDate,
        },
        itineraries: formattedItineraries,
      }));

    const item = { order: formattedOrder, travellers: formattedTravellers };

    bookItineraryRequest({ salesOrderId: internationalOrderOverview?.order.salesOrderId, payload: item });
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'compartmentCodes' implicitly has an 'any' type.
  sumPrice = (priceGroup, flexibility, seatOrientations, seatCharacteristics, compartmentCodes) => {
    if (!priceGroup || isEmpty(priceGroup)) {
      return 0;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
    // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'group' implicitly has an 'any' type.
    const amountSum = priceGroup.reduce((accumulator, group) => accumulator + (group?.price?.amount ?? 0), 0);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
    // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'someArray' implicitly has an 'any' type.
    const getNonEmptyIndices = (someArray) =>
      someArray
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
        // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'index' implicitly has an 'any' type.
        .map((value, index) => {
          const definedValues = (value ?? []).filter(isNotNil);
          if (!isEmpty(definedValues)) {
            return index;
          }
          return null;
        })
        .filter(isNotNil);

    const orientationIndices = getNonEmptyIndices(seatOrientations ?? []);
    const characteristicsIndices = getNonEmptyIndices(seatCharacteristics ?? []);
    const compartmentIndices = getNonEmptyIndices(compartmentCodes ?? []);

    const itinerarySeats = new Set([...orientationIndices, characteristicsIndices, compartmentIndices].filter(isNotNil));

    const seatSum = priceGroup
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'index' implicitly has an 'any' type.
      .filter((pg, index) => itinerarySeats.has(index))
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'pg' implicitly has an 'any' type.
      .map((pg) => pg?.seatPrice?.amount ?? 0)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
      // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'next' implicitly has an 'any' type.
      .reduce((accumulator, next) => accumulator + next, 0);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
    // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'f' implicitly has an 'any' type.
    const flexSum = (flexibility ?? []).reduce((accumulator, f) => accumulator + (f?.price?.amount ?? 0), 0);

    return amountSum + seatSum + flexSum;
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'timetable' implicitly has an 'any' type.
  timetableResultsGroupedByDay = (timetable) => groupBy(timetable, (timetableItem) => formatDateAsDayNameAndDate(timetableItem.summary.departureDate));

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
  // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'compartmentCodes' implicitly has an 'any' type.
  renderTimetableResults = (timetable, activeItem, priceGroup, flexibility, isBookingItinerary, seatOrientations, seatCharacteristics, compartmentCodes) => {
    const { handleSubmit } = this.props;
    if (timetable.length === 0) {
      return <NotFoundMessage type="trips" />;
    }
    const resultsGroupedByDay = this.timetableResultsGroupedByDay(timetable);
    return (
      <Accordion className="international-itinerary-timetable-list">
        {Object.entries(resultsGroupedByDay).map(([date, timetableForDay]) => (
          <React.Fragment key={date}>
            <Header className="no-margin-top" content={capitalize(date)} textAlign="center" />
            {timetableForDay.map((journey, index) => (
              <React.Fragment key={journey.journeyConnectionReference}>
                <Accordion.Title active={activeItem === index} index={index} onClick={this.handleItemClick}>
                  <Journey journey={journey} selected={activeItem === index} />
                </Accordion.Title>
                <Accordion.Content active={activeItem === index}>
                  {activeItem === index && (
                    <Segment>
                      <PleaseWaitLoader active={isBookingItinerary} message="Reserverer strekning" size="large">
                        <Grid>
                          <Grid.Row>
                            <Grid.Column>
                              <Itineraries
                                journey={journey}
                                // Extra props rain down on the object here. Find out which are needed
                                // eslint-disable-next-line react/jsx-props-no-spreading
                                {...this.props}
                              />
                            </Grid.Column>
                          </Grid.Row>
                          <Grid.Row>
                            <Grid.Column floated="right" textAlign="right">
                              <MoneyLabel amount={this.sumPrice(priceGroup, flexibility, seatOrientations, seatCharacteristics, compartmentCodes)} />
                              <SuccessButton
                                css={{ float: 'right' }}
                                disabled={!journey.sellable}
                                loading={isBookingItinerary}
                                onClick={handleSubmit(this.handleBookItinerary)}
                              >
                                Reserver strekning
                              </SuccessButton>
                            </Grid.Column>
                          </Grid.Row>
                        </Grid>
                      </PleaseWaitLoader>
                    </Segment>
                  )}
                </Accordion.Content>
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </Accordion>
    );
  };

  render() {
    const { activeItem } = this.state;
    const {
      bookItineraryError,
      compartmentCodes,
      discountCodes,
      fetchTimetableError,
      flexibility,
      isBookingItinerary,
      isFetchingDiscountCodes,
      isFetchingPassengerCategories,
      isFetchingTimetable,
      passengerCategories,
      priceGroup,
      sameDiscountForAll,
      samePassengerCategoryForAll,
      seatCharacteristics,
      seatOnly,
      seatOrientations,
      timetable,
      handleSubmit,
    } = this.props;
    const { searchLocationsError } = this.state;

    return (
      <>
        <Contrast
          css={css`
            margin: -${XL} -${XL3} 0;
            padding: ${XL} ${XL3};
            background: ${colors.blues.blue10};
          `}
        >
          <div
            css={css`
              display: flex;
              align-items: flex-start;
              justify-content: flex-end;
              margin-bottom: ${S};
            `}
          >
            <HotkeyOnClickWrapper overrideDefaultSequenceKey={HOTKEYS.UTILS.RESET_SEARCH} tooltipDirection="bottom">
              <TertiaryButton onClick={() => this.handleResetForm()} type="button">
                <ResetIcon />
                Nullstill søk
              </TertiaryButton>
            </HotkeyOnClickWrapper>
          </div>
          <Form error>
            <Form.Group>
              <Form.Field
                async
                autoload={false}
                cache={false}
                component={FlagSelectField}
                control={Field}
                flagKey="locationProducerCode"
                ignoreAccents
                label="Fra"
                labelKey="locationName"
                loadingPlaceholder="Søker etter stasjoner..."
                loadOptions={this.handleLocationSearch}
                matchProp="label"
                name="fromCountry"
                placeholder={EMPTY_PLACEHOLDER_ICON}
                searchPromptText="Hvor reiser kunden fra?"
                validate={this.fromCountryValidator}
                valueKey="locationId"
                width={4}
              />
              <div css={{ marginTop: XL }}>
                <IconButton onClick={this.handleSwitchFromAndToCountry} tabIndex={-1} type="button">
                  <SwitchIcon />
                </IconButton>
              </div>
              <Form.Field
                async
                autoload={false}
                cache={false}
                component={FlagSelectField}
                control={Field}
                flagKey="locationProducerCode"
                ignoreAccents
                label="Til"
                labelKey="locationName"
                loadingPlaceholder="Søker etter stasjoner..."
                loadOptions={this.handleLocationSearch}
                matchProp="label"
                name="toCountry"
                placeholder={EMPTY_PLACEHOLDER_ICON}
                searchPromptText="Hvor skal kunden?"
                validate={this.toCountryValidator}
                valueKey="locationId"
                width={4}
              />
              <Form.Field
                component={DatePickerInputField}
                control={Field}
                label="Avreisedato"
                minDate="today"
                name="travelDate"
                validate={this.travelDateValidator}
                width={2}
              />
              <Form.Field
                component={TimeInputField}
                control={Field}
                formatOnBlur={padTime}
                label="Avreisetidspunkt"
                name="travelTime"
                normalize={formatTime}
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- DISABLED DURING CONVERSION
                // @ts-ignore -- IGNORED DURING CONVERSION: TS7006: Parameter 'e' implicitly has an 'any' type.
                onFocus={(event) => event.target.select()}
                validate={this.travelTimeValidator}
                width={2}
              />
              <Form.Field
                component={DurationInputField}
                control={Field}
                label="Minste byttetid"
                name="transitTime"
                placeholder="i minutter"
                type="number"
                width={2}
              />
              <Form.Field component={CheckboxField} control={Field} label="Pinta plassbillett" name="seatOnly" type="checkbox" width={2} />
            </Form.Group>
            <FieldArray
              component={TravellersTable}
              discountCodes={discountCodes}
              discountsDisabled={seatOnly}
              isFetchingDiscountCodes={isFetchingDiscountCodes}
              isFetchingPassengerCategories={isFetchingPassengerCategories}
              name="travellers"
              passengerCategories={passengerCategories}
              sameDiscountForAll={sameDiscountForAll}
              samePassengerCategoryForAll={samePassengerCategoryForAll}
              setSameValueForAllFieldsOfType={this.setSameValueForAllTravellersForFieldOfType}
            />
            <div css={{ display: 'grid', justifyContent: 'flex-end' }}>
              <PrimaryButton
                onClick={handleSubmit(
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore -- IGNORED DURING CONVERSION: TS2769: No overload matches this call.
                  this.handleFetchTimetable
                )}
              >
                Søk
              </PrimaryButton>
            </div>
          </Form>
        </Contrast>
        <PleaseWaitLoader active={isFetchingTimetable} dimParentComponent={false} message="Søker etter strekninger" padded={false}>
          {timetable && (
            <Segment attached="bottom" secondary>
              <Header
                css={css`
                  position: absolute;
                  top: 1.2rem;
                `}
              >
                Søkeresultat <span css={{ fontWeight: 'normal' }}>({timetable.length})</span>
              </Header>
              {this.renderTimetableResults(
                timetable,
                activeItem,
                priceGroup,
                flexibility,
                isBookingItinerary,
                seatOrientations,
                seatCharacteristics,
                compartmentCodes
              )}
            </Segment>
          )}
        </PleaseWaitLoader>
        <ExpandableErrorMessage error={fetchTimetableError} title="Feil i strekningssøk" />
        <ExpandableErrorMessage error={bookItineraryError} title="Kunne ikke reservere strekning" />
        <ExpandableErrorMessage error={searchLocationsError} title="Kunne ikke søke etter stasjoner" />
      </>
    );
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  reduxForm({
    destroyOnUnmount: false, // Preserve form data
    forceUnregisterOnUnmount: true, // Unregister fields on unmount
    form: INTERNATIONAL_SALE_WIZARD_FORM,
    initialValues: INTERNATIONAL_SALE_WIZARD_FORM_INITIAL_VALUES,
    warn: () => ({}), // Clear out any warnings that might remain from InterrailForm (warnIfTooFewAdultsForChildren)
  })
)(
  ItineraryForm
  // Cast to avoid the error "JSX element type 'ItineraryForm' does not have any construct or call signatures."
) as React.ComponentType;
