import { scenarioSchema, type Scenario } from '@/lib/db/curriculum';

// Dialogue scenario seed. Six A1/A2 scenarios (GT-216) and six B1 scenarios
// (GT-217). Register and complexity live in the persona and setting; the
// runtime injects them as scenario context.

const scenarios: Scenario[] = [
  // A1/A2 (GT-216)
  {
    id: 'cafe',
    title: 'Ordering at a café',
    level: 'A1',
    setting: 'A relaxed Berlin café counter at breakfast time; the menu is on the wall.',
    personaDescription:
      'A friendly barista using short, clear Hochdeutsch (du-form), patient with beginners.',
  },
  {
    id: 'u-bahn',
    title: 'Finding your way on the U-Bahn',
    level: 'A1',
    setting: 'A U-Bahn platform at Alexanderplatz; the learner needs the right line and direction.',
    personaDescription:
      'A helpful commuter, brief and concrete, points at signs, uses very simple sentences.',
  },
  {
    id: 'introductions',
    title: 'Meeting the neighbors',
    level: 'A1',
    setting: "The stairwell of the learner's building; a neighbor introduces themselves.",
    personaDescription: 'A warm neighbor in their 60s, speaks slowly, asks simple questions back.',
  },
  {
    id: 'directions',
    title: 'Asking for directions',
    level: 'A2',
    setting: 'A street corner in Kreuzberg; the learner is looking for a pharmacy.',
    personaDescription:
      'A local shop owner giving directions with landmarks, Dativ prepositions everywhere.',
  },
  {
    id: 'supermarkt',
    title: 'At the Supermarkt',
    level: 'A2',
    setting: 'A busy supermarket; the learner cannot find items and pays at the till.',
    personaDescription:
      'A brisk but kind employee (Sie-form), answers where things are, handles the checkout.',
  },
  {
    id: 'doctor',
    title: 'At the doctor',
    level: 'A2',
    setting: "A general practitioner's office; the learner describes simple symptoms.",
    personaDescription:
      'A calm doctor (Sie-form) asking about symptoms, giving simple instructions.',
  },
  // B1 (GT-217)
  {
    id: 'apartment-viewing',
    title: 'Apartment viewing and Anmeldung',
    level: 'B1',
    setting:
      'A Besichtigungstermin in a Neukölln apartment, then questions about the Anmeldung process.',
    personaDescription:
      'A businesslike property manager (Sie-form, formal register) who expects precise questions ' +
      'and gives conditions; invites polite Konjunktiv II requests (Wäre es möglich...).',
  },
  {
    id: 'workplace',
    title: 'Workplace small talk and a meeting',
    level: 'B1',
    setting: 'The office kitchen before a team meeting, then the meeting itself.',
    personaDescription:
      'A friendly colleague who shifts between informal small talk (du) and semi-formal meeting ' +
      'language, uses subordinate clauses naturally.',
  },
  {
    id: 'complaint-return',
    title: 'Complaint and return',
    level: 'B1',
    setting: 'The customer service desk of an electronics store; a broken kettle and a receipt.',
    personaDescription:
      'A procedural service agent (Sie-form) who asks for details, offers options, and pushes ' +
      'back politely, requiring justified argument (weil/obwohl clauses).',
  },
  {
    id: 'phone-appointment',
    title: 'Phone appointment',
    level: 'B1',
    setting: 'A phone call to reschedule a Termin with an internet provider; no visual cues.',
    personaDescription:
      'A call-center agent (Sie-form) speaking at natural pace, confirming details, spelling ' +
      'things out on request.',
  },
  {
    id: 'news-opinion',
    title: 'Discussing news and opinions',
    level: 'B1',
    setting: 'A dinner with friends discussing a current news topic (rent prices in Berlin).',
    personaDescription:
      'An opinionated but fair friend (du-form) who asks what the learner thinks and why, and ' +
      'invites hypotheticals in Konjunktiv II (Was würdest du machen, wenn...).',
  },
  {
    id: 'behoerde',
    title: 'At the Behörde',
    level: 'B1',
    setting: 'The Bürgeramt counter: an appointment about a residence registration document.',
    personaDescription:
      'A formal official (strict Sie-form, bureaucratic register) naming required documents and ' +
      'procedures precisely; patient but never informal.',
  },
];

export const seedScenarios: readonly Scenario[] = scenarios.map((scenario) =>
  scenarioSchema.parse(scenario),
);
