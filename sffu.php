#!/usr/bin/php -q
<?php
## Update woas tool
## @author pvhl
## @copyright GNU/GPL
## (c) 2010 pvhl
##
## Use: provide log message for unimportant updates where a rebuild is not needed
##      Otherwise the current entry in 'fix/log.txt' used.
##      Exit with error if log entry has already been committed.

// check usage
if ($argc>2) {
	fprintf(STDERR, "Usage:\n\t%s ['simple log message']\n\t(html files will not be rebuilt if log message is provided)\n", $argv[0]);
	exit(-1);
}

// grab the command-line log message
$msg = null;
if ($argc == 2) {
	$msg = $argv[1];
}

// grab the first block of text from the log file
$log = 'fix/log.txt';
$txt = file_get_contents($log);
if (!$txt) {
	fprintf(STDERR, "\nERROR: cannot find %s!\n", $log);
	exit(-2);
}

if ($msg) {
	// simple commit of supporting files -- no rebuild needed
	echo "Performing simple commit; no rebuild will be performed, no entry added to 'fix/log.txt'\n";
	echo "Ensuring git repository is up to date\n";
	$msg = sprintf("%s", $msg);
	shell_exec("git add .");
	shell_exec("git commit -m \"".$msg."\"");
	// commit changes to svn
	// first get short git commit hash and add it to the log entry -- make this a subroutine
	$hash = shell_exec("git log -1 --format=format:%h");
	if ($hash)
		$hash = " (git: ".$hash.")";
	else $hash = "";
	shell_exec("svn commit -m \"".$msg.$hash."\"");
	echo "Committed changes to local git repository and SourceForge svn.\n";
	echo "Logged to svn:\n\n".$msg.$hash."\n";
	exit(0);
} else {
	// full commit from fix/log.txt includes rebuilding single-files
	
	// check we haven't forgotten to create a log entry in log.txt
/*	if (preg_match("/Revision.*\(git:/", $txt, $msg)) {
		echo $msg[0]; // why is this crossing lines?
		fprintf(STDERR, "\nERROR: %s has already been committed!\n", $log);
		exit(-3);
	}
*/
	// get the full log message ; adapted from http://stackoverflow.com/questions/2222209/
	//    regular-expression-to-match-a-block-of-text-up-to-the-first-double-new-line
	if (!preg_match("/(?s)((?!(\r?\n){2}).)*+/", $txt, $msg)) {
		fprintf(STDERR, "ERROR: cannot find log entry in %s!\n", $log);
		exit(-4);
	}
	$msg = $msg[0];
	
	echo "Ensuring git repository is up to date\n";
	shell_exec("git add .");
	shell_exec("git commit -m \"".$msg."\"");

	// get short git commit hash  -- move to subroutine
	// want this one as this one relates to the actual commit we used
	$hash = shell_exec("git log -1 --format=format:%h");
	if ($hash)
		$hash = " (git: ".$hash.")";
	else $hash = "";

	## -m didn't work for svn (only one line was present in log)
	## -- try writing to a temp file and using -F

	// Write log entry to use with svn
	echo "Writing svn log to temp.log\n";
	file_put_contents("temp.log", $msg);

	// commit changes to svn
	shell_exec("svn commit -F \"".temp.log."\"");
	unlink('temp/log');
	echo "Committed to SourceForge\n";

	// make single file woas' 
	shell_exec("php mkfix.php");
	echo "woas-fix[-min].html created\n";

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
	
	// create message for final commits
	$msg = "Update woas-fix[-min].html";
	
	//commit to git
	shell_exec("git commit -m \"".$msg."\"");
	
	// commit changes to svn
	shell_exec("svn commit -m \"".$msg.$hash."\"");

	echo "Committed changes to local git repository and SourceForge svn.\n";
	exit(0);
}

?>
