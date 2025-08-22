# ozibuild

> **WARNING**: [[Work in Progress]] ozibuild has no releases yet.

> Build anything with organized scripts.

**ozibuild** is a set of simplified functions on top of `nodejs`,
which enables using JavaScript as a scripting language for generic builds.

**ozibuild** is designed with the principle that build tasks are secondary
to an application business logic, which implies:
* Minimize concepts and abstractions required for build tasks.
* Assume minimal time spent on writing build logic, and no build expertise.
* Minimal dependencies.

**ozibuild** adapts to the natural organization of source hierarchy,
and automates repetitive commands relevant for building the application.

---

## Getting Started

#### Prerequisites

**ozibuild** relies on nodejs for the scripting and task execution,
so it requires that `nodejs` and `npm` are already installed.

In addition, **ozibuild** assumes the execution in the context of a
npm package (i.e. `package.json`), even for building applications that
do not use javascript, npm or nodejs.

#### Installation

**ozibuild** is provided as an npm package:

```sh
npm install --save-dev @ozibuild/ozibuild
```

Alternatively, **ozibuild** can be installed globally to make `ozibuild`
available as a global command line binary.

#### Hello, World!

**ozibuild** scripts uses source reference and runs commands.  
**ozibuild** scripts are regular javascript, which exports async build functions.

```js
// ./ozibuild.mjs
import {sourceDirContext} from '@ozibuild/ozibuild/source';
import {buildCmd} from '@ozibuild/ozibuild/build';

const ctx = sourceDirContext(imports.meta.dir);

// Implement a build task by exporting a standard async function.
export async function helloWorld() {
  return buildCmd(ctx, {bin: 'echo', args: ['Hello', ', ', 'World!']});
}
```

Define the output root directory in `ozibuild.json` configuration.

```json
{
  "outdir": "devel"
}
```

Use **ozibuild** binary to "build" the task implemented by the async function.

```sh
# Runs the build task "helloWorld" in source directory "." 
OZIBUILD_CONFIG=ozibuild.json npx ozibuild . helloWorld
```

#### Next Steps

That's it: scripts, source, configuration and output, named build functions are the building blocks in **ozibuild**. Developers can organize the scripts
as supported by nodejs imports, and **ozibuild** provides powerfull async
functions for meaningful builds. The complexity of the build logic can grow
with any nodejs and javascript logic, and additional npm packages.

See the rest of the documentation for more insights into **ozibuild**.

---

## Source References

A fundamental requirement in build tasks is to reference source
files and directories. **ozibuild** doesn't assume any structure of the
source hierarchy, but requires that a source directory is referenced as a
{@link source/SourceDirContext}, which is created by {@link source/sourceDirContext}. See {@link source} module for reference and details.

## Output

**ozibuild** defaults to a structure of output directory that has the same
hierarchy as the source root. However, most commands would use and explicit
output specification, which can be set or configured as needed.

TODO: Provide more details on how to change output.

## Configuration

A common need for build tasks is to use custom parameters: prod vs devel,
hostname, paths on the system, etc. **ozbuild** expects that final
configurations are NOT stored along with the code, but rather provided at
build time, through `OZIBUILD_CONFIG` environment variable.

TODO: Provide more details about configuration.

## Build Commands

The most common build task is to invoke a binary that takes some input(s)
and produces some output(s). **ozibuild** provides the functions
{@link build/cachedCmd} and {@link build/buildCmd} that should satisfy most
of such use cases. See {@link build} module for reference and details.

## Composition and Tools

**ozibuild** build tasks are standard javascript async functions. They can
invoke other async functions and have arbitrary logic,
with any scripts structure and any additional npm packages.

**ozibuild** package includes a very limited set of predefined tools,
which are very generic and can be useful across all types of applications,
without having dependencies. See {@link tools/file} and {@link tools/net}.

**ozibuild** provides additional npm packages for specific applications
and languages, or with additional dependencies:
*  `@ozibuild/ozibuild-cpp` - C++ build support
*  `@ozibuild/ozibuild-web` - Web development support (Typescript,
Javascript, HTML).

## Flags

* `--config`
* `--watch`
* `--version`
* `--complete`

## AutoComplete

## Contribute

