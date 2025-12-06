---
title: '@ozibuild/core'
group: Packages
category: READMEs
---

## @ozibuild/core

### Context

Source context ({@link core!SourceDirContext}) provides information about source input
files and directories that is used in build transformations, as well as additional
manipulation function for outputs, cofiguration and logging.

Each `ozibuild.js` would create a context for its container directory,
using `{@link core!sourceDirContext}, and pass it to building methods:

```js
import {sourceDirContext} from '@ozibuild/core/index.js';
const ctx = sourceDirContext(import.meta.dirname);
```

### Root

Root is the closest directory containing either a `.ozibuild` directory
or a script named `ozibuild.root.js`. In the latter case, **ozibuild** creates `.ozibuild` directory.\
The structure of the hierarchy used by **ozibuild** is relative to this `root`.

It is possible to have nested roots, e.g. for separating components, for monorepos,
or for dependencies.\
In this case, each source context refers to its enclosing root,
and the build executions in the inner root  hierarchy are relative to closest root.

**ozibuild** assumes that each root controls only its hierarchy,
and that an outer root can configure the inner root (explicitly),
but any configuration within a root is contained within its hierarchy.

Root context is available through {@link core!SourceDirectoryContext.root}.

### Configuration

Configuration for an **ozibuild** build runs is logically a javascript object,
stored in `.ozibuild/config.json`, and configuration values are accessed through
{@link core!OzibuildConfig}.

Inside a build script, configuration is accessed through
{@link core!SourceDirectory.config}, and the most common use is to query values using
{@link core!OzibuildConfig.getOptional} and {@link core!OzibuildConfig.getRequired}.

From the command line, configuration can be updated using `config` command.
Config flags also have effect during other commands, such as `make` and `watch`.

```sh
# Update individual values in config:
ozibuild config --set container.setting:value --set container.setting2:another_value
ozibuild config --reset container.setting # Remove a value and its children

# Update all values from the given file:
ozibuild config --merge-config path/to/config.json # Only replace specified values
ozibuild config --config path/to/config.json # Replace all settings
```

Configuration updates applies to the *root* relative to current working directory.
To update a config setting in a nested *root*, change directory into that *root*.

Settings used during a build execution can be persisted in the `.ozibuild/config.json`:

```sh
# keys - dumps settings with null values ; defaults - dumps settings with default values
ozibuild make --dump-config=keys|defaults <targets>
```

Configuration can also be set programatically from the build script,
through {@link core!OzibuildConfig.setDefault} method.\
An explicit default value set programatically is only effective after `setDefault`
has been invoked, and it is not persisted (unless using `--dump-config=defaults`),
so any usages of the given setting must happen after `setDefault`.\
Configuration is global per *root*, so it is recommended that `setDefault` is only
invoked from the build script in the *root* directory.

NOTE: **ozibuild** guarantees that build script in the *root* directory is always loaded.

To set configuration default settings in the nested roots,
use {@link core!SourceDirectoryContext.getChildConfig}.

The order in which the configuration settings are applied:

*  User specified value from (latest) command line.
*  Default value from top-level *root* build script.
*  Default value from closest *root* build script.
*  Default value from `getOptional` parameter. 

### Outdir

By default, **ozibuild** provides support to produce output files with a directory
structure mirroring the source hierarchy, rooted in a configurable `outdir` directory.

Default `outdir` is `*root*/.ozibuild/dist`.

The `outdir` can be overridden by setting the `outdir` config setting,
or using `--outdir` option on the command line.

### Caching

For each command that produces an output file, **ozibuild** keeps a file with metadata
about the input for command execution, in a hierarchy rooted in `*root*/.ozibuild/cache`.

### Logging

For each command that produces an output file, **ozibuild** saves the command output to a log file in hierarchy mirroring the output hierarchy rooted in `*root*/.ozibuild/logs`.