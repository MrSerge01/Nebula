# Subete commit system

> Commit messages are hard to think of in a clever and consistent way, which is why standard rulesets to aid with the thought process are used. Usually, [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) is used, as it is widely considered a perfect standard, but we at Subete developed our own standard aimed at improving this system.

A Subecommit (short for "Subete Commit System compliant commit", or equivalent to "Conventional Commit"/"Conventional Commits compliant commit") looks as follows:

```bash
![<type>@[scope] [part]] <description> [>

extended description]

[tags]
```

Where:

- `!`: signifies a breaking change. This must be explained in the commit's long description.
- `type`: the type of the commit, there is a standard list of nouns to choose from (which projects may choose to extend).
- `@scope` (optional): the area of the codebase the commit targets: a class or method name, file name, or software feature. You can concatenate scopes with a plus sign (`+`).
- `ptN`: a part signaler. If a commit is made without all of the work relative to its goal is unfinished, rather than using nonstandard conventions like WIP, 1/n and so on, we standardized on using `pt1`, `pt2` and so on.
  - If steps can be split into sub-steps, parts should be split into subparts (as in `pt1.1`, `pt1.2` and so on).
  - When a commit is known to be the final part of a series, it should signal that with a dot (as in `pt3.`).
  - If after a series finale additional work is needed (because, for example, a mistake was found now), the series shall continue using an exclamation (as in `pt3.1!` or `pt4!`). A lesser serious but still normative variant is to use the "`dlc`" word as a second part signaler, starting again from 1 (as in `pt3 dlc1`).
  - `pt` and part are equally compliant, but `pt` is preferred (due to less typing).
- `description` (and `>`): a one-line summary of the changes. It can't exceed 50 chars, use an extended description for that. Add a greater than (`>`) symbol to indicate there's an extended description (note this reduces effective max commit length to 48).
- `extended description`: the aforementioned. If a single commit does several changes, it should list out every individual change in the same format (but without the 50 char limit). It may also contain regular descriptive text. If mixing both, the description goes before the individually listed "commits".
- `tags`: key-value pairs providing parseable information, if needed. These can indicate issues this commit resolves, the coauthors, the breaking changes, etc. The keys are standardized and should be enclosed by brackets too.

You must use this with everything, even with Git features. When doing a merge commit, update its message to be like so:

```bash
[merge] #91 by @user
```

Supported commit types are:

- `fix`: fixes an issue of any kind with the software
- `feat`: adds a new feature or capability to the software
- `perf`: improves performance of the software with no other change attached
- `doc`: alters documentation of the software in any way
- `refactor`: improves, refactor or rewrites source code of the software without changing behavior
- `ci`: modifies CI/CD pipelines or anything directly related to them
- `chore`: takes care of miscellaneous chores for the repository
- `legal`: updates to ToS/Privacy Policy; usually not on this repo (as these are in SokoraDesu/Legal), though changes made to the bot or the text it shows that are caused by a change to these _do_ have to use this tag
- Additionally, Git features that imply a commit on their own are valid as commit tags (e.g. `rebase`, `merge`, etc...).

Supported tags are:

- `[!]`: to explain breaking changes. Required for every breaking change you make in a commit.
- `[Co-authors]`: to credit coauthors. List them and follow the `Name <@username>` format. Name should be the display name they wield on their GitHub profile, and username should be their GitHub username.
- `[Closes]`: to mention issues this resolves. List them providing the #number identifier of the issue.
- `[Clankers]`: to mention any AI model that has touched the commit, if any. List them using a `provider/model-name-and-version` format (an OpenRouter string works).

## Examples

> Minimal commit

```bash
[chore] Update enhanced-ms to 4.3.0
```

> Scoped commit, part of a commit chain

```bash
[fix@settingsEmbed pt3] fixed OBJECT type
```

> Long commit

```bash
[refactor] migrate to ES syntax >

changes all existing code to use ECMAScript syntax (import, async/await, etc.) rather than CommonJS (require, callback, etc.), making this more standard-compliant
```

> Breaking change!

```bash
![fix@settings pt2.] setting handler fixed

Note that setting useFoobar was renamed to enableFoobar to match all other keys.
Breaks previous configurations.
```

> Continued-after-finale commit series

```bash
[fix@settingsEmbed pt5!] fix (again) typedef for OBJECT
```

> Someone clearly losing their mind

```bash
[fix pt58!!!!!!!!!!!!!!!!!!!!] resolve (again) race condition when pushing updates
```

> [!TIP]
> There is no limit to how many times you can reopen a "finished" series. So what you're seeing above is normative commit-wise, but it signals something not as normative is happening with the development process.

## Incorrect examples

Examples of non-normative commits. These break the rules!

> Standard tag misuse

```bash
[feat] add a single function to process all requests
```

`feat` is for use with new features within the software that is being developed, not within its codebase. this commit should be using refactor.

> Breaking the chain

```bash
[feat pt1] add Windows ARM support

Initial commit adding the build targets and stuff. Code patches for it to work will follow.

[feat pt3] add Windows ARM support

Updated build scripts so it actually compiles.
```

Cannot skip a number!

> Using more exclamations than appropriate

```bash
[refactor pt3.] use XDG Portals for all features possible

[refactor pt4!!!] use XDG Portals for all features possible

broke something, oops!
```

Exclamations are to be used linearly. You cannot just use more than what it corresponds.

## Frequently Asked Questions

> Is there a way to avoid using parts for related commits?
> Short answer: No.
> Long answer: Group your changes. Parts are used for several commits that target the same goal, e.g. adding a specific feature (where pt1 could be a needed refactor and pt2 the actual implementation). Grouping everything makes this go away, though it is considered a bad practice (the more atomic a commit is, within fair limits, the better).

> What if I really can't fit the short description in 48 chars?
> Short answer: Your commit probably does too much.
> Long answer: Check the writing is duplicating nothing. A common mistake is [fix] fixed … where the verb does the tag's job. Another mistake is, when a commit does many things, trying to find shorter terms to describe the contents of the commit; if it doesn't fit, just leave that for the extended description and limit the short description to what the commit touches. E.g., [fix] cart page + password validation <, and then the extended description tells what the actual fixes are.

<!-- we'll do this later on
## Formal Specification

> [!NOTE]
> We made a formal spec as we want this to be our own publicly known commit system for everything we do. You may use (and reference!) this in your project, just as you'd do with other standards like CC.
>
> (This note is not part of the specification)

This specification is defined as the Subete Commit System, version 0.1.0, released on the 14th of August 2026.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in IETF RFC 2119.

1. Commits MUST be prefixed with a tag consisting of a REQUIRED type, an OPTIONAL scope (prefixed by an AT symbol, `@`), and an OPTIONAL part; all of this surrounded by square brackets.
2. A *type* set is a collection of nouns indicating the nature of a commit. Users of the standard MAY extend the standard set but MUST NOT omit or overwrite its definitions.
  - `fix`: fixes an issue of any kind with the software
  - `feat`: adds a new feature or capability to the software
  - `perf`: improves performance of the software with no other change attached
  - `doc`: alters documentation of the software in any way
  - `refactor`: improves, refactor or rewrites source code of the software without changing behavior
  - `ci`: modifies CI/CD pipelines or anything directly related to them
  - `chore`: takes care of miscellaneous chores for the repository
  - Additionally, Git features that imply a commit on their own are valid as commit tags (e.g. `rebase`, `merge`, etc...).
3. A *scope* identifies the area of the project a commit targets. Commits targeting a specific area MUST provide a scope; commits making global changes MUST NOT use a "global scope" placeholder (e.g. `@global`, `@all` or anything similar). The scope MUST be a single word and SHOULD match the capitalization of the source identifier it refers to, or be all lowercase for descriptive feature names.
4. A part is a numeric identifier for one commit in a series of multiple commits that target the same specific short-term goal. It SHOULD be used when more than one commit are used to achieve the same fix, feature or change that the first commit promotes.
  - Parts MUST be written as `ptN` with no space between `pt` and the number.
  - Parts MUST start at 1, or 2 if the first commit had no part specifier.
  - Parts MAY be ommitted on Git-required commits, such as a rebase or a merge.
  - The final commit in a series MUST end with a dot (as in `ptN.`).
  - If after a final commit in a series the developer realizes additional commits are needed, the author MUST either continue linearly with an exclamation (as in `pt3!` to follow `pt2.`, RECOMMENDED) or open a separate dlc block (as in `pt2 dlc1` to follow `pt 2.`).
    - The exclamation must be preserved on all commits after the series finale (as in `pt3!` then `pt4!`).
    - The final commit to a reopened series MUST also end with a dot at the end (as in `pt5!.` or `pt2 dlc3.`).
    - Recursive reopening (i.e. reopening a series more than once) is allowed, by either adding an additional exclamation (as in `pt5!!`) or a newer dlc block (as in pt2 dlc2 dlc1). It is normative but NOT RECOMMENDED to keep deliberately reopening closed series.
5. After the tag, a one-line description MUST follow. If additional details are needed, they MUST be placed after two newline characters (`\n\n`).
-->
