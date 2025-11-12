import { NarrativeCard } from "./types";

export const INITIAL_CARDS: NarrativeCard[] = [
  {
    id: "first-contact",
    title: "Distress Beacon",
    body: "A faint SOS signal is triangulated from the outskirts. The team debates whether to investigate immediately or fortify first.",
    illustration: "radio-beacon",
    tags: ["narrative", "danger"],
    choices: [
      {
        id: "investigate",
        label: "Send a scout team",
        consequence: {
          description: "Scouts depart under the cover of darkness, broadcasting intermittent updates.",
          hostilityDelta: 0.4,
          followUp: () => [
            {
              id: "scout-report",
              title: "Scout Report",
              body: "The team encountered resistance but rescued survivors who can bolster defenses.",
              choices: [
                {
                  id: "welcome",
                  label: "Integrate the survivors",
                  consequence: {
                    description: "New arrivals share intel about horde movements.",
                    resourceDelta: { allies: 3, intel: 2 },
                    hostilityDelta: -0.2,
                  },
                },
                {
                  id: "detain",
                  label: "Screen them thoroughly",
                  consequence: {
                    description: "Extended screening delays the return and agitates the horde.",
                    hostilityDelta: 0.3,
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: "fortify",
        label: "Hold position and fortify",
        consequence: {
          description: "Construction crews reinforce barricades instead. The signal grows faint before cutting out.",
          resourceDelta: { stability: 2 },
          hostilityDelta: -0.1,
        },
      },
    ],
  },
];
