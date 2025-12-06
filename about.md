---
title: About
---
# ozibuild

> **WARNING**: [[Work in Progress]] ozibuild has no releases yet.

> Build anything with organized scripts.

**ozibuild** is a set of simplified functions on top of `nodejs`,
which enables using JavaScript as a scripting language for generic builds.

Similar to `make`, one of the core functions of **ozibuild** is to execute
shell commands using input files to produce output(s), and only repeat the
execution when input files change.\
Aligned with modern javascript, output is a `Promise`, which allows representing
natively complex dependency graphs.

Additional support provided out-of-the-box by **ozibuild** includes:

*  Components for referencing source directories and files.
*  Built-in support for watching file changes and re-running builds.
*  Configuration management: build rules have access to json fields,
   default config is automatically generated.
*  Auto-complete for shell commands.
