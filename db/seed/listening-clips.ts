// Unit listening clips (GT-220 Day view). Placeholder mode speaks these via
// SpeechSynthesis and always captions them; Phase 5 generates real audio
// under the same clipIds (no data migration).

export const UNIT_LISTENING_CLIPS: Readonly<Record<string, string>> = {
  'a1-1': 'Hallo! Guten Morgen. Ich heiße Anna. Und du?',
  'a1-2': 'Das ist Jonas. Er kommt aus Hamburg und wohnt jetzt in Berlin.',
  'a1-3': 'Es ist zehn Uhr. Wir treffen uns am Samstag um drei.',
  'a1-4': 'Die Wohnung hat zwei Zimmer. Der Tisch steht in der Küche.',
  'a1-5': 'Ich möchte einen Kaffee und ein Brötchen, bitte.',
  'a1-6': 'Wo finde ich die Milch? Ich brauche auch Brot und Butter.',
  'a2-1': 'Ich stehe um sieben auf. Dann rufe ich meine Mutter an.',
  'a2-2': 'Guten Tag, ich möchte einen Termin machen. Geht es am Montag?',
  'a2-3': 'Fahren Sie mit der U-Bahn und steigen Sie am Hauptbahnhof um.',
  'a2-4': 'Am Wochenende bin ich nach Potsdam gefahren und habe viel gesehen.',
  'a2-5': 'Diese Wohnung ist größer, aber die andere ist billiger.',
  'a2-6': 'Sehr geehrte Frau Müller, die Heizung in meiner Wohnung ist kaputt.',
  'b1-1': 'Ich finde, dass soziale Medien praktisch sind, obwohl sie viel Zeit kosten.',
  'b1-2': 'Wegen des neuen Projekts hat unsere Kollegin die Abteilung gewechselt.',
  'b1-3': 'Ich habe eine schwarze Tasche mit einem roten Griff verloren.',
  'b1-4': 'Wäre es möglich, die Wohnung schon nächste Woche zu besichtigen?',
  'b1-5': 'In Berlin wird viel gebaut. Die Mieten werden trotzdem nicht billiger.',
  'b1-6': 'Einerseits spart man im Homeoffice Zeit, andererseits fehlt der Kontakt.',
};

export function listeningClipId(unitId: string): string {
  return `listen-${unitId}`;
}
