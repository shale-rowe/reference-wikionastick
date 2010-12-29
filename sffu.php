#!/usr/bin/php -q
<?php
## Update woas tool
## @author pvhl
## @copyright GNU/GPL
## (c) 2010 pvhl
#

if ($argc<2) {
	fprintf(STDERR, "Usage:\n\t%s 'simple log message'\n", $argv[0]);
	exit(-1);
}

// grab the command-line log message
$msg;
if ($argc == 2) {
	$msg = $argv[1];
}

// grab the last block of text from the log file
$log = 'fix/log.txt';
$txt = file_get_contents($log);
if (!$txt) {
	fprintf(STDERR, "\nERROR: cannot find %s!\n", $log);
	exit(-2);
}

// get the full log message (adapted from http://stackoverflow.com/questions/2222209/
//   regular-expression-to-match-a-block-of-text-up-to-the-first-double-new-line)
$full_msg;
if (!preg_match("/(?s)((?!(\r?\n){2}).)*+/", $txt, $full_msg)) {
	fprintf(STDERR, "ERROR: cannot find log entry in %s!\n", $log);
	exit(-3);
}

// commit changes to svn
$full_msg = sprintf("svn commit -m \"%s\n\"", $full_msg[0]);
$svn_result = shell_exec($full_msg);
echo "Committed to SourceForge";

// make single file woas' 
//$result2 = exec("mkfix.php");
//echo "Single-file WoaS' created\n";

// add revision to log.txt (e.g. pvhl-r2289 (git: ):\n + rest of file)
// get short git commit hash
$hash = shell_exec("git log -1 --format=format:'%h'");
if ($hash)
	$hash = " (git: ".$hash.")";
else $hash = "";
// attempt to grab SVN information
$info = shell_exec("svn info --xml");
// attempt to grab SVN author
if (preg_match("/\<author\>(.+?)\</", $info, $auth))
	$auth = $auth[1]."-";
else $auth = "";
// attempt to grab revision
if (preg_match("/revision=\"(\\d+)\"/", $info, $rev))
	$rev = (int)$rev[1];
else $rev = "";

// write new log file
$txt = "Revision ".$auth.$rev.$hash."\n".$txt;
file_put_contents($log, $txt);
unlink($log);

//commit to git ("update single-file woas-fix")
//commit to svn ("update single-file woas-fix")

fprintf(STDERR, "svn_result: %s\n", $svn_result);
//fprintf(STDERR, "result2 is: %s\n", $result2);
//fprintf(STDERR, "hash is: %s\n", $hash);
//fprintf(STDERR, "log is: %s\n", $txt);
//fprintf(STDERR, "msg is: %s\n", $msg);

//fprintf(STDERR, "log is: %s\n", $txt);

//fprintf(STDERR, "log text is: %s\n", $full_msg);

exit(0);


file_put_contents('woas.js', $ALL_SCRIPTS);
$MIN_SCRIPTS = shell_exec('jsmin < woas.js');
unlink('woas.js');
// do not create it in case of failure
if (strlen($MIN_SCRIPTS)) {
	$ofile_min = 'woas-fix-min.html';
	if (file_put_contents($ofile_min, _mk_woas($ct, $MIN_SCRIPTS)))
		fprintf(STDOUT, "Created compressed WoaS: %s\n", $ofile_min);
}

unset($MIN_SCRIPTS);
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
