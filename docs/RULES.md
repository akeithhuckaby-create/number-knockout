# The winding trail

This is the approved replacement for the earlier rectangular board. It changes movement as well as appearance: visible connections are the legal routes. The old grid's diagonal movement and fixed horizontal barriers no longer apply.

## One or two players

Choose **1 player** to control Gold against the Blue computer knight, or **2 players** to pass one device between friends. The first quest starts with Gold. Squire focuses on racing and clearing walls; Knight also builds walls that delay its opponent. Both use the same dice and math rules, the same one-action turns, and the same shared-stone equation restriction and one-method exception. Neither looks ahead at future rolls.

The computer searches in a worker, displays its rolled dice and verified equation, and then takes its turn. Its search uses the Oracle presets, so it can miss a solution involving other custom powers. It may pass when it finds no useful action; this is not a claim that the roll has no mathematical answer.

Opening a menu, practice or tutorial, or hiding the tab pauses the computer. Returning resumes it. A failed search offers a retry without spending the turn. Existing two-player saves stay two-player; new solo saves retain the selected opponent. Rematches retain the mode and difficulty and alternate who starts.

## Adventure rules

| Action or condition | Rule                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board               | 34 different numbers selected from 1–36. The dragon has its own target, from 15–30. A stone may share the dragon's target number.                                                                    |
| Start               | Both knights wait at the gates. Either may enter an open one of the two connected stones.                                                                                                            |
| Move                | Make a stone's number and move one visible connection. You may move backward or choose a fork. You cannot jump a gap, return to the gates or enter an opposing wall. Both knights may share a stone. |
| Build               | Make the number of an empty stone connected to the opposing knight. You may have at most three walls active. No building on a knight, existing wall, or dragon.                                      |
| Own walls           | You can enter your own wall's stone.                                                                                                                                                                 |
| Break               | Make twice an opposing wall's number, from anywhere. The action removes the wall without moving you, and restores the owner's wall supply.                                                           |
| Dragon              | Reach one of the two stones connected directly to the lair. Choose Slay dragon and make its number to win.                                                                                           |
| Turn                | One successful action or a pass. An invalid expression does not spend your turn.                                                                                                                     |
| Draw                | Both players have passed on their last three personal turns. A successful action resets that player's pass counter.                                                                                  |
| Rematch             | Keep the same numbered board or generate a new one. The first player alternates. Dice are freshly rolled.                                                                                            |

The first game starts with Gold. All three rolled dice must be used exactly once in an expression; free powers do not consume a die. Rolls with two or more ones are rerolled. The result must match exactly. See [Math](MATH.md) for grammar and computation limits.

## Reading the map

Stones are individually placed on a landscape. A road connects every legal neighboring pair. Outlines mark legal targets; they do not promise a solution for the current dice. Shorter routes and alternate loops offer tactical choices. The dragon has a separate labeled lair.

Both knights can occupy the same numbered stone, shown side by side. Each moves independently on their own turn. Opposing walls still prevent entry, and no wall may be built on a stone occupied by either knight. Sharing a lair approach does not share victory: the first successful attack wins.

When one knight leaves a shared numbered stone, the knight who remains must use a different calculation to follow to the same destination. For example, after `1 + 2 + 3 = 6`, `1 × 2 × 3 = 6` is allowed, but `3 + 2 + 1 = 6` is a repeat. Swapping identical dice, redundant parentheses, equivalent addition/subtraction or multiplication/division regrouping, and changing a power on the number 1 do not create a new method. Different operations, powers that change a die’s value, or meaningful grouping can.

The reminder persists through passes and wall actions until the remaining knight leaves the original stone. Other destinations are unrestricted. The gates do not count as a shared stone. A rejected repeat does not spend a turn.

**One-method exception:** a repeated valid equation triggers an automatic Oracle search for a different method using the current roll and target. If the completed search finds none, the repeat is allowed and recorded in the Battle Chronicle. This works with hints disabled and does not reveal an alternative unless the player asks for a clue. Reordering the same equation is excluded from the search. The search uses the preset powers described in [Math](MATH.md); it does not prove uniqueness across all custom powers. Errors and timeouts do not allow a repeat. Refresh repeats the check rather than trusting a saved allowance.

The route layout stays the same between games. A new quest reshuffles the stone numbers and rolls a dragon target; a same-board rematch preserves those numbers too. The long diagonal shortcut toward the lair has been removed, so every journey follows the full bend around the right side. Smaller forks remain.

On a phone, use Enlarge map to scroll through larger stones, or choose the same legal target from the target list. Selecting a stone carries its number into the turn panel.

Automated checks verify that all stones reach the lair, all road connections are represented in the rules, and roads do not cross or run through unrelated stones. The two gate connections are entry-only.

## Existing saves

The connected trail uses save version 3. An unstarted older quest with both knights at the gates can migrate. An advanced grid quest is kept untouched because those positions have different movement rules. The player may download the old save, play temporarily without changing it, or explicitly start a replacement. A downloaded recovery file preserves the old data; this version does not include a general save-import interface.

## Playtest questions

The trail is mechanically tested, but family playtesting should measure match duration, first-player advantage, use of longer routes, repeated passes, and wall placement at bottlenecks. The Oracle searches a bounded set of expressions, so this release does not guarantee a legal action on every roll.
