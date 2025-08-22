#!/usr/bin/bash
# Usage:
# source $(which ozibuild_complete)

_ozibuild_complete() {
  echo ozibuild --complete "$2" "${COMP_WORDS[@]}" >> /tmp/ozibuild.log
  COMPREPLY=( $(ozibuild --complete "$2" "${COMP_WORDS[@]}") )
}

complete -o nospace -F _ozibuild_complete ozibuild

(return 0 2>/dev/null) && echo 'ozibuild auto complete installed' || echo 'Usage: source $(which ozibuild_complete)'

