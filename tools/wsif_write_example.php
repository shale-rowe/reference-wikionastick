#!/usr/bin/php -q
<?php
## WSIF write example
## @author legolas558
## @version 1.0.0
## @copyright GNU/GPL
## (c) 2010 Wiki on a Stick project
## @url http://stickwiki.sf.net/
##
## Write a WSIF file through libwsif
#

require dirname(__FILE__).'/libwsif.php';

if ($argc<2) {
	fprintf(STDERR, "Usage:\n\t%s\tinput_file [\"Page title\"]\n", $argv[0]);
	exit(-1);
}

$title = $src = $argv[1];

$src = file_get_contents($src);
if ($src === FALSE) {
	exit(-2);
}

if ($argc == 3)
	$title = $argv[2];

global $data;
$NP = new WoaS_Page();
$NP->title = $title;
$NP->content = $src;
$data = array($NP);
	
function example_read_cb() {
	global $data;
	if (!count($data))
		return false;
	$NP = array_pop($data);
	return $NP;
}

$WSIF = new WSIF();

$done = $WSIF->Save('example_read_cb', dirname(__FILE__).'/');

sprintf("%d pages written\n", $done);

if ($done)
	exit(0);
	
exit(-1);

?>
