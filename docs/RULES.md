# The winding trail

This is the approved replacement for the earlier rectangular board. It changes movement as well as appearance: visible connections are the legal routes. The old grid's diagonal movement and fixed horizontal barriers no longer apply.

## Adventure rules

| Action or condition | Rule                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board               | 34 different numbers selected from 1–36. The dragon has its own target, from 15–30. A stone may share the dragon's target number.                                                                  |
| Start               | Both knights wait at the gates. Either may enter an open one of the two connected stones.                                                                                                          |
| Move                | Make a stone's number and move one visible connection. You may move backward or choose a fork. You cannot jump a gap, return to the gates, enter your opponent's stone, or enter an opposing wall. |
| Build               | Make the number of an empty stone connected to the opposing knight. You may have at most three walls active. No building on a knight, existing wall, or dragon.                                    |
| Own walls           | You can enter your own wall's stone.                                                                                                                                                               |
| Break               | Make twice an opposing wall's number, from anywhere. The action removes the wall without moving you, and restores the owner's wall supply.                                                         |
| Dragon              | Reach one of the two stones connected directly to the lair. Choose Slay dragon and make its number to win.                                                                                         |
| Turn                | One successful action or a pass. An invalid expression does not spend your turn.                                                                                                                   |
| Draw                | Both players have passed on their last three personal turns. A successful action resets that player's pass counter.                                                                                |
| Rematch             | Keep the same numbered board or generate a new one. The first player alternates. Dice are freshly rolled.                                                                                          |

The first game starts with Gold. All three rolled dice must be used exactly once in an expression; free powers do not consume a die. Rolls with two or more ones are rerolled. The result must match exactly. See [Math](MATH.md) for grammar and computation limits.

## Reading the map

Stones are individually placed on a landscape. A road connects every legal neighboring pair. Outlines mark legal targets; they do not promise a solution for the current dice. Shorter routes and alternate loops offer tactical choices. The dragon has a separate labeled lair.

On a phone, use Enlarge map to scroll through larger stones, or choose the same legal target from the target list. Selecting a stone carries its number into the turn panel.

Automated checks verify that all stones reach the lair, all road connections are represented in the rules, and roads do not cross or run through unrelated stones. The two gate connections are entry-only.

## Existing saves

The connected trail uses save version 3. An unstarted older quest with both knights at the gates can migrate. An advanced grid quest is kept untouched because those positions have different movement rules. The player may download the old save, play temporarily without changing it, or explicitly start a replacement. A downloaded recovery file preserves the old data; this version does not include a general save-import interface.

## Playtest questions

The trail is mechanically tested, but family playtesting should measure match duration, first-player advantage, use of longer routes, repeated passes, and wall placement at bottlenecks. The Oracle searches a bounded set of expressions, so this release does not guarantee a legal action on every roll.
