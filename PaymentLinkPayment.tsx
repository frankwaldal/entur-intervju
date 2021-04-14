import { css } from '@emotion/core';
import { IconButton } from '@entur/button';
import { Checkbox, TextArea } from '@entur/form';
import { ResetIcon } from '@entur/icons';
import { colors } from '@entur/tokens';
import { Label } from '@entur/typography';
import { yupResolver } from '@hookform/resolvers/yup';
import { endOfDay } from 'date-fns';
import capitalize from 'lodash/capitalize';
import head from 'lodash/head';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

import { L, M, S, XS, XS2 } from '../../../components/DesignSystemWrappers/spacings';
import HookFormCheckboxGroup from '../../../components/FormWrappers/CheckboxGroup/HookFormCheckboxGroup';
import HookFormDatePicker from '../../../components/FormWrappers/DatePicker/HookFormDatePicker';
import { PhoneInputValidationSchema } from '../../../components/FormWrappers/PhoneInput/constants';
import HookFormPhoneInput from '../../../components/FormWrappers/PhoneInput/HookFormPhoneInput';
import { PhoneNumber } from '../../../components/FormWrappers/PhoneInput/types';
import { HookFormTextField } from '../../../components/FormWrappers/TextField/HookFormTextField';
import HookFormTimePicker from '../../../components/FormWrappers/TimePicker/HookFormTimePicker';
import { EmailSchema } from '../../../components/FormWrappers/validationSchemas';
import { AlertMessage } from '../../../components/Messages/AlertMessage';
import { ErrorMessage, ExpandableErrorMessage } from '../../../components/Messages/ErrorMessage';
import showToastNotification from '../../../components/Toasts/showToastNotification';
import { EMAIL_ADDRESS_NOUN } from '../../../constants/commonConstants';
import { PAYMENT_TYPE_GROUPS, PAYMENT_TYPE_GROUPS_TRANSLATION, PAYMENT_TYPES } from '../../../constants/paymentConstants';
import { fetchCustomer } from '../../../httpclients/customersClient';
import { MessageResponse, sendEmail, sendSms } from '../../../httpclients/messagingClient';
import { createPaymentLink } from '../../../httpclients/paymentPageOrchestratorClient';
import { CustomerInEss } from '../../../types/customerTypes';
import { Order } from '../../../types/orderTypes';
import { PaymentType, PaymentTypeGroup } from '../../../types/paymentTypes';
import CountryMapping from '../../../utils/CountryMapping';
import { addDaysToDate, concatenateDateAndTimeFields, formatDate, formatDateTimeAsOnlyTime, isDate } from '../../../utils/dateUtils';
import { calculateMaxDeadline, useFetchPreassignedProductsInOrder } from '../../../utils/domesticSalesUtils';
import { formatPickupCodeEmail } from '../../../utils/emailUtils';
import {
  formatPaymentLinkMessageText,
  getTravelDetailsTextFromOrder,
  MESSAGING_DISTRIBUTION_METHODS,
  MessagingDistributionMethod,
} from '../../../utils/messagingUtils';
import { isNotNil } from '../../../utils/objectUtils';
import { useMutationWithLazyResult, useQueryWithLazyResult } from '../../../utils/reactQueryUtils';
import { toNaturalLanguageList } from '../../../utils/stringUtils';
import { NOTE_CATEGORIES_FOR_SALES_AND_SERVICE, NOTE_TYPES } from '../../Notes/constants';
import { createNoteForOrder } from '../../Notes/utils';
import PayOrderBalanceButton from './PayOrderBalanceButton';

type PaymentLinkPaymentTypeGroup = Extract<PaymentTypeGroup, 'INVOICE'>;

type PaymentLinkPaymentType = Extract<PaymentType, 'COLLECTOR'>;

type FormValues = {
  enableEmail: boolean;
  enablePhone: boolean;
  emailAddress: string;
  phoneNumber: PhoneNumber;
  date: Date;
  time: Date;
  // TODO 2021.02.12 (Frank W.) Change to Array<PaymentLinkPaymentTypeGroup> when multiple methods are supported.
  paymentTypeGroups: PaymentLinkPaymentTypeGroup;
  paymentNote: string;
};

const sendConfirmationByEmail = async ({
  order,
  emailAddress,
  emailText,
}: {
  order: Order;
  emailAddress: string;
  emailText: string;
}): Promise<MessageResponse> => {
  const emailPayload = formatPickupCodeEmail({
    email: emailAddress,
    subject: `Betalingslenke fra Entur: ${order.id}`,
    body: emailText,
  });
  return sendEmail(emailPayload);
};

const sendConfirmationBySms = async ({
  phoneNumber,
  phoneText,
  countryCode,
}: {
  phoneNumber: string;
  phoneText: string;
  countryCode?: string;
}): Promise<MessageResponse> => {
  // This should not happen but we need to type-guard this regardless.
  if (!countryCode) {
    throw new Error('Du må oppgi landskode for å kunne sende SMS');
  }
  return sendSms({
    // The Messaging API does not support "+" in country codes.
    countryCode: countryCode.replace('+', ''),
    number: phoneNumber,
    text: phoneText,
  });
};

const PAYMENT_LINK_PAYMENT_TYPES = [
  {
    value: PAYMENT_TYPE_GROUPS.INVOICE,
    text: PAYMENT_TYPE_GROUPS_TRANSLATION.INVOICE,
  },
];
const PAYMENT_LINK_PAYMENT_TYPE_GROUP_PAYMENT_TYPE_MAPPING: Record<PaymentLinkPaymentTypeGroup, Array<PaymentLinkPaymentType>> = {
  INVOICE: [PAYMENT_TYPES.COLLECTOR],
};

const DEFAULT_PAYMENT_DEADLINE_IN_DAYS = 7;

export default function PaymentLinkPayment({
  onPaymentLinkPaymentSuccess,
  order,
}: {
  onPaymentLinkPaymentSuccess: () => void;
  order: Order;
}): React.ReactElement {
  const preassignedFareProductsQueries = useFetchPreassignedProductsInOrder(order);
  return preassignedFareProductsQueries.dispatch(
    () => <>Ikke spurt</>,
    () => <>Laster</>,
    (error) => <ExpandableErrorMessage error={error} title="Klarte ikke hente refusjonsregler for produktene" />,
    (queries) => {
      const conditionSummaries = queries.map((query) => query.data.conditionSummary).filter(isNotNil);
      const latestAllowedPaymentDateResult = calculateMaxDeadline(
        order.orderLines.map((orderLine) => orderLine.travelSpecification?.aimedStartTime).filter(isNotNil),
        conditionSummaries.every((conditionSummary) => conditionSummary.isRefundable)
      );
      return latestAllowedPaymentDateResult.dispatch(
        (latestAllowedPaymentDate) => (
          <PaymentLinkForm latestAllowedPaymentDate={latestAllowedPaymentDate} onPaymentLinkPaymentSuccess={onPaymentLinkPaymentSuccess} order={order} />
        ),
        (error) => <AlertMessage alertReason={error.message} variant={error.type} />
      );
    }
  );
}

function PaymentLinkForm({
  latestAllowedPaymentDate,
  onPaymentLinkPaymentSuccess,
  order,
}: {
  latestAllowedPaymentDate: Date;
  onPaymentLinkPaymentSuccess: () => void;
  order: Order;
}): React.ReactElement {
  const [paymentNoteText, setPaymentNoteText] = React.useState<string>(makePaymentNoteText(['faktura']));

  const formMethods = useForm({
    resolver: yupResolver(getPaymentLinkValidationSchema(latestAllowedPaymentDate)),
  });
  const { errors, handleSubmit, register, setValue, watch } = formMethods;
  const { enableEmail, enablePhone } = watch(['paymentMethods', 'enableEmail', 'enablePhone']);

  const createdById = order.contactInfo?.createdBy?.id;

  const [fetchCustomerLazy] = useQueryWithLazyResult<CustomerInEss>({
    queryKey: ['fetchCustomer', createdById],
    queryFn: () => fetchCustomer(createdById as string),
    enabled: !!createdById,
  });

  const potentialCustomer = fetchCustomerLazy.value();

  React.useEffect(() => {
    if (enableEmail) {
      setValue('emailAddress', potentialCustomer?.email ?? '');
    }
    if (enablePhone) {
      setValue('phoneNumber.number', potentialCustomer?.telephoneNumberNoCountryCode ?? potentialCustomer?.telephoneNumber ?? '');
    }
  }, [potentialCustomer, enableEmail, enablePhone]);

  const defaultPaymentDate =
    endOfDay(addDaysToDate(new Date(), DEFAULT_PAYMENT_DEADLINE_IN_DAYS)) < latestAllowedPaymentDate
      ? endOfDay(addDaysToDate(new Date(), DEFAULT_PAYMENT_DEADLINE_IN_DAYS))
      : latestAllowedPaymentDate;

  const [createAndSendPaymentLinkLazy, { mutate: createAndSendPaymentLinkMutation }] = useMutationWithLazyResult(createAndSendPaymentLink, {
    onSuccess: () => {
      showToastNotification({ content: 'Betalingslenke er sendt' });
      onPaymentLinkPaymentSuccess();
    },
  });

  const updatePaymentNote = () => {
    // TODO 2021.02.16 (Frank W): Remove array around watch function when multiple payment methods are supported.
    const chosenPaymentTypeGroups = [watch('paymentTypeGroups')];
    const chosenPaymentTypeGroupsText = chosenPaymentTypeGroups.map(
      (chosenPaymentTypeGroup: string) =>
        head(PAYMENT_LINK_PAYMENT_TYPES.filter((paymentType) => paymentType.value === chosenPaymentTypeGroup))?.text.toLowerCase() ?? ''
    );
    setPaymentNoteText(makePaymentNoteText(chosenPaymentTypeGroupsText));
  };

  return (
    <FormProvider {...formMethods}>
      <form
        css={css`
          display: grid;
          gap: ${L};
          grid-template-columns: auto;
        `}
        onSubmit={handleSubmit((formValues: FormValues) => createAndSendPaymentLinkMutation({ formValues, order }))}
      >
        <div
          css={css`
            display: grid;
            gap: ${S} ${M};
            grid-template-columns: 1fr 1fr;
          `}
        >
          <Label css={{ gridColumn: 'span 2' }}>Betalingsfrist</Label>
          <HookFormDatePicker defaultValue={defaultPaymentDate} label="Dato" maxDate={latestAllowedPaymentDate} minDate={new Date()} name="date" />
          <HookFormTimePicker defaultValue={defaultPaymentDate} label="Tid" name="time" />
        </div>
        <div
          css={css`
            display: grid;
            gap: ${S};
            grid-template-columns: auto;
          `}
        >
          <Label>Hvordan ønsker kunden å få lenken tilsendt?</Label>
          <Checkbox ref={register} name="enableEmail">
            Send per e-post
          </Checkbox>
          {enableEmail ? (
            <HookFormTextField ref={register} css={{ marginBottom: XS }} label={capitalize(EMAIL_ADDRESS_NOUN.entallUbestemt)} name="emailAddress" />
          ) : null}
          <Checkbox ref={register} name="enablePhone">
            Send per SMS
          </Checkbox>
          {enablePhone ? (
            <div css={{ marginBottom: XS }}>
              <HookFormPhoneInput name="phoneNumber" />
            </div>
          ) : null}
        </div>
        <HookFormCheckboxGroup label="Hvilke betalingsvalg skal kunden få tilsendt?" name="paymentTypeGroups">
          {PAYMENT_LINK_PAYMENT_TYPES.map((paymentLinkPaymentType) => (
            <Checkbox
              key={paymentLinkPaymentType.value}
              ref={register}
              checked // TODO 2021.02.12 (Frank W.): Remove when multiple payment methods are supported.
              disabled // TODO 2021.02.12 (Frank W.): Remove when multiple payment methods are supported.
              name="paymentTypeGroups"
              onChange={updatePaymentNote}
              value={paymentLinkPaymentType.value}
            >
              {paymentLinkPaymentType.text}
            </Checkbox>
          ))}
        </HookFormCheckboxGroup>
        <div>
          <Label
            css={css`
              display: flex;
              justify-content: flex-end;
              align-items: center;
              cursor: pointer;
            `}
          >
            Tilbakestill
            <IconButton
              css={css`
                margin-left: ${XS2};
              `}
              onClick={updatePaymentNote}
              type="button"
            >
              <ResetIcon color={colors.brand.blue} />
            </IconButton>
          </Label>
          <TextArea ref={register} label="Merknad" name="paymentNote" onChange={(event) => setPaymentNoteText(event.target.value)} value={paymentNoteText} />
        </div>
        <div css={{ marginTop: `-${L}` }}>
          <PayOrderBalanceButton loading={fetchCustomerLazy.isLoading() || createAndSendPaymentLinkLazy.isLoading()} order={order} text="Send" />
        </div>
        <ErrorMessage error={errors.noPastDate ?? errors.moreThan24hoursBeforeDeparture ?? errors.atleastOneConfirmationField} />
        <ExpandableErrorMessage error={fetchCustomerLazy.error()} />
        <ExpandableErrorMessage error={createAndSendPaymentLinkLazy.error()} />
      </form>
    </FormProvider>
  );
}

function makePaymentNoteText(chosenPaymentTypeGroupsText: Array<string>) {
  return `Betalingslenke sendt til kunden ${formatDate(new Date())} kl. ${formatDateTimeAsOnlyTime(new Date())} med valg for ${toNaturalLanguageList(
    chosenPaymentTypeGroupsText
  )}.`;
}

async function createAndSendPaymentLink({ formValues, order }: { formValues: FormValues; order: Order }) {
  const { id: orderId, version: orderVersion } = order;
  const { paymentTypeGroups: chosenPaymentTypeGroups, date, time, emailAddress, phoneNumber, enableEmail, enablePhone, paymentNote } = formValues;
  // TODO 2021.02.12 (Frank W.): Remove [] around chosenPaymentTypeGroups when multiple payment methods are supported.
  const paymentMethods = [chosenPaymentTypeGroups].flatMap((paymentTypeGroup) =>
    PAYMENT_LINK_PAYMENT_TYPE_GROUP_PAYMENT_TYPE_MAPPING[paymentTypeGroup].map((paymentType: PaymentLinkPaymentType) => ({
      paymentTypeGroup,
      paymentType,
    }))
  );
  const deadline = concatenateDateAndTimeFields(date, time);
  const expireAt = deadline.toISOString();

  const { url: paymentLink } = await createPaymentLink({
    orderId,
    orderVersion,
    expireAt,
    paymentMethods,
  });
  if (paymentLink === undefined) {
    throw new Error('No URL found in PaymentLink');
  }
  if (enableEmail) {
    const customerMessage = await createMessageText(order, deadline, paymentLink, MESSAGING_DISTRIBUTION_METHODS.EMAIL);
    await sendConfirmationByEmail({ order, emailAddress, emailText: customerMessage });
  }
  if (enablePhone) {
    const customerMessage = await createMessageText(order, deadline, paymentLink, MESSAGING_DISTRIBUTION_METHODS.SMS);
    await sendConfirmationBySms({
      phoneNumber: phoneNumber.number,
      phoneText: customerMessage,
      countryCode: CountryMapping.getByAlpha2CountryCode(phoneNumber.prefix.value.toUpperCase())?.countryCallingCode,
    });
  }
  await createNoteForOrder(paymentNote, orderId, NOTE_TYPES.SALES_AND_SERVICE, NOTE_CATEGORIES_FOR_SALES_AND_SERVICE.OTHER);
}

async function createMessageText(order: Order, deadline: Date, paymentLink: string, distributionMethod: MessagingDistributionMethod): Promise<string> {
  const { id: orderId, totalAmount } = order;
  const travelDetailsTextFromOrder = await getTravelDetailsTextFromOrder(order);

  return formatPaymentLinkMessageText({
    distributionMethod,
    paymentLink,
    orderId,
    deadline,
    travelDetailsTextFromOrder,
    totalAmount,
  });
}

function getPaymentLinkValidationSchema(latestAllowedPaymentDate: Date) {
  return Yup.object({
    enableEmail: Yup.boolean(),
    enablePhone: Yup.boolean(),
    emailAddress: Yup.string().when('enableEmail', {
      is: (enableEmailValidation: boolean) => enableEmailValidation,
      then: EmailSchema,
      otherwise: Yup.string(),
    }),
    phoneNumber: Yup.object().when('enablePhone', {
      is: (enablePhoneValidation: boolean) => enablePhoneValidation,
      then: PhoneInputValidationSchema,
      otherwise: Yup.object(),
    }),
    // TODO 2021.02.12 (Frank W.): Change to .array().min(1, 'Velg minst én betalingsform') when multiple methods are supported
    paymentTypeGroups: Yup.string(),
    paymentNote: Yup.string(),
    date: Yup.date()
      .required('Du må fylle ut en dato')
      // You have to add nullable, otherwise Yup converts this to an _invalid_ Date, which passes validation: https://github.com/jquense/yup/issues/601
      .nullable(),
    time: Yup.date()
      .required('Du må fylle ut tidspunkt')
      // You have to add nullable, otherwise Yup converts this to an _invalid_ Date, which passes validation: https://github.com/jquense/yup/issues/601
      .nullable(),
  })
    .test('noPastDate', 'Fristen kan ikke ligge i fortiden', ({ date, time }) => {
      // Because Yup runs validations in parallel, not in sequence, we can't assume that these have been validated as dates yet
      if (isDate(date) && isDate(time)) {
        return concatenateDateAndTimeFields(date, time) > new Date();
      }
      return true;
    })
    .test('moreThan24hoursBeforeDeparture', 'Det må være minst 24 timer mellom fristen og første avreise', ({ date, time }) => {
      // Because Yup runs validations in parallel, not in sequence, we can't assume that these have been validated as dates yet
      if (isDate(date) && isDate(time)) {
        return concatenateDateAndTimeFields(date, time) <= latestAllowedPaymentDate;
      }
      return true;
    })
    .test(
      'atleastOneConfirmationField',
      `Oppgi ${EMAIL_ADDRESS_NOUN.entallUbestemt} og/eller tlf. Minst en må oppgis.`,
      ({ enableEmail: enableEmailValidation, enablePhone: enablePhoneValidation }) => !!enableEmailValidation || !!enablePhoneValidation
    );
}
