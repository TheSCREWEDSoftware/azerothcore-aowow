#!/usr/bin/env bash

# Migrates old Unix timestamp filenames (e.g. 1717076299_01.sql)
# to human-readable format (e.g. 2024_05_30_01.sql)
#
# Usage:
#   ./migrate_filenames.sh        # dry run - preview only, no changes made
#   ./migrate_filenames.sh --apply # apply the renames

if [[ "$(uname)" == 'Darwin' ]]; then
    datecmd='gdate'
else
    datecmd='date'
fi

CUR_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )/" && pwd )"
APPLY=false

if [[ "$1" == '--apply' ]]; then
    APPLY=true
    echo "Applying renames..."
else
    echo "Dry run — no files will be changed. Pass --apply to rename."
fi

echo ""

# track used names within this run to avoid collisions between files on the same day
declare -A used

for filepath in "$CUR_PATH"/[0-9]*_[0-9]*.sql; do
    filename=$(basename "$filepath")

    # extract timestamp (everything before the last _NN.sql)
    timestamp="${filename%%_*}"

    # skip if not a pure unix timestamp
    if ! [[ "$timestamp" =~ ^[0-9]{9,11}$ ]]; then
        continue
    fi

    DATE_STR=$($datecmd -d "@$timestamp" +%Y_%m_%d 2>/dev/null)
    if [[ -z "$DATE_STR" ]]; then
        echo "  SKIP  $filename  (could not convert timestamp)"
        continue
    fi

    # find next available increment for this date
    idx=1
    while : ; do
        newname="${DATE_STR}_$(printf '%02d' $idx).sql"
        if [[ ! -e "$CUR_PATH/$newname" && -z "${used[$newname]}" ]]; then
            break
        fi
        idx=$((idx+1))
    done

    used[$newname]=1

    if [[ "$APPLY" == true ]]; then
        mv "$filepath" "$CUR_PATH/$newname"
        echo "  RENAMED  $filename  ->  $newname"
    else
        echo "  PREVIEW  $filename  ->  $newname"
    fi
done

echo ""
if [[ "$APPLY" == true ]]; then
    echo "Done."
else
    echo "Run with --apply to perform the renames."
fi
