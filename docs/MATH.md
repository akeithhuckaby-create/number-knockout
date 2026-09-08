# Exact arithmetic in Knight’s Path

The game uses each of three rolled dice once as an operand. Exponents are free and attached to individual dice; they never consume another rolled operand. Duplicate-valued dice keep separate identities. Rolls with at least two ones are rerolled.

The arithmetic reference is Classical Conversations’ [National Number Knockout](https://classicalconversations.com/national-number-knockout/) [Parent How to Play Guide, page 4](https://classicalconversations.widen.net/s/tkpxkmtcmz/n2k_howtoplay_layout-final#page=4). Knight’s Path has its own movement, wall, and victory rules. It is not the official timed competition.

## Representation

`src/math.js` parses tokens using ordinary operator precedence and grouping. It never evaluates an expression as executable JavaScript.

Each powered die is represented exactly as a rational coefficient times rational powers of 2, 3, and 5, the prime factors of dice values 1–6. Integer factors are extracted from exponents. Arithmetic combines these canonical monomials into sparse polynomials, and divisions retain numerator/denominator polynomial pairs. Coefficients use normalized BigInt fractions.

An integer is accepted only when the numerator is an exact integer multiple of the denominator. Floating-point approximations are display information only. The Oracle uses floating point to locate possible answers, then passes every candidate through the exact evaluator before it can be offered as a solution.

## Application limits

- Three rolled operands, each used once.
- No digit concatenation or powers of grouped expressions.
- Up to 64 expression tokens and 64 polynomial terms.
- Custom powers are signed integers or rational fractions with absolute numerator at most 128 and denominator at most 64 after reduction.
- Zero and negative powers, square/cube roots, and other fractional powers are supported within those limits.
- Resource-limit failures explain that verification could not be completed.

These are implementation choices, not claimed official competition ceilings.

## Oracle

A worker searches permutations of all three dice, the four binary operations, both parenthesizations, and the powers 1, 0, 2, 3, 1/2, −1, 4, 1/3, 3/2, 5, and 6. It prefers simpler expressions and keeps one verified answer per target. Equivalent dice multisets share a cache, with die identities correctly remapped.

The in-game range is 1–72, covering ordinary board targets, dragon targets, and twice a wall’s number. Practice supports up to 200 targets between 1 and 999 per search. Search is bounded and does not prove impossibility. The UI says “No solution found in this search.”

## Regression examples

The automated tests cover duplicate dice, missing operands despite matching exponents, exact fractions, radical cancellation, negative powers, precedence, division by zero, no concatenation, resource limits, and near-integers that must not be rounded into legal moves. They also verify every tested Oracle answer through the game evaluator.
