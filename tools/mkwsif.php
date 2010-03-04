#!/usr/bin/php -q
<?php
## WSIF write example
## @author legolas558
## @version 1.1.0
## @copyright GNU/GPL
## (c) 2010 Wiki on a Stick project
## @url http://stickwiki.sf.net/
##
## Write a WSIF file through libwsif
#

require dirname(__FILE__).'/libwsif.php';

if ($argc<2) {
	fprintf(STDERR, "Usage:\n\t%s\t{input_file [\"Page title\"]} | {[input_file \"Page title\"] [input_file_n] [\"Page title n\"] ... }\n", $argv[0]);
	exit(-1);
}

// build up an array of sources and titles to work on
global $sources, $titles;
if ($argc == 2) {
	$sources = array($argv[1]);
	$titles = array($argv[1]);
} else {
	if (($argc % 2) == 0) {
		$argv[] = $argv[$argc-1];
		++$argc;
	}
	$sources = array();
	$titles = Array();
	for($i=1;$i<$argc;$i+=2) {
		$sources[] = $argv[$i];
		$titles[] = $argv[$i+1];
	}
}

function example_read_cb() {
	global $sources,$titles;
	if (!count($titles))
		return false;
	$src = array_pop($sources);
	$src = file_get_contents($src);
	if ($src === FALSE) {
		array_pop($titles);
		return false;
	}
	$NP = new WoaS_Page();
	$NP->title = array_pop($titles);
	$NP->content = $src;
	$pages[] = $NP;

	return $NP;
}

$WSIF = new WSIF();
$done = $WSIF->Save('example_read_cb', dirname(__FILE__).'/');

sprintf("%d pages written\n", $done);

$done -= count($sources);

exit($done);

?>
