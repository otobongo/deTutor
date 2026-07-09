// Echo teaching state machine (GT-201, PRD 3.4 rule 1): the tutor presents
// twice, the learner produces, then a faster second pass. Pure and strict:
// the UI physically cannot advance past production without learner output.

export type EchoStage = 'present-1' | 'present-2' | 'produce' | 'fast-pass' | 'done';

export interface EchoState {
  readonly stage: EchoStage;
  readonly production: string | null;
}

export type EchoEvent =
  | { readonly type: 'presented' }
  | { readonly type: 'produced'; readonly text: string }
  | { readonly type: 'fast-pass-done' };

export function startEcho(): EchoState {
  return { stage: 'present-1', production: null };
}

export function advanceEcho(state: EchoState, event: EchoEvent): EchoState {
  switch (state.stage) {
    case 'present-1':
      if (event.type === 'presented') return { ...state, stage: 'present-2' };
      break;
    case 'present-2':
      if (event.type === 'presented') return { ...state, stage: 'produce' };
      break;
    case 'produce':
      if (event.type === 'produced' && event.text.trim().length > 0) {
        return { stage: 'fast-pass', production: event.text.trim() };
      }
      if (event.type === 'produced') {
        throw new Error('Production must not be empty; the learner produces before advancing.');
      }
      break;
    case 'fast-pass':
      if (event.type === 'fast-pass-done') return { ...state, stage: 'done' };
      break;
    case 'done':
      break;
  }
  throw new Error(`Invalid echo transition: ${event.type} during ${state.stage}.`);
}
