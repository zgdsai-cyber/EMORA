/**
 * Slice 1 scientific disclosure. One shared constant so the API response and the
 * UI render identical wording. The output is a computational, model-estimated
 * state: it is explicitly NOT a measurement, NOT a detection, NOT a diagnosis,
 * NOT a clinical assessment, and NOT evidence of psychological validity.
 */
export const SCIENTIFIC_DISCLOSURE_CODE =
  'COMPUTATIONAL_MODEL_ESTIMATED_STATE_NOT_HUMAN_MEASUREMENT' as const;

export const SCIENTIFIC_DISCLOSURE_TEXT =
  "EMORA output is a computational, model-estimated emotional state derived from the event and context you supplied, using EMORA's deterministic model. It is not a measurement of a person's true emotional state. It is not a detection of a person's true emotional state. It is not a diagnosis. It is not a clinical assessment. It does not establish psychological validity, and it must not be used as evidence of what a person actually feels." as const;

/** Honest parameter provenance: the runtime uses the default deterministic parameters. */
export const PARAMETER_IDENTITY =
  'DEFAULT_DETERMINISTIC_MODEL_PARAMETERS' as const;

/** Marks a computational zero-vector initialization (not a psychological baseline). */
export const INITIALIZATION_MARKER =
  'ZERO_VECTOR_PROFILE_INITIALIZATION' as const;
