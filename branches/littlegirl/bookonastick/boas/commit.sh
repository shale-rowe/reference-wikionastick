#!/bin/bash
## Script to ignore last_modified changes in index.wsif of development version.
##
## Developers are invited to use this script if "Store and display last
## modified timestamp" is enabled in the wiki options. This way last_modified
## headers are not pushed upstream to the repository.
##
## Also, please revert changes to boas.htm before commit if only index.wsif
## was changed.
##
## Author: legolas558
## Modified by: Little Girl

TMPF=$(mktemp _index.wsif.XXXXX)
grep -v ^woas\\.page\\.last_modified index.wsif > $TMPF
RV=$?
if [ ! $RV -eq 0 ]; then
	rm -f $TMPF
	exit $RV
fi
mv $TMPF index.wsif
