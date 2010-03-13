#!/usr/bin/php -q
<?php
## ASCII-test script for WoaS
## @author legolas558
## @version 0.1.0
## @license GNU/GPLv2
##
## This program checks that a file contains only ASCII characters.
## Non-ASCII sequences will break in IE browsers
## Requires 'hexdump' program to show results inline
#

if ($argc<2) {
	fprintf(STDERR, "Usage:\n\t%s\tfilename1 [filename2] [filenameN...]\n", $argv[0]);
	exit(-1);
}

array_shift($argv);

$failed = 0;

foreach($argv as $fname) {
	$ct = file_get_contents($fname);
	if ($ct === false) {
		++$failed;
		continue;
	}
	if (preg_match("/[^\\x00-\x7F]/", $ct, $m, PREG_OFFSET_CAPTURE)) {
		$offset = $m[0][1];
		echo sprintf("%s: found non-ascii character 0x%X at offset 0x%X\n", $fname, ord($m[0][0]), $offset);
		system(sprintf("hexdump -s%d -C -n 256 %s", $offset - 128, escapeshellarg($fname)));
		continue;
	}
}

exit(count($argv)-$failed);

?>
