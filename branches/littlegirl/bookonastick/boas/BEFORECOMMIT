#!/bin/bash
## Script to ignore last_modified changes in index.wsif of development version.
## Developers are invited to use this script so that last_modified headers are
## not pushed upstream to repository. Also boas.htm changes should be reverted
## before commit if only index.wsif was changed.
## @author legolas558 @Modified by Little Girl

TMPF=$(mktemp _index.wsif.XXXXX)
grep -v ^woas\\.page\\.last_modified index.wsif > $TMPF
RV=$?
if [ ! $RV -eq 0 ]; then
	rm -f $TMPF
	exit $RV
fi
mv $TMPF index.wsif
