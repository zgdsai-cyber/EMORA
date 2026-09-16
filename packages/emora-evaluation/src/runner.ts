import type { L1EvaluationReport, L1EvaluationOptions, GateResult } from './contracts';
import { canonicalize, hashCanonical } from './canonicalize';
import {
  evaluateBounds,
  evaluateConfidenceIntegrity,
  evaluateDeterminism,
  evaluateStructuralInvariants,
} from './gates';

export function runL1Evaluation(options: L1EvaluationOptions): L1EvaluationReport {
  const { engine, evaluationCase } = options;
  const identity = {
    ...evaluationCase.identity,
    providerIdentifier: engine.provider.identifier,
    providerVersion: engine.provider.modelVersion?.version ?? evaluationCase.identity.providerVersion,
    runtimeContract: engine.runtimeContract,
  };
  const normalizedCase = { ...evaluationCase, identity };
  const results: GateResult[] = [];
  let firstOutput: unknown;
  let secondOutput: unknown;
  try {
    firstOutput = engine.provider.transition(evaluationCase.input);
    secondOutput = engine.provider.transition(evaluationCase.input);
    results.push(evaluateBounds(normalizedCase, firstOutput));
    results.push(evaluateStructuralInvariants(normalizedCase, firstOutput));
    results.push(evaluateDeterminism(normalizedCase, firstOutput, secondOutput));
    results.push(evaluateConfidenceIntegrity(normalizedCase, firstOutput));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Provider execution failed.';
    const failed = (gateId: GateResult['gateId'], property: string): GateResult => ({
      gateId,
      status: 'FAIL',
      caseId: identity.caseId,
      property,
      observedValue: reason,
      expected: 'The production provider accepts the validated case and returns a valid result.',
      tolerance: 'No tolerance for provider execution errors.',
      inputReference: identity.caseId,
      parameterVersionId: identity.parameterVersionId,
      parameterSetHash: identity.parameterSetHash,
      providerIdentifier: identity.providerIdentifier,
      providerVersion: identity.providerVersion,
      runtimeContract: identity.runtimeContract,
      failureReason: reason,
    });
    results.push(failed('G1', 'Provider output is finite and within declared bounds.'));
    results.push(failed('G2', 'Provider output preserves the declared structure.'));
    results.push(failed('G3', 'Repeated provider execution is deterministic.'));
    results.push(failed('G7', 'Confidence is not fabricated from an invalid input.'));
  }
  let outputCanonical = '';
  if (firstOutput !== undefined) {
    try {
      outputCanonical = canonicalize(firstOutput);
    } catch (error) {
      outputCanonical = `canonicalization-failed:${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }
  const status = results.some((item) => item.status === 'FAIL')
    ? 'FAIL'
    : results.some((item) => item.status === 'INCONCLUSIVE')
      ? 'INCONCLUSIVE'
      : 'PASS';
  return Object.freeze({
    status,
    identity,
    outputCanonical,
    reportHash: hashCanonical({ identity, outputCanonical, results }),
    results: Object.freeze(results),
    evidenceLevel: 'L1_STRUCTURAL',
  });
}
