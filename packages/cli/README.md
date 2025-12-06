---
title: ozibuild CLI
group: Overview
---

**ozibuild** is a command-line tool designed to build anything using organized scripts
It provides various commands for different tasks and supports shell completion.

### Commands

- **version**: Prints the version information of ozibuild.
  ```
  ozibuild version
  ```

- **make**: Builds the specified targets.
  ```
  ozibuild make <targets>
  ```

- **watch**: Continuously builds the specified targets when used files are changed.
  ```
  ozibuild watch <targets>
  ```

- **complete**: Provides available completions for shell completion. This is typically used internally by the shell to suggest completions as the user types commands.
  ```
  ozibuild complete
  ```

### Flags

- **--help**: Shows usage information and exits.
  ```
  ozibuild --help
  ```

- **--config**: Specifies the path to the config file.
  ```
  ozibuild <command> --config=<path>
  ```

### Usage Examples

1. To build a target:
   ```
   ozibuild make my_target
   ```

2. To watch and rebuild a target on changes:
   ```
   ozibuild watch my_target
   ```

3. To print the version of ozibuild:
   ```
   ozibuild version
   ```

4. To use a custom config file:
   ```
   ozibuild make my_target --config=path/to/config.json
   ```

### Shell Completion

ozibuild includes support for shell completion. To enable it, source the `ozibuild_complete.sh` script in your shell configuration file (e.g., `.bashrc`, `.zshrc`):
```
source $(which ozibuild_complete)
```

This will provide autocompletion suggestions for commands, targets, and flags as you type.
