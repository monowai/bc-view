/**
 * The two sentences both first-stage doors say about phasing.
 *
 * They live here rather than in either surface because the wizard
 * (`WizardContainer`) and the guided setup page (`SetupWizard`) have to agree:
 * a user who meets the same refusal on two screens should read the same
 * sentence. Neither string carries its own "what next" link — where to go is
 * different on each surface, so each adds that in JSX.
 */

/**
 * svc-retire refuses to phase a stage whose owner has given neither a year of
 * birth nor a target independence age (`PhasedIndependenceService`) — there is
 * no age axis to cut the phases on. A create that ignores that saves a stage
 * and no journey, which is the one outcome these wizards exist to avoid.
 */
export const PHASING_PREREQUISITE_MESSAGE =
  "Set your date of birth or target independence age before creating a stage — without one the stage cannot be phased."

/**
 * Names what survived, then why the rest did not. The stage is already
 * persisted when phasing is refused, so "failed" on its own would read as
 * "start again" and invite a second stage.
 *
 * @param reason the backend's own words, unedited
 */
export const phaseFailureMessage = (reason: string): string =>
  `Your stage is saved, but it could not be phased: ${reason}.`
