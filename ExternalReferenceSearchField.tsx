import { css } from '@emotion/react';
import { SecondarySquareButton } from '@entur/button';
import { SearchIcon } from '@entur/icons';
import { fontSizes } from '@entur/tokens';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { StringParam, useQueryParams } from 'use-query-params';
import * as yup from 'yup';

import { TypeOfExternalReference } from '../../../app/clientStorage/localStorageHelpers';
import { L, M, S, XS2 } from '../../../components/DesignSystemWrappers/spacings';
import { HookFormRadioGroupWrapper } from '../../../components/FormWrappers/RadioButton/HookFormRadioGroupWrapper';
import { ControlledHookFormTextField } from '../../../components/FormWrappers/TextField/HookFormTextField';
import { REQUIRED_FIELD_FEEDBACK_TEXT } from '../../../components/FormWrappers/validationSchemas';
import { ORDER_ID_NOUN } from '../../../constants/commonConstants';
import {
  DEFAULT_ORDER_SEARCH_QUERY_PARAMS_FOR_PAGING_AND_SORTING,
  ORDER_SEARCH_QUERY_PARAMS_CONFIGURATION_FOR_PAGING_AND_SORTING,
} from '../../../constants/orderConstants';
import { ORDERS_SEARCH_PATH } from '../../../constants/reactRouterConstants';
import { usePreferencesForOrderSearch } from '../../../hooks/useSignedInUserPreferences';
import {
  MT_EXTERNAL_REFERENCE_REGEXP,
  SILVERRAIL_ORDER_ID_REGEXP,
  VY_EXTERNAL_REFERENCE_REGEXP,
} from '../../../utils/validators';
import { DISABLE_LABEL_ANIMATION_TO_MATCH_OTHER_COMPONENTS_EVEN_THOUGH_IT_IS_NOT_NECESSARY_FOR_THIS_COMPONENT } from './constants';

const externalReferenceSchema = yup.object({
  externalReferenceInput: yup
    .string()
    .trim()
    .required(REQUIRED_FIELD_FEEDBACK_TEXT)
    .when('typeOfExternalReference', ([typeOfExternalReference], stringSchema) => {
      switch (typeOfExternalReference) {
        case TypeOfExternalReference.VY_ORDER: {
          return stringSchema.matches(
            VY_EXTERNAL_REFERENCE_REGEXP,
            `VY ${ORDER_ID_NOUN.entallUbestemt} består av 3 ganger 3 tegn, tall eller bokstaver, delt med bindestrek, f.eks AB1-CD2-EF3`
          );
        }
        case TypeOfExternalReference.MT_ORDER: {
          return stringSchema.matches(
            MT_EXTERNAL_REFERENCE_REGEXP,
            `MT ${ORDER_ID_NOUN.entallUbestemt} består av 6 tegn, tall eller bokstaver, f.eks ab1234`
          );
        }
        case TypeOfExternalReference.SILVERRAIL_ORDER: {
          return stringSchema.matches(
            SILVERRAIL_ORDER_ID_REGEXP,
            `Ekstern ${ORDER_ID_NOUN.entallUbestemt} for internasjonale ordre består av 3 bokstaver, 4 tall og 1 bokstav, f.eks ABC1234D`
          );
        }
        default: {
          return stringSchema;
        }
      }
    }),
  typeOfExternalReference: yup.string().ensure().oneOf(Object.values(TypeOfExternalReference)),
});

type ExternalReferenceFormValues = {
  externalReferenceInput: string;
  typeOfExternalReference: TypeOfExternalReference;
};

const EXTERNAL_REFERENCE_RADIO_BUTTON_OPTIONS = [
  {
    text: 'Vy',
    value: TypeOfExternalReference.VY_ORDER,
  },
  {
    text: 'Internasjonal',
    value: TypeOfExternalReference.SILVERRAIL_ORDER,
  },
  {
    text: 'MT',
    value: TypeOfExternalReference.MT_ORDER,
  },
  {
    text: 'Annet',
    value: TypeOfExternalReference.OTHER,
  },
];

export function ExternalReferenceSearchField() {
  const history = useHistory();
  const [orderSearchPreferences, savePreferencesForOrderSearch] = usePreferencesForOrderSearch();
  const [externalReferenceQueryParams, setExternalReferenceQueryParams] = useQueryParams({
    ...ORDER_SEARCH_QUERY_PARAMS_CONFIGURATION_FOR_PAGING_AND_SORTING,
    externalReference: StringParam,
    mtExternalReference: StringParam,
  });

  const externalReferenceFromQueryParameters =
    externalReferenceQueryParams.externalReference ?? externalReferenceQueryParams.mtExternalReference ?? '';
  const formMethods = useForm<ExternalReferenceFormValues>({
    resolver: yupResolver(externalReferenceSchema),
    defaultValues: {
      externalReferenceInput: externalReferenceFromQueryParameters,
      typeOfExternalReference: orderSearchPreferences.typeOfExternalReference,
    },
  });
  const { getValues, handleSubmit, reset, setValue, watch } = formMethods;

  const typeOfExternalReference = watch('typeOfExternalReference');

  useEffect(() => {
    if (typeOfExternalReference !== orderSearchPreferences.typeOfExternalReference) {
      savePreferencesForOrderSearch({ typeOfExternalReference });
    }
  }, [orderSearchPreferences, savePreferencesForOrderSearch, typeOfExternalReference]);

  useEffect(() => {
    const formExternalReference = getValues('externalReferenceInput');
    if (formExternalReference !== externalReferenceFromQueryParameters) {
      reset({ typeOfExternalReference });
      setValue('externalReferenceInput', externalReferenceFromQueryParameters);
    }
  }, [getValues, reset, setValue, externalReferenceFromQueryParameters, typeOfExternalReference]);

  return (
    <FormProvider {...formMethods}>
      <form
        css={{ display: 'flex', flexDirection: 'column', gap: XS2 }}
        onSubmit={handleSubmit(async ({ externalReferenceInput }) => {
          const searchParametersWithExternalReferenceOnly =
            typeOfExternalReference === TypeOfExternalReference.MT_ORDER
              ? { mtExternalReference: externalReferenceInput }
              : { externalReference: externalReferenceInput };
          const searchParameters = {
            ...searchParametersWithExternalReferenceOnly,
            ...DEFAULT_ORDER_SEARCH_QUERY_PARAMS_FOR_PAGING_AND_SORTING,
          };
          history.push({
            pathname: ORDERS_SEARCH_PATH,
            state: { skipLoadFromCache: true },
          });
          setExternalReferenceQueryParams(searchParameters);
        })}
      >
        <div css={{ display: 'flex', gap: XS2 }}>
          <ControlledHookFormTextField
            data-cy="external-reference-search-field"
            disableLabelAnimation={
              DISABLE_LABEL_ANIMATION_TO_MATCH_OTHER_COMPONENTS_EVEN_THOUGH_IT_IS_NOT_NECESSARY_FOR_THIS_COMPONENT
            }
            label="Eksternreferanse"
            name="externalReferenceInput"
            normalize={(inputString) => {
              if (typeOfExternalReference === TypeOfExternalReference.MT_ORDER) {
                return inputString.toLowerCase();
              }
              if (typeOfExternalReference === TypeOfExternalReference.OTHER) {
                return inputString;
              }
              return inputString.toUpperCase();
            }}
          />
          <SecondarySquareButton css={{ alignSelf: 'flex-start' }} data-cy="order-search-button">
            <SearchIcon />
          </SecondarySquareButton>
        </div>
        <div
          css={css`
            & fieldset {
              display: grid;
              column-gap: ${S};
              grid-template-columns: max-content max-content;

              // NOTE 2023.02.06 (Frank W.): These styles are used to override EDS-styling according to comment on PR https://bitbucket.org/enturas/ess-client/pull-requests/1960#comment-360407922
              & label {
                height: ${L};
              }
              & span {
                font-size: ${fontSizes.medium}px;
              }
              & .eds-form-component--radio__radio {
                height: ${M};
                width: ${M};
                margin-right: ${S};
              }
            }
          `}
        >
          <HookFormRadioGroupWrapper
            label="Type eksternreferanse"
            name="typeOfExternalReference"
            options={EXTERNAL_REFERENCE_RADIO_BUTTON_OPTIONS}
          />
        </div>
      </form>
    </FormProvider>
  );
}
