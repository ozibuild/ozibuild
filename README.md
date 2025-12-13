---
title: Getting Started
group: Overview
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

---

## Getting Started

#### Prerequisites

**ozibuild** relies on nodejs for the scripting and task execution,
so it requires that `nodejs` and `npm` are already installed.

In addition, **ozibuild** assumes the execution in the context of a
npm package (i.e. `package.json`), even for building applications that
do not use javascript, npm or nodejs.

#### Installation

**ozibuild** is provided through multiple npm packages:

```sh
# Install ozibuild as development dependency, for build rules implementation.
npm install --save-dev @ozibuild/core @ozibuild/make
```

```sh
# Install ozibuild binary for triggering the build functions.
# Global installation makes the usage more convenient:
npm install -g @ozibuild/cli
```

#### Hello, World!

**ozibuild** scripts uses source reference and runs commands.  
**ozibuild** scripts are regular javascript, which exports async build functions.

```js
// ./oziroot.mjs
import {sourceDirContext} from '@ozibuild/core/index.js';
import {buildCmd} from '@ozibuild/make/index.js';

const ctx = sourceDirContext(import.meta.dirname);

// Implement a build task by exporting a standard async function.
export async function helloWorld() {
  return buildCmd(ctx, {bin: 'echo', args: ['Hello', ', ', 'World!']});
}
```

Use **ozibuild** binary to "build" the task implemented by the async function.

```sh
# Runs the build task "helloWorld" in oziroot.mjs script from . directory
ozibuild :helloWorld
# Alternative targets specifications:
ozibuild ./oziroot.mjs:helloWorld
ozibuild oziroot.mjs:helloWorld
ozibuild .:helloWorld
```

#### root and outdir

Root of a **ozibuild** source hierarchy is defined as the closest ancestor
having a `oziroot.js` script.

Within *root* the source directory can have any structure, root is relevant for:

*  having `.ozibuild` directory for logs and metadata (e.g. files checksums)
*  replicate source hierarchy in the output directory
*  root relative paths for source file instead recommended nodejs module imports
*  limit source references to root hierarchy

While the output of the build process can be defined in any arbitrary location,
**ozibuild** provides support for generating files in an *outdir* hierarchy which
mirrors the source hierarchy. The *outdir* can be specified as a flag,
default value is `dist` sub-folder in the *root* directory:

```sh
ozibuild --outdir <dir> ...
```

---

## Components

**ozibuild** consists of the following sub-packages and concepts:

*  [`@ozibuild/core`](packages/core/README.md) - core functionality of **ozibuild**
   *   *Source References* - accessing source files
   *   *Configuration* - consuming user configurable options
   *   *Output* - specifying output structure
*  [`@ozibuild/make`](packages/make/README.md) - make like functionality,
foundational blocks of building withing shell commands
   *   *buildCmd* - simplified interface for running a command with logging and build knowledge
   *   *cachedCmd* - running a command with caching
*  [`@ozibuild/cli`](packages/cli/README.md) - command line interface for running builds
   *   *ozibuild* - main command line interface
   *   *ozibuild --watch* - watch mode

Additional packages provide useful tools and utilities for specific use cases:

*  [`@ozibuild/cpp`](packages/cpp/README.md) - minimal support for C++ builds
*  [`@ozibuild/web`](packages/web/README.md) - (limited) support for building web applications

## Philosophy

**ozibuild** is designed with the principle that build tasks are secondary
to an application business logic, which implies:
*  Minimize concepts and abstractions required for build tasks.
*  Assume minimal time spent on writing build logic, and no build expertise.
*  Minimal dependencies.

Other design principles in **ozibuild** includes:
*  Minimal requirements on directory structure.
*  Decouple configuration from build and provide support for customization.
*  No assumptions on build steps, user can design any build strategy.
