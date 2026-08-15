export interface V3ReferenceExample {
  name: string;
  input: string;
  output: string;
}

/** Reference examples only; never use them as keyword-to-scene hardcoding. */
export const V3_REFERENCE_EXAMPLES: readonly V3ReferenceExample[] = [];
