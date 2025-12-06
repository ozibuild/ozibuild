#!/usr/bin/bash
# Usage:
# source $(which ozibuild_complete)

_ozibuild_complete() {
  local cur
  # Re-read completion words without ':' as delimiter
  _get_comp_words_by_ref -n : -c cur -w COMP_WORDS -i COMP_CWORD
  
  #echo ozibuild complete "$cur" "$COMP_CWORD" "${COMP_WORDS[@]}" >> /tmp/ozibuild.log
  COMPREPLY=( $(ozibuild complete "$COMP_CWORD" "${COMP_WORDS[@]}") )
  #echo "${COMPREPLY[@]}"  >> /tmp/ozibuild.log
  #echo cur: "$cur" >> /tmp/ozibuild.log
  #echo >> /tmp/ozibuild.log
  
  # Allow ':' on current completion
  __ltrim_colon_completions "$cur"
}

complete -o nospace -F _ozibuild_complete ozibuild

# Completion installation only works when script is sourced.
(return 0 2>/dev/null) && echo 'ozibuild complete installed' || echo "Usage: source $(readlink -f $0)"
