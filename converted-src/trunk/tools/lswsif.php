#!/usr/bin/php -q
<?php
## WSIF list content tool
## @author legolas558
## @version 1.0.1
## @copyright GNU/GPL
## (c) 2010 Wiki on a Stick project
## @url http://stickwiki.sf.net/
##
## Reads a WSIF file through libwsif
#

require dirname(__FILE__).'/libwsif.php';

if ($argc<2) {
	fprintf(STDERR, "Usage:\n\t%s\tfile1.wsif [file2.wsif...]\n", $argv[0]);
	exit(-1);
}

array_shift($argv);

$done = 0;
foreach($argv as $fname) {
	$WSIF = new WSIF();
	$rv = $WSIF->Load($fname);
	if ($rv !== false)
		$done += $rv;
}

echo sprintf("%d WSIF pages processed\n", $done);

exit(0);

?>
